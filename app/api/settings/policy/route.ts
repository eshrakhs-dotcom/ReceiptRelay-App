import { NextResponse } from 'next/server';
import { ensureUser, getPolicies, upsertPolicies } from '@/lib/data';

export async function GET() {
  const user = await ensureUser();
  const policies = await getPolicies(user.id);
  return NextResponse.json(policies);
}

export async function POST(req: Request) {
  const user = await ensureUser();
  const body = await req.json();
  const saved = await upsertPolicies(user.id, {
    per_diem: Number(body.per_diem),
    receipt_required_over: Number(body.receipt_required_over),
    restricted_categories: body.restricted_categories || []
  });
  return NextResponse.json({ ok: true, policies: saved });
}
