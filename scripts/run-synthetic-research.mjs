import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const CONDITIONS = ['manual_only', 'ocr_parse_only', 'ocr_parse_policy_no_norm', 'full_pipeline'];
const FLAG_TYPES = ['MISSING_FIELD', 'HIGH_AMOUNT', 'TIP_TOO_HIGH', 'UNCATEGORIZED', 'POSSIBLE_DUPLICATE'];

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

function round(n, d = 3) {
  return Number(n.toFixed(d));
}

function prf(tp, fp, fn) {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision: round(precision), recall: round(recall), f1: round(f1) };
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

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { y, m };
}

function rawDateVariant(isoDate, i) {
  const [y, m, d] = isoDate.split('-');
  if (i % 3 === 0) return `${m}/${d}/${y}`;
  if (i % 3 === 1) return `${m}-${d}-${y}`;
  return isoDate;
}

function rawAmountVariant(amount, i) {
  if (i % 4 === 0) return `$${amount.toFixed(2)}`;
  if (i % 4 === 1) return `${amount.toFixed(2)} USD`;
  if (i % 4 === 2) return `${amount.toFixed(2)}`;
  return `${amount}`;
}

function rawVendorVariant(vendor, i) {
  if (i % 3 === 0) return vendor.toUpperCase();
  if (i % 3 === 1) return ` ${vendor} `;
  return vendor;
}

function truthFlagsFor(row) {
  const flags = [];
  if (!row.truth.vendor || !row.truth.date || row.truth.amount == null) flags.push('MISSING_FIELD');
  if (row.truth.amount > rules.reviewOverTotal) flags.push('HIGH_AMOUNT');
  if (row.truth.tipPct > rules.maxTipPct) flags.push('TIP_TOO_HIGH');
  if (!rules.allowedCategoriesAutoApprove.has(row.truth.category) && row.truth.amount > rules.autoApproveMaxTotal) flags.push('UNCATEGORIZED');
  if (row.truth.isDuplicate) flags.push('POSSIBLE_DUPLICATE');
  return flags;
}

function normalizeVendor(v) {
  return (v || '').trim().toLowerCase();
}

function normalizeDate(dateRaw) {
  if (!dateRaw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return dateRaw;
  const m = dateRaw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function normalizeAmount(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
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
    const tipPct = v.category === 'meals' || v.category === 'coffee' ? Number((0.08 + (i % 4) * 0.05).toFixed(2)) : 0;
    const tax = Number((amount * 0.07).toFixed(2));
    const duplicateSeed = i % 23 === 0 && rows.length > 0 ? rows[rows.length - 1] : null;

    let vendor = duplicateSeed ? duplicateSeed.truth.vendor : v.name;
    let date = duplicateSeed ? duplicateSeed.truth.date : fmtDate(dt);
    let amt = duplicateSeed ? duplicateSeed.truth.amount : amount;

    if (i % 41 === 0) vendor = null;

    const signature = `${normalizeVendor(vendor)}|${date}|${amt.toFixed(2)}`;
    const duplicateOf = signatures.get(signature) || null;
    if (!duplicateOf) signatures.set(signature, `rcpt_syn_${String(i).padStart(4, '0')}`);

    const confidenceScore = Number((0.82 + ((i % 10) * 0.02)).toFixed(2));

    rows.push({
      id: `rcpt_syn_${String(i).padStart(4, '0')}`,
      created_at: new Date(Date.UTC(y, m - 1, day, 12, i % 59, 0)).toISOString(),
      truth: {
        vendor,
        date,
        amount: amt,
        tax,
        currency: 'USD',
        category: v.category,
        tipPct,
        isDuplicate: Boolean(duplicateOf),
        duplicateOf,
        confidenceScore
      },
      observed: {
        vendor_raw: rawVendorVariant(vendor ?? 'Unknown Vendor', i),
        date_raw: rawDateVariant(date, i),
        amount_raw: rawAmountVariant(amt, i)
      }
    });
  }

  for (const row of rows) {
    row.truth.flags = truthFlagsFor(row);
  }

  return rows;
}

function evaluateCondition(condition, dataset) {
  const predictions = [];

  if (condition === 'manual_only' || condition === 'ocr_parse_only') {
    for (const row of dataset) {
      predictions.push({ id: row.id, status: 'needs_review', flags: [] });
    }
    return predictions;
  }

  const duplicateSeen = new Map();

  for (const row of dataset) {
    let parsedVendor = row.truth.vendor;
    let parsedDate = row.truth.date;
    let parsedAmount = row.truth.amount;
    let confidenceScore = row.truth.confidenceScore;

    if (condition === 'ocr_parse_policy_no_norm') {
      parsedVendor = row.observed.vendor_raw;
      parsedDate = row.observed.date_raw;
      parsedAmount = normalizeAmount(row.observed.amount_raw);
      confidenceScore = Math.max(0.6, row.truth.confidenceScore - 0.12);
    }

    const flags = [];

    const missingField = !parsedVendor || !parsedDate || parsedAmount == null;
    if (missingField) flags.push('MISSING_FIELD');

    if (parsedAmount != null && parsedAmount > rules.reviewOverTotal) flags.push('HIGH_AMOUNT');
    if (row.truth.tipPct > rules.maxTipPct) flags.push('TIP_TOO_HIGH');

    const cat = row.truth.category;
    if (parsedAmount != null && !rules.allowedCategoriesAutoApprove.has(cat) && parsedAmount > rules.autoApproveMaxTotal) {
      flags.push('UNCATEGORIZED');
    }

    let dupSig;
    if (condition === 'full_pipeline') {
      dupSig = `${normalizeVendor(parsedVendor)}|${normalizeDate(parsedDate)}|${(parsedAmount ?? 0).toFixed(2)}`;
    } else {
      dupSig = `${parsedVendor || ''}|${parsedDate || ''}|${parsedAmount ?? ''}`;
    }
    if (duplicateSeen.has(dupSig)) flags.push('POSSIBLE_DUPLICATE');
    duplicateSeen.set(dupSig, row.id);

    let status = 'needs_review';
    if (!flags.length && confidenceScore >= 0.9 && (parsedAmount ?? Infinity) <= rules.autoApproveMaxTotal) {
      status = 'approved';
    }

    predictions.push({ id: row.id, status, flags, confidenceScore });
  }

  return predictions;
}

function computeMetrics(dataset, predictions, condition) {
  const predMap = new Map(predictions.map((p) => [p.id, p]));
  const summary = {
    total: dataset.length,
    approved: 0,
    needs_review: 0,
    rejected: 0,
    auto_approval_rate: 0,
    review_rate: 0,
    workload_manual_seconds: dataset.length * 60,
    workload_condition_seconds: 0,
    workload_reduction_pct: 0
  };

  for (const p of predictions) {
    summary[p.status] = (summary[p.status] || 0) + 1;
  }
  summary.auto_approval_rate = round(summary.approved / Math.max(summary.total, 1));
  summary.review_rate = round(summary.needs_review / Math.max(summary.total, 1));
  summary.workload_condition_seconds = summary.needs_review * 40;
  summary.workload_reduction_pct = round((summary.workload_manual_seconds - summary.workload_condition_seconds) / summary.workload_manual_seconds);

  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const row of dataset) {
    const truth = row.truth.flags.includes('POSSIBLE_DUPLICATE');
    const pred = (predMap.get(row.id)?.flags || []).includes('POSSIBLE_DUPLICATE');
    if (pred && truth) tp += 1;
    if (pred && !truth) fp += 1;
    if (!pred && truth) fn += 1;
  }
  const duplicateMetrics = prf(tp, fp, fn);

  const policyMetrics = {};
  for (const flag of FLAG_TYPES) {
    let ftp = 0;
    let ffp = 0;
    let ffn = 0;
    for (const row of dataset) {
      const truth = row.truth.flags.includes(flag);
      const pred = (predMap.get(row.id)?.flags || []).includes(flag);
      if (pred && truth) ftp += 1;
      if (pred && !truth) ffp += 1;
      if (!pred && truth) ffn += 1;
    }
    policyMetrics[flag] = { ...prf(ftp, ffp, ffn), support: dataset.filter((r) => r.truth.flags.includes(flag)).length };
  }

  return { condition, summary, duplicateMetrics, policyMetrics };
}

function buildRowsForInsert(dataset, fullPredictions, month) {
  const predMap = new Map(fullPredictions.map((p) => [p.id, p]));
  return dataset.map((row, idx) => {
    const p = predMap.get(row.id);
    return {
      id: row.id,
      user_id: 'usr_seed',
      created_at: row.created_at,
      status: p?.status || 'needs_review',
      file_path: `synthetic/${month}/receipt_${String(idx + 1).padStart(3, '0')}.pdf`,
      ocr_text: `SYNTHETIC RECEIPT ${idx + 1}`,
      date: row.truth.date,
      vendor: row.truth.vendor,
      amount: row.truth.amount,
      tax: row.truth.tax,
      currency: row.truth.currency,
      category: row.truth.category,
      payment_method: idx % 2 === 0 ? 'corporate_card' : 'personal',
      memo: `[synthetic-run] receipt ${idx + 1}`,
      confidence_score: row.truth.confidenceScore,
      policy_flags: p?.flags || [],
      duplicate_of: row.truth.duplicateOf
    };
  });
}

function flattenMetrics(runId, allConditionMetrics) {
  const out = [];
  for (const item of allConditionMetrics) {
    const c = item.condition;
    for (const [k, v] of Object.entries(item.summary)) {
      if (typeof v === 'number') out.push({ run_id: runId, condition: c, metric_key: `summary.${k}`, metric_value: v });
    }
    for (const [k, v] of Object.entries(item.duplicateMetrics)) {
      out.push({ run_id: runId, condition: c, metric_key: `duplicate.${k}`, metric_value: v });
    }
    for (const [flag, vals] of Object.entries(item.policyMetrics)) {
      for (const [k, v] of Object.entries(vals)) {
        out.push({ run_id: runId, condition: c, metric_key: `policy.${flag}.${k}`, metric_value: Number(v) });
      }
    }
  }
  return out;
}

function printComparativeSummary(allMetrics) {
  const index = Object.fromEntries(allMetrics.map((m) => [m.condition, m]));
  const compact = {
    automation_yield: CONDITIONS.reduce((acc, c) => {
      acc[c] = {
        approved: index[c].summary.approved,
        needs_review: index[c].summary.needs_review,
        auto_approval_rate: index[c].summary.auto_approval_rate
      };
      return acc;
    }, {}),
    duplicate_detection: CONDITIONS.reduce((acc, c) => {
      acc[c] = index[c].duplicateMetrics;
      return acc;
    }, {}),
    workload: CONDITIONS.reduce((acc, c) => {
      acc[c] = {
        workload_condition_seconds: index[c].summary.workload_condition_seconds,
        workload_reduction_pct: index[c].summary.workload_reduction_pct
      };
      return acc;
    }, {})
  };

  console.log('\n=== CONDITION COMPARISON (TABLE-READY) ===');
  console.log(JSON.stringify(compact, null, 2));
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
  const runId = rid('run');

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
  await supabase.from('users').upsert({ id: 'usr_seed', email: 'owner@example.com' });

  const dataset = buildSyntheticData(count, month);
  const conditionMetrics = CONDITIONS.map((condition) => {
    const predictions = evaluateCondition(condition, dataset);
    return computeMetrics(dataset, predictions, condition);
  });

  const fullPredictions = evaluateCondition('full_pipeline', dataset);
  const rowsToInsert = buildRowsForInsert(dataset, fullPredictions, month);

  const { error: delErr } = await supabase.from('receipts').delete().like('memo', '[synthetic-run]%');
  if (delErr) throw delErr;

  for (let i = 0; i < rowsToInsert.length; i += 100) {
    const { error } = await supabase.from('receipts').insert(rowsToInsert.slice(i, i + 100));
    if (error) throw error;
  }

  const { error: runErr } = await supabase.from('research_runs').insert({
    id: runId,
    receipt_count: rowsToInsert.length,
    month,
    notes: 'Synthetic benchmark run with four conditions'
  });
  if (runErr) throw runErr;

  const flatMetrics = flattenMetrics(runId, conditionMetrics);
  const { error: metricsErr } = await supabase.from('research_metrics').insert(flatMetrics);
  if (metricsErr) throw metricsErr;

  const output = {
    runId,
    month,
    inserted: rowsToInsert.length,
    conditions: Object.fromEntries(conditionMetrics.map((m) => [m.condition, m])),
    timestamp: new Date().toISOString()
  };

  const outPath = path.join('research', 'output', `synthetic-${runId}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(JSON.stringify({ runId, month, inserted: rowsToInsert.length }, null, 2));
  printComparativeSummary(conditionMetrics);
  console.log(`Saved report: ${outPath}`);
}

main().catch((err) => {
  console.error('Synthetic run failed:', err.message || err);
  process.exit(1);
});
