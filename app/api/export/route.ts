import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { getSupabaseService } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

async function fetchMonth(month: string) {
  const supabase = getSupabaseService();
  const { data } = await supabase
    .from('receipts')
    .select('*')
    .eq('status', 'approved')
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`)
    .order('date', { ascending: true });
  return data || [];
}

function toCsv(rows: any[]) {
  const header = 'date,vendor,amount,tax,currency,category,payment_method,memo,receipt_id,policy_flags,duplicate_of';
  const body = rows
    .map((r) => [
      r.date || '',
      r.vendor || '',
      r.amount ?? '',
      r.tax ?? '',
      r.currency || 'USD',
      r.category || '',
      r.payment_method || '',
      (r.memo || '').replace(/"/g, '""'),
      r.id,
      JSON.stringify(r.policy_flags || []),
      r.duplicate_of || ''
    ].map((v) => `${v}`).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function toPdf(rows: any[], month: string) {
  const doc = new PDFDocument({ margin: 40 });
  const buffers: Buffer[] = [];
  doc.on('data', (b) => buffers.push(b));
  doc.fontSize(18).text(`ReceiptRelay Summary – ${month}`, { underline: true });

  const total = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const tax = rows.reduce((acc, r) => acc + (Number(r.tax) || 0), 0);
  doc.moveDown().fontSize(12).text(`Totals: $${total.toFixed(2)} (tax $${tax.toFixed(2)})`);

  const byCategory: Record<string, number> = {};
  const byVendor: Record<string, number> = {};
  const flagCounts: Record<string, number> = {};
  rows.forEach((r) => {
    const cat = r.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + (Number(r.amount) || 0);
    const vendor = r.vendor || 'Unknown';
    byVendor[vendor] = (byVendor[vendor] || 0) + (Number(r.amount) || 0);
    (r.policy_flags || []).forEach((f: string) => {
      flagCounts[f] = (flagCounts[f] || 0) + 1;
    });
  });

  const renderTable = (title: string, rows: [string, string | number][]) => {
    doc.moveDown().fontSize(14).text(title);
    doc.moveDown(0.3);
    rows.forEach(([k, v]) => doc.fontSize(11).text(`${k}: ${v}`));
  };

  renderTable('Spend by category', Object.entries(byCategory));
  renderTable('Top vendors', Object.entries(byVendor));
  renderTable('Flags', Object.entries(flagCounts));

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const format = (searchParams.get('format') || 'csv') as 'csv' | 'pdf';
  if (!month || !/\d{4}-\d{2}/.test(month)) return NextResponse.json({ error: 'invalid month' }, { status: 400 });

  const rows = await fetchMonth(month);
  if (!rows.length) return NextResponse.json({ error: 'no receipts in month' }, { status: 404 });

  if (format === 'pdf') {
    const pdf = await toPdf(rows, month);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="export_${month}.pdf"`
      }
    });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="export_${month}.csv"`
    }
  });
}
