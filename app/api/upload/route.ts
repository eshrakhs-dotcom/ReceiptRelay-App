import { NextResponse } from 'next/server';
import { cryptoRandomId, createReceiptWithId, ensureUser, findDuplicate, updateReceipt } from '@/lib/data';
import { evaluateReceipt } from '@/lib/policyEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParsedStub = {
  vendor?: string;
  date?: string;
  amount?: number;
  category?: string;
  tipPct?: number;
  confidenceScore: number;
};

function parseStub(filename: string): ParsedStub {
  const name = filename.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  if (name.includes('uber') || name.includes('lyft')) return { vendor: 'Uber', date: today, amount: 22.5, category: 'rideshare', confidenceScore: 0.95 };
  if (name.includes('starbucks') || name.includes('coffee')) return { vendor: 'Starbucks', date: today, amount: 8.75, category: 'coffee', confidenceScore: 0.95 };
  if (name.includes('marriott') || name.includes('hotel')) return { vendor: 'Marriott', date: today, amount: 220.0, category: 'lodging', confidenceScore: 0.85 };
  if (name.includes('wework') || name.includes('office')) return { vendor: 'WeWork', date: today, amount: 130.0, category: 'office', confidenceScore: 0.85 };
  return { vendor: 'Unknown Vendor', date: today, amount: 42.0, category: 'meals', confidenceScore: 0.8 };
}

function canCheckDuplicate(parsed: ParsedStub) {
  const vendor = (parsed.vendor || '').trim().toLowerCase();
  if (!vendor || vendor === 'unknown vendor') return false;
  if (!parsed.date) return false;
  if (parsed.amount == null) return false;
  return true;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 });

    const user = await ensureUser();
    const parsed = parseStub(file.name);
    const duplicate = canCheckDuplicate(parsed)
      ? await findDuplicate(parsed.vendor || null, parsed.date || null, parsed.amount ?? null)
      : null;
    if (duplicate) {
      return NextResponse.json({ error: 'duplicate receipt detected', status: 'duplicate' }, { status: 409 });
    }

    const receiptId = cryptoRandomId('rcpt');
    await createReceiptWithId(receiptId, user.id, `uploads/${receiptId}-${file.name}`, 'processing');
    const response = NextResponse.json({ receiptId, status: 'processing' }, { status: 201 });

    setTimeout(async () => {
      try {
        const policy = evaluateReceipt(parsed, parsed.confidenceScore, false);
        await updateReceipt(receiptId, {
          status: policy.decision === 'approved' ? 'approved' : 'needs_review',
          vendor: parsed.vendor || null,
          date: parsed.date || null,
          amount: parsed.amount ?? null,
          category: parsed.category || null,
          policy_flags: policy.flags.map((f) => f.code),
          confidence_score: policy.confidenceScore,
          memo: file.name
        });
      } catch (e) {
        console.error('background parse/policy failed', e);
      }
    }, 1200);

    return response;
  } catch (err: any) {
    console.error('upload failed', err);
    return NextResponse.json({ error: err?.message || 'upload failed' }, { status: 500 });
  }
}
