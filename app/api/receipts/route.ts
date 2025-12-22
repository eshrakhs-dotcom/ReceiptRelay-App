import { NextResponse } from 'next/server';
import { listReceipts, updateReceipt } from '@/lib/receiptStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const receipts = listReceipts();
  return NextResponse.json({ receipts });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, status } = body;
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  updateReceipt(id, { status });
  return NextResponse.json({ ok: true });
}
