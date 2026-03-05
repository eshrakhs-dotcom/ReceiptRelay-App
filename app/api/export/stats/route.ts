import { NextResponse } from 'next/server';
import { listReceipts } from '@/lib/data';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'invalid month' }, { status: 400 });
  }
  const all = await listReceipts('approved');
  const monthRows = all.filter((r) => {
    const m = ((r.date || r.created_at || '') + '').slice(0, 7);
    return r.status === 'approved' && m === month;
  });
  const approved = monthRows.length;
  const amount = monthRows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const flagged = monthRows.reduce((acc, r) => acc + ((r.policy_flags || []).length || 0), 0);
  return NextResponse.json({ month, approved, flagged, amount: Number(amount.toFixed(2)) });
}
