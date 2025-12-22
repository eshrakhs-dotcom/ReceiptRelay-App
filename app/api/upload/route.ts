import { NextResponse } from 'next/server';
import { createReceiptFromUpload, ensureUser, ingestOcr, cryptoRandomId } from '@/lib/data';
import { getSupabaseService } from '@/lib/supabaseClient';
import { runOcr } from '@/lib/ocr';
import { addReceipt } from '@/lib/receiptStore';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 });

    const receiptId = cryptoRandomId('rcpt');
    addReceipt({ id: receiptId, filename: file.name, status: 'processing', uploadedAt: new Date().toISOString() });

    // Respond immediately to avoid pending UI.
    const response = NextResponse.json({ receiptId, status: 'processing' }, { status: 201 });

    // Background work: best-effort store + OCR + ingest.
    (async () => {
      try {
        const user = await ensureUser();
        const supabase = getSupabaseService();
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

        let text = '';
        if (!file.type.includes('pdf')) {
          try {
            text = await runOcr(buffer);
          } catch (ocrErr) {
            console.warn('OCR failed, continuing without text', ocrErr);
          }
        }

        try {
          await createReceiptFromUpload(uploaded ? path : `local-fallback/${receiptId}.${ext}`, user.id);
        } catch (e) {
          console.warn('createReceiptFromUpload failed', e);
        }

        ingestOcr(receiptId, text, uploaded ? path : `local-fallback/${receiptId}.${ext}`, user.id).catch((e) =>
          console.warn('ingest failed', e)
        );
      } catch (bgErr) {
        console.error('upload background processing failed', bgErr);
      }
    })();

    return response;
  } catch (err: any) {
    console.error('upload failed', err);
    return NextResponse.json({ error: err?.message || 'upload failed' }, { status: 500 });
  }
}
