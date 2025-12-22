import { NextResponse } from 'next/server';
import { cryptoRandomId } from '@/lib/data';
import { addReceipt, updateReceipt } from '@/lib/receiptStore';
import { evaluateReceipt } from '@/lib/policyEngine';

export const runtime = 'nodejs';

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
  if (name.includes('uber') || name.includes('lyft')) {
    return { vendor: 'Uber', date: today, amount: 22.5, category: 'rideshare', confidenceScore: 0.95 };
  }
  if (name.includes('starbucks') || name.includes('coffee')) {
    return { vendor: 'Starbucks', date: today, amount: 8.75, category: 'coffee', confidenceScore: 0.95 };
  }
  if (name.includes('marriott') || name.includes('hotel')) {
    return { vendor: 'Marriott', date: today, amount: 220.0, category: 'lodging', confidenceScore: 0.85 };
  }
  if (name.includes('wework') || name.includes('office')) {
    return { vendor: 'WeWork', date: today, amount: 130.0, category: 'office', confidenceScore: 0.85 };
  }
  return { vendor: 'Unknown Vendor', date: today, amount: 42.0, category: 'meals', confidenceScore: 0.8 };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file missing' }, { status: 400 });

    const receiptId = cryptoRandomId('rcpt');
    addReceipt({ id: receiptId, filename: file.name, status: 'processing', uploadedAt: new Date().toISOString() });

    const response = NextResponse.json({ receiptId, status: 'processing' }, { status: 201 });

    // Demo background: parse stub and apply policy in 1s.
    setTimeout(() => {
      const parsed = parseStub(file.name);
      const policy = evaluateReceipt(parsed, parsed.confidenceScore);
      updateReceipt(receiptId, {
        status: policy.decision === 'approved' ? 'approved' : 'needs_review',
        vendor: parsed.vendor,
        date: parsed.date,
        amount: parsed.amount,
        category: parsed.category,
        policyFlags: policy.flags.map((f) => f.code),
        confidenceScore: policy.confidenceScore
      });
    }, 1000);

    return response;
  } catch (err: any) {
    console.error('upload failed', err);
    return NextResponse.json({ error: err?.message || 'upload failed' }, { status: 500 });
  }
}
