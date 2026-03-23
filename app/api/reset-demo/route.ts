import { NextResponse } from 'next/server';
import { clearReceipts, listReceipts } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await clearReceipts();
    const remaining = await listReceipts();
    return NextResponse.json({ ok: true, message: 'Demo reset complete', remaining: remaining.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'reset failed' }, { status: 500 });
  }
}
