import { NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Dynamic import so TypeScript doesn't need declarations at build time.
  // @ts-expect-error pdfkit ships no types
  const { default: PDFDocument } = await import('pdfkit');

  // Tiny PDF smoke test
  const doc = new PDFDocument({ margin: 36 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  doc.on('error', (e: unknown) => console.error('PDF error:', e));

  doc.fontSize(18).text('Receipt Relay Export', { align: 'left' });
  doc.moveDown().fontSize(12).text(`Generated: ${new Date().toISOString()}`);
  doc.end();

  await new Promise<void>((resolve) => doc.on('end', () => resolve()));
  const pdf = Buffer.concat(chunks);

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="export.pdf"',
      'Cache-Control': 'no-store'
    }
  });
}
