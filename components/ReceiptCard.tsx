'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { daysSince } from '@/lib/parse';
import { ReceiptRow } from '@/lib/types';

export default function ReceiptCard({ receipt }: { receipt: ReceiptRow }) {
  const [isPending, startTransition] = useTransition();
  const flags = receipt.policy_flags || [];
  const age = daysSince(receipt.date);
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div className="flex space-between">
        <div>
          <div style={{ fontWeight: 700 }}>{receipt.vendor || 'Unknown vendor'}</div>
          <div className="small">{receipt.date || 'Unknown date'} • ${receipt.amount?.toFixed(2) || '0.00'} • {receipt.category || 'Uncategorized'}</div>
        </div>
        <div className="flex" style={{ gap: 6 }}>
          {flags.map((f) => (
            <span key={f} className="badge small">{f.replace(/_/g, ' ')}</span>
          ))}
          {receipt.duplicate_of && <span className="badge small" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>duplicate</span>}
        </div>
      </div>
      {age !== null && age > 14 && <div className="banner warn">Stale: {age} days old</div>}
      <div className="flex space-between">
        <Link href={`/receipt/${receipt.id}`} className="button secondary">Review</Link>
        <button className="button" onClick={() => startTransition(() => window.location.assign(`/api/receipt/${receipt.id}?quick=approve`))} disabled={isPending}>
          {isPending ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </div>
  );
}
