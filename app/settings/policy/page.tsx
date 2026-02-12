export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { ensureUser, getPolicies, upsertPolicies } from '@/lib/data';

export default async function PolicyPage() {
  let user: any = null;
  let policies: any = null;
  try {
    user = await ensureUser();
    policies = await getPolicies(user.id);
  } catch (err) {
    return (
      <div className="card">
        <div className="title">Policies</div>
        <p className="small">
          Policies are unavailable. Ensure Supabase env vars (URL, anon, service role) are set in this deployment, then redeploy.
        </p>
      </div>
    );
  }
  const restricted =
    typeof policies?.restricted_categories === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(policies.restricted_categories);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : policies?.restricted_categories || [];

  async function savePolicy(formData: FormData) {
    'use server';
    if (!user) return;
    await upsertPolicies(user.id, {
      per_diem: Number(formData.get('per_diem')),
      receipt_required_over: Number(formData.get('receipt_required_over')),
      restricted_categories: (formData.get('restricted_categories') as string).split(',').map((v) => v.trim()).filter(Boolean)
    });
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <div className="title">Policies</div>
      <p className="small">Limit scope to two checks: per-diem for Meals and receipt threshold.</p>
      <form action={savePolicy} className="grid two-col" style={{ gap: 12 }}>
        <div className="form-row">
          <label>Per-diem (Meals)</label>
          <input name="per_diem" type="number" step="0.01" defaultValue={policies?.per_diem ?? 60} required />
        </div>
        <div className="form-row">
          <label>Receipt required over</label>
          <input name="receipt_required_over" type="number" step="0.01" defaultValue={policies?.receipt_required_over ?? 25} required />
        </div>
        <div className="form-row" style={{ gridColumn: '1 / span 2' }}>
          <label>Restricted categories (comma separated)</label>
          <input name="restricted_categories" defaultValue={restricted.join(', ')} />
        </div>
        <button className="button" type="submit">Save</button>
      </form>
    </div>
  );
}
