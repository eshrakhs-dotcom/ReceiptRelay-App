import { NextResponse } from 'next/server';
import { clearReceipts, listReceipts, updateReceipt } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const data = await listReceipts(status || undefined);
  const receipts = data.map((r) => ({
    id: r.id,
    filename: r.memo || r.file_path,
    status: r.status,
    uploadedAt: r.created_at,
    vendor: r.vendor || undefined,
    date: r.date || undefined,
    amount: r.amount ?? undefined,
    category: r.category || undefined,
    policyFlags: (r.policy_flags as any[]) || [],
    confidenceScore: r.confidence_score ?? undefined
  }));
  return NextResponse.json({ receipts });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, status } = body;
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  await updateReceipt(id, { status });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearReceipts();
  return NextResponse.json({ ok: true });
}
