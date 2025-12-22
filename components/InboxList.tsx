'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Receipt = {
  id: string;
  filename: string;
  status: string;
  uploadedAt: string;
  vendor?: string;
  date?: string;
  amount?: number;
  category?: string;
  policyFlags?: string[];
};

export default function InboxList() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/receipts', { cache: 'no-store' });
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      setReceipts(data.receipts || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const resetDemo = async () => {
    await fetch('/api/receipts', { method: 'DELETE' });
    load();
  };

  const statusColor = (status: string) => {
    if (status === 'processing') return 'var(--warn)';
    if (status === 'needs_review') return 'var(--accent)';
    if (status === 'approved') return '#6ae06a';
    if (status === 'rejected') return 'var(--danger)';
    return 'var(--muted)';
  };

  return (
    <div className="grid two-col">
      {loading && <div className="card">Loading…</div>}
      {error && <div className="card banner warn">{error}</div>}
      {receipts.length === 0 && !loading && <div className="card">No receipts yet. Upload to get started.</div>}
      {receipts.map((r) => (
        <div key={r.id} className="card" style={{ display: 'grid', gap: 6 }}>
          <div className="flex space-between">
            <div style={{ fontWeight: 700 }}>{r.vendor || r.filename || r.id}</div>
            <span className="badge small" style={{ color: statusColor(r.status) }}>
              {r.status}
            </span>
          </div>
          <div className="small">
            {r.date || 'Unknown date'} • ${r.amount ?? '—'} • {r.category || 'Uncategorized'}
          </div>
          {r.policyFlags && r.policyFlags.length > 0 && (
            <div className="small">Flags: {r.policyFlags.join(', ')}</div>
          )}
          {r.status === 'needs_review' && (
            <Link href={`/receipt/${r.id}`} className="button secondary">
              Open
            </Link>
          )}
        </div>
      ))}
      <div className="card">
        <button className="button ghost" onClick={load} style={{ marginRight: 8 }}>
          Refresh
        </button>
        <button className="button secondary" onClick={resetDemo}>
          Reset demo
        </button>
      </div>
    </div>
  );
}
