export type ReceiptRecord = {
  id: string;
  filename: string;
  status: 'processing' | 'needs_review' | 'approved' | 'rejected';
  uploadedAt: string;
  vendor?: string;
  date?: string;
  amount?: number;
  category?: string;
  policyFlags?: string[];
};

const globalAny = globalThis as any;
if (!globalAny.__RECEIPTS) {
  globalAny.__RECEIPTS = [] as ReceiptRecord[];
}

export function addReceipt(rec: ReceiptRecord) {
  globalAny.__RECEIPTS.unshift(rec);
}

export function listReceipts() {
  return [...(globalAny.__RECEIPTS as ReceiptRecord[])].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function updateReceipt(id: string, patch: Partial<ReceiptRecord>) {
  const items = globalAny.__RECEIPTS as ReceiptRecord[];
  const idx = items.findIndex((r: ReceiptRecord) => r.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...patch };
  }
}

export function clearReceipts() {
  globalAny.__RECEIPTS = [] as ReceiptRecord[];
}
