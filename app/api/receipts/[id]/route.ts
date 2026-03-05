import { NextResponse } from 'next/server';
import { getReceipt, updateReceipt } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { status } = body;
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });
  const existing = await getReceipt(params.id);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const updated = await updateReceipt(params.id, { status });
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
