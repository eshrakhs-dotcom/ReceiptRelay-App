import { NextResponse } from 'next/server';
import { listReceipts } from '@/lib/receiptStore';

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
  const approved = listReceipts().filter((r) => r.status === 'approved');
  if (!approved.length) {
    return NextResponse.json({ error: 'no approved receipts' }, { status: 400 });
  }
  if (format === 'csv') {
    const csv = toCsv(approved);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="export.csv"'
      }
    });
  }
  // Simple PDF-less fallback for now.
  return NextResponse.json({ ok: true, count: approved.length, message: 'PDF export not implemented in demo' });
}
