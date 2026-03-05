import { NextResponse } from 'next/server';
import { listReceipts } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toCsv(rows) {
  const header = 'date,vendor,amount,tax,currency,category,payment_method,memo,receipt_id,policy_flags,duplicate_of';
  const body = rows
    .map((r) =>
      [
        r.date || '',
        r.vendor || '',
        r.amount ?? '',
        r.tax ?? '',
        r.currency || 'USD',
        r.category || '',
        r.payment_method || '',
        '',
        r.id,
        JSON.stringify(r.policyFlags || []),
        ''
      ].join(',')
    )
    .join('\n');
  return `${header}\n${body}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const month = url.searchParams.get('month');
  const rows = await listReceipts('approved');
  const approved = rows.filter((r) => {
    if (r.status !== 'approved') return false;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const m = ((r.date || r.created_at || '') + '').slice(0, 7);
      return m === month;
    }
    return true;
  }).map((r) => ({
    ...r,
    uploadedAt: r.created_at,
    policyFlags: r.policy_flags || []
  }));
  if (!approved.length) {
    return NextResponse.json({ error: 'no approved receipts' }, { status: 400 });
  }
  if (format === 'csv') {
    const csv = toCsv(approved);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="export_${month || 'all'}.csv"`
      }
    });
  }
  return NextResponse.json({ ok: true, count: approved.length, message: 'PDF export not implemented in demo' });
}
