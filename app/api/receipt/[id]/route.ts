import { NextResponse } from 'next/server';
import { getReceipt, updateReceipt } from '@/lib/data';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const quick = url.searchParams.get('quick');
  if (quick === 'approve') {
    await updateReceipt(params.id, { status: 'approved' });
    return NextResponse.redirect(new URL('/', req.url));
  }
  const receipt = await getReceipt(params.id);
  if (!receipt) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(receipt);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const payload = {
    ...body,
    amount: body.amount ? Number(body.amount) : null,
    tax: body.tax ? Number(body.tax) : null
  };
  const receipt = await updateReceipt(params.id, payload);
  return NextResponse.json({ ok: true, status: receipt.status });
}
