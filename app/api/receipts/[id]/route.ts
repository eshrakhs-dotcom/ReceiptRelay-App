import { NextResponse } from 'next/server';
import { updateReceipt } from '@/lib/receiptStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { status } = body;
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });
  const updated = updateReceipt(params.id, { status });
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
