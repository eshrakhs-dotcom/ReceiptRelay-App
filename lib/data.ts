import { getSupabaseService } from './supabaseClient';
import { computeDuplicateHash, evaluatePolicies, normalizeOcr, parseAmount, parseDate, parseTax, parseVendor, suggestCategory } from './parse';
import { PolicyRow, ReceiptRow } from './types';
import { createHash } from 'crypto';

const supabase = () => getSupabaseService();

function parseRestrictedCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function ensureUser() {
  const client = supabase();
  const { data: users, error: userErr } = await client.from('users').select('*').limit(1);
  if (userErr) throw new Error(`user lookup failed: ${userErr.message}`);
  if (users && users.length) return users[0];
  const id = cryptoRandomId('usr');
  const { data, error } = await client
    .from('users')
    .insert({ id, email: 'owner@example.com' })
    .select('*')
    .single();
  if (error) throw new Error(`user insert failed: ${error.message}`);
  const { error: polErr } = await client.from('policies').insert({ user_id: id });
  if (polErr) throw new Error(`policy insert failed: ${polErr.message}`);
  return data;
}

export async function getReceipts(status: 'inbox' | 'approved' = 'inbox') {
  const { data } = await supabase()
    .from('receipts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  return (data || []) as ReceiptRow[];
}

export async function listReceipts(status?: string) {
  let query = supabase().from('receipts').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`list receipts failed: ${error.message}`);
  return (data || []) as ReceiptRow[];
}

export async function getReceipt(id: string) {
  const { data } = await supabase().from('receipts').select('*').eq('id', id).single();
  return data as ReceiptRow | null;
}

export async function upsertPolicies(userId: string, payload: Partial<PolicyRow>) {
  const existing = await getPolicies(userId);
  const restricted = parseRestrictedCategories(payload.restricted_categories ?? existing?.restricted_categories ?? []);
  if (existing) {
    const { data } = await supabase()
      .from('policies')
      .update({ ...existing, ...payload, restricted_categories: JSON.stringify(restricted) })
      .eq('user_id', userId)
      .select('*')
      .single();
    return data ? { ...data, restricted_categories: parseRestrictedCategories(data.restricted_categories) } : null;
  }
  const { data } = await supabase()
    .from('policies')
    .insert({ user_id: userId, ...payload, restricted_categories: JSON.stringify(restricted) })
    .select('*')
    .single();
  return data ? { ...data, restricted_categories: parseRestrictedCategories(data.restricted_categories) } : null;
}

export async function getPolicies(userId: string) {
  const { data } = await supabase().from('policies').select('*').eq('user_id', userId).single();
  if (!data) return null;
  return { ...data, restricted_categories: parseRestrictedCategories(data.restricted_categories) } as PolicyRow;
}

export async function insertLog(receiptId: string, step: string, message: string) {
  await supabase().from('logs').insert({ receipt_id: receiptId, step, message });
}

export async function ingestOcr(receiptId: string, rawText: string, filePath: string, userId: string) {
  const normalized = normalizeOcr(rawText);
  const parsed: Partial<ReceiptRow> = {
    date: parseDate(normalized),
    vendor: parseVendor(normalized),
    amount: parseAmount(normalized),
    tax: parseTax(normalized),
    category: suggestCategory(parseVendor(normalized)) || 'Uncategorized'
  };

  const policies = await getPolicies(userId);
  if (!policies) throw new Error('Policies missing');

  const flags = evaluatePolicies(parsed, policies);
  const policyFlags = Object.keys(flags).filter((k) => (flags as any)[k]);

  const duplicateHash = computeDuplicateHash(parsed.vendor, parsed.date, parsed.amount);
  let duplicateOf: string | null = null;
  if (duplicateHash) {
    const { data } = await supabase()
      .from('receipts')
      .select('*')
      .neq('id', receiptId);
    const existing = (data || []).find((r) => computeDuplicateHash(r.vendor, r.date, r.amount) === duplicateHash);
    if (existing) {
      duplicateOf = existing.id;
      policyFlags.push('duplicate_detected');
    }
  }

  await supabase()
    .from('receipts')
    .update({
      ocr_text: normalized,
      file_path: filePath,
      ...parsed,
      policy_flags: policyFlags,
      duplicate_of: duplicateOf
    })
    .eq('id', receiptId);

  await insertLog(receiptId, 'parse', 'parsed receipt fields');
  await insertLog(receiptId, 'policy', `flags: ${policyFlags.join(',') || 'none'}`);

  return { parsed, policyFlags, duplicateOf };
}

export async function createReceiptFromUpload(filePath: string, userId: string) {
  const id = cryptoRandomId('rcpt');
  const { error } = await supabase().from('receipts').insert({ id, user_id: userId, file_path: filePath });
  if (error) throw new Error(`receipt insert failed: ${error.message}`);
  await insertLog(id, 'upload', 'file stored');
  return id;
}

export async function createReceiptWithId(id: string, userId: string, filePath: string, status: string = 'processing') {
  const { error } = await supabase().from('receipts').insert({ id, user_id: userId, file_path: filePath, status });
  if (error) throw new Error(`receipt insert failed: ${error.message}`);
  await insertLog(id, 'upload', 'file stored');
}

export async function updateReceipt(id: string, payload: Partial<ReceiptRow>) {
  const { data } = await supabase()
    .from('receipts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  await insertLog(id, 'approve', `updated status to ${payload.status ?? 'inbox'}`);
  return data as ReceiptRow;
}

export async function findDuplicate(vendor?: string | null, date?: string | null, amount?: number | null) {
  if (!vendor || !date || amount == null) return null;
  const { data, error } = await supabase().from('receipts').select('*').eq('vendor', vendor).eq('date', date).eq('amount', amount).limit(1);
  if (error) throw new Error(`duplicate lookup failed: ${error.message}`);
  return data?.[0] || null;
}

export async function clearReceipts() {
  // Clear child rows first because logs.receipt_id has FK to receipts.id.
  const { error: logErr } = await supabase().from('logs').delete().neq('id', 0);
  if (logErr) throw new Error(`clear logs failed: ${logErr.message}`);

  const { error } = await supabase().from('receipts').delete().neq('id', '');
  if (error) throw new Error(`clear receipts failed: ${error.message}`);
}

export function cryptoRandomId(prefix: string) {
  return `${prefix}_${createHash('sha256').update(Math.random().toString()).digest('hex').slice(0, 6)}`;
}
