import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal(file = '.env.local') {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 1) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function rid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const vendors = [
  { name: 'Uber', category: 'rideshare', base: 24 },
  { name: 'Starbucks', category: 'coffee', base: 9 },
  { name: 'City Parking', category: 'parking', base: 18 },
  { name: 'Marriott', category: 'lodging', base: 210 },
  { name: 'WeWork', category: 'office', base: 135 },
  { name: 'Delta Airlines', category: 'travel', base: 320 },
  { name: 'Sweetgreen', category: 'meals', base: 26 },
  { name: 'Staples', category: 'supplies', base: 48 }
];

const rules = {
  autoApproveMaxTotal: 75,
  reviewOverTotal: 150,
  maxTipPct: 0.2,
  allowedCategoriesAutoApprove: new Set(['rideshare', 'coffee', 'parking', 'meals'])
};

function decisionFor(receipt) {
  const flags = [];
  if (!receipt.vendor || !receipt.date || !receipt.amount) flags.push('MISSING_FIELD');
  if (receipt.amount > rules.reviewOverTotal) flags.push('HIGH_AMOUNT');
  if (receipt.tip_pct > rules.maxTipPct) flags.push('TIP_TOO_HIGH');
  if (!rules.allowedCategoriesAutoApprove.has(receipt.category) && receipt.amount > rules.autoApproveMaxTotal) flags.push('UNCATEGORIZED');
  if (receipt.duplicate_of) flags.push('POSSIBLE_DUPLICATE');

  let status = 'needs_review';
  if (flags.length === 0 && receipt.confidence_score >= 0.9 && receipt.amount <= rules.autoApproveMaxTotal) {
    status = 'approved';
  }
  return { status, flags };
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { y, m };
}

function buildSyntheticData(count, month) {
  const { y, m } = monthRange(month);
  const base = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  const rows = [];
  const signatures = new Map();

  for (let i = 0; i < count; i += 1) {
    const v = vendors[i % vendors.length];
    const day = (i % 27) + 1;
    const dt = new Date(base);
    dt.setUTCDate(day);

    const jitter = ((i * 17) % 13) - 6;
    const amount = Number((v.base + jitter + ((i % 5) * 0.37)).toFixed(2));
    const tax = Number((amount * 0.07).toFixed(2));
    const tipPct = v.category === 'meals' || v.category === 'coffee' ? Number((0.08 + (i % 4) * 0.05).toFixed(2)) : 0;

    const duplicateSeed = i % 23 === 0 && rows.length > 0 ? rows[rows.length - 1] : null;
    const vendor = duplicateSeed ? duplicateSeed.vendor : v.name;
    const date = duplicateSeed ? duplicateSeed.date : fmtDate(dt);
    const dupAmount = duplicateSeed ? duplicateSeed.amount : amount;
    const signature = `${vendor.toLowerCase()}|${date}|${dupAmount.toFixed(2)}`;

    const duplicateOf = signatures.get(signature) || null;
    if (!duplicateOf) signatures.set(signature, `rcpt_syn_${String(i).padStart(4, '0')}`);

    const confidence = Number((0.82 + ((i % 10) * 0.02)).toFixed(2));

    const row = {
      id: `rcpt_syn_${String(i).padStart(4, '0')}`,
      user_id: 'usr_seed',
      created_at: new Date(Date.UTC(y, m - 1, day, 12, i % 59, 0)).toISOString(),
      file_path: `synthetic/${month}/receipt_${String(i + 1).padStart(3, '0')}.pdf`,
      ocr_text: `SYNTHETIC RECEIPT ${i + 1}`,
      date,
      vendor,
      amount: dupAmount,
      tax,
      currency: 'USD',
      category: v.category,
      payment_method: i % 2 === 0 ? 'corporate_card' : 'personal',
      memo: `[synthetic-run] receipt ${i + 1}`,
      confidence_score: confidence,
      duplicate_of: duplicateOf
    };

    const result = decisionFor({ ...row, tip_pct: tipPct });
    row.status = result.status;
    row.policy_flags = result.flags;

    rows.push(row);
  }

  return rows;
}

function summarize(rows) {
  const out = {
    total: rows.length,
    approved: 0,
    needs_review: 0,
    rejected: 0,
    duplicates_flagged: 0,
    high_amount_flagged: 0,
    avg_confidence: 0
  };
  let conf = 0;
  for (const r of rows) {
    out[r.status] = (out[r.status] || 0) + 1;
    if ((r.policy_flags || []).includes('POSSIBLE_DUPLICATE')) out.duplicates_flagged += 1;
    if ((r.policy_flags || []).includes('HIGH_AMOUNT')) out.high_amount_flagged += 1;
    conf += Number(r.confidence_score || 0);
  }
  out.avg_confidence = Number((conf / Math.max(rows.length, 1)).toFixed(3));
  out.auto_approval_rate = Number((out.approved / Math.max(rows.length, 1)).toFixed(3));
  out.review_rate = Number((out.needs_review / Math.max(rows.length, 1)).toFixed(3));
  return out;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local');
  }

  const month = process.argv[2] || new Date().toISOString().slice(0, 7);
  const count = Number(process.argv[3] || 200);

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

  await supabase.from('users').upsert({ id: 'usr_seed', email: 'owner@example.com' });

  const rows = buildSyntheticData(count, month);
  const runId = rid('run');

  const { error: delErr } = await supabase.from('receipts').delete().like('memo', '[synthetic-run]%');
  if (delErr) throw delErr;

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('receipts').insert(chunk);
    if (error) throw error;
  }

  const summary = summarize(rows);

  const { error: runErr } = await supabase.from('research_runs').insert({
    id: runId,
    receipt_count: rows.length,
    month,
    notes: 'Synthetic benchmark run'
  });
  if (runErr) throw runErr;

  const metrics = Object.entries(summary).map(([metric_key, metric_value]) => ({
    run_id: runId,
    metric_key,
    metric_value: Number(metric_value)
  }));
  const { error: metricsErr } = await supabase.from('research_metrics').insert(metrics);
  if (metricsErr) throw metricsErr;

  const output = {
    runId,
    month,
    inserted: rows.length,
    summary,
    timestamp: new Date().toISOString()
  };
  const outPath = path.join('research', 'output', `synthetic-${runId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify(output, null, 2));
  console.log(`Saved report: ${outPath}`);
}

main().catch((err) => {
  console.error('Synthetic run failed:', err.message || err);
  process.exit(1);
});
