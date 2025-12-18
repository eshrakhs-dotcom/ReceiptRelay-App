import Link from 'next/link';
import { ensureUser, getReceipt, updateReceipt } from '@/lib/data';
import { evaluatePolicies } from '@/lib/parse';
import { getPolicies } from '@/lib/data';
import { ReceiptRow } from '@/lib/types';

export default async function ReceiptDetail({ params }: { params: { id: string } }) {
  await ensureUser();
  const receipt = await getReceipt(params.id);
  if (!receipt) {
    return <div className="card">Not found</div>;
  }
  const policies = await getPolicies(receipt.user_id);
  const flags = policies ? evaluatePolicies(receipt, policies) : {};

  async function approveAction(formData: FormData) {
    'use server';
    const payload: Partial<ReceiptRow> = {
      date: formData.get('date') as string,
      vendor: formData.get('vendor') as string,
      amount: Number(formData.get('amount')),
      tax: Number(formData.get('tax')),
      currency: (formData.get('currency') as string) || 'USD',
      category: formData.get('category') as string,
      payment_method: formData.get('payment_method') as string,
      memo: formData.get('memo') as string,
      status: 'approved'
    };
    await updateReceipt(params.id, payload);
  }

  async function rejectAction() {
    'use server';
    await updateReceipt(params.id, { status: 'rejected' });
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="flex space-between">
          <div>
            <div className="title">Receipt {receipt.id}</div>
            <div className="small">Uploaded {new Date(receipt.created_at).toLocaleString()}</div>
          </div>
          <Link href="/" className="button secondary">Back</Link>
        </div>
        <div className="flex" style={{ gap: 8, marginTop: 10 }}>
          {receipt.policy_flags?.map((f) => (
            <span key={f} className="badge">{f}</span>
          ))}
          {receipt.duplicate_of && <span className="badge" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Duplicate of {receipt.duplicate_of}</span>}
        </div>
      </div>

      <form action={approveAction} className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="two-col grid">
          <div className="form-row">
            <label>Date</label>
            <input name="date" defaultValue={receipt.date || ''} required />
          </div>
          <div className="form-row">
            <label>Vendor</label>
            <input name="vendor" defaultValue={receipt.vendor || ''} required />
          </div>
          <div className="form-row">
            <label>Amount</label>
            <input name="amount" type="number" step="0.01" defaultValue={receipt.amount ?? 0} required />
          </div>
          <div className="form-row">
            <label>Tax</label>
            <input name="tax" type="number" step="0.01" defaultValue={receipt.tax ?? 0} />
          </div>
          <div className="form-row">
            <label>Currency</label>
            <input name="currency" defaultValue={receipt.currency || 'USD'} />
          </div>
          <div className="form-row">
            <label>Category</label>
            <input name="category" defaultValue={receipt.category || ''} />
          </div>
          <div className="form-row">
            <label>Payment Method</label>
            <input name="payment_method" defaultValue={receipt.payment_method || ''} />
          </div>
          <div className="form-row">
            <label>Memo</label>
            <input name="memo" defaultValue={receipt.memo || ''} />
          </div>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          <button className="button" type="submit">Approve</button>
          <button className="button ghost" formAction={rejectAction}>Reject</button>
        </div>
      </form>

      <div className="card">
        <div className="title">Flags</div>
        <div className="grid" style={{ gap: 8 }}>
          {Object.keys(flags).length === 0 && <div className="small">No policy issues.</div>}
          {Object.entries(flags).map(([k, v]) => v && <div key={k} className="banner warn">{k.replace(/_/g, ' ')}</div>)}
        </div>
      </div>
    </div>
  );
}
