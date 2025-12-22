import { NextResponse } from 'next/server';
import { createReceiptFromUpload, ensureUser, ingestOcr } from '@/lib/data';
import { getSupabaseService } from '@/lib/supabaseClient';
import { runOcr } from '@/lib/ocr';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 });

    const user = await ensureUser();
    const supabase = getSupabaseService();
    const receiptId = await createReceiptFromUpload('', user.id);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split('.').pop() || 'bin';
    const path = `uploads/${receiptId}.${ext}`;

    const uploadToSupabase = async () => {
      const { error } = await supabase.storage
        .from('receipts')
        .upload(path, buffer, { upsert: true, contentType: file.type || 'application/octet-stream' });
      return error;
    };

    let uploaded = false;
    try {
      let err = await uploadToSupabase();
      if (err && err.message?.toLowerCase().includes('not found')) {
        await supabase.storage.createBucket('receipts', { public: true, fileSizeLimit: 50 * 1024 * 1024 });
        err = await uploadToSupabase();
      }
      if (err) throw err;
      uploaded = true;
    } catch (uploadErr: any) {
      console.warn('Supabase storage unavailable, falling back to local stub:', uploadErr?.message);
    }

    // OCR: skip PDFs to avoid runtime errors; use OCR only for images.
    let text = '';
    if (!file.type.includes('pdf')) {
      try {
        text = await runOcr(buffer);
      } catch (ocrErr) {
        console.warn('OCR failed, continuing without text', ocrErr);
      }
    }

    // Fire-and-forget ingest to avoid blocking response; inbox row is already created.
    ingestOcr(receiptId, text, uploaded ? path : `local-fallback/${receiptId}.${ext}`, user.id).catch((e) =>
      console.warn('ingest failed', e)
    );

    return NextResponse.json({ receipt_id: receiptId, status: 'inbox', uploaded }, { status: 201 });
  } catch (err: any) {
    console.error('upload failed', err);
    return NextResponse.json({ error: err?.message || 'upload failed' }, { status: 500 });
  }
}
