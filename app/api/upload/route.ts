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

    let uploadError = null;
    // try upload; if bucket missing, create then retry
    const attemptUpload = async () => {
      const { error } = await supabase.storage
        .from('receipts')
        .upload(path, buffer, { upsert: true, contentType: file.type || 'application/octet-stream' });
      return error;
    };

    uploadError = await attemptUpload();
    if (uploadError && uploadError.message?.toLowerCase().includes('not found')) {
      await supabase.storage.createBucket('receipts', { public: true, fileSizeLimit: 50 * 1024 * 1024 });
      uploadError = await attemptUpload();
    }
    if (uploadError) {
      console.error('storage upload failed', uploadError);
      return NextResponse.json({ error: `upload failed (storage): ${uploadError.message}` }, { status: 500 });
    }

    // OCR: skip PDFs to avoid runtime errors; use OCR only for images.
    let text = '';
    if (!file.type.includes('pdf')) {
      text = await runOcr(buffer);
    }
    await ingestOcr(receiptId, text, path, user.id);

    return NextResponse.json({ receipt_id: receiptId, status: 'inbox' }, { status: 201 });
  } catch (err: any) {
    console.error('upload failed', err);
    return NextResponse.json({ error: err?.message || 'upload failed' }, { status: 500 });
  }
}
