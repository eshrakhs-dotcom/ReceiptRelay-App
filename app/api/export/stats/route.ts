import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabaseClient';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'invalid month' }, { status: 400 });
  }
  const supabase = getSupabaseService();
  const { data, error } = await supabase
    .from('receipts')
    .select('id, amount, policy_flags, date, status, category')
    .eq('status', 'approved')
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = data || [];
  const approved = rows.length;
  const amount = rows.reduce((acc, r) => acc + (Number((r as any).amount) || 0), 0);
  const flagged = rows.reduce((acc, r) => {
    const flags = ((r as any).policy_flags as any[]) || [];
    return acc + flags.length;
  }, 0);
  return NextResponse.json({ month, approved, flagged, amount: Number(amount.toFixed(2)) });
}
