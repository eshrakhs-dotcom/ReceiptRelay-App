import { NextResponse } from 'next/server';
import { suggestCategory } from '@/lib/parse';

export async function POST(req: Request) {
  if (process.env.LLM_ENABLED !== 'true') {
    return NextResponse.json({ error: 'LLM disabled' }, { status: 403 });
  }
  const body = await req.json();
  const suggestion = suggestCategory(body.vendor || '') || 'Uncategorized';
  return NextResponse.json({ category: suggestion, confidence: 0.42, explanation: 'Rule-based suggestion' });
}
