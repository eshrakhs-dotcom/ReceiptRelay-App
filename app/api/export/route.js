import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // pdfkit is CommonJS; grab default if present.
  const PDFKitMod = await import('pdfkit');
  const PDFDocument = PDFKitMod.default || PDFKitMod;

  const doc = new PDFDocument({ margin: 36 });

  // Collect PDF chunks into a Buffer.
  const chunks = [];
  doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  const done = new Promise((resolve) => doc.on('end', resolve));

  // Minimal content; replace with full export later.
  doc.fontSize(16).text('Receipt Relay Export', { underline: true });
  doc.moveDown().fontSize(12).text(`Hello from your deployed app! Generated ${new Date().toISOString()}`);
  doc.end();

  await done;
  const body = Buffer.concat(chunks);

  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/pdf' }
  });
}
