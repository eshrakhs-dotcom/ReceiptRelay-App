'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState<'needs_review' | 'approved' | 'processing'>('needs_review');
  const lastHash = useRef<string>('');
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/receipts?status=${statusFilter}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      const next = data.receipts || [];
      const hash = JSON.stringify(next);
      // Only update state if changed to reduce flicker.
      if (hash !== lastHash.current) {
        lastHash.current = hash;
        setReceipts(next);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load receipts');
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const resetDemo = async () => {
    try {
      setNotice('');
      const res = await fetch('/api/reset-demo', { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || `reset failed (${res.status})`);
      setNotice(`${payload?.message || 'Reset complete'} (${payload?.remaining ?? 0} receipts remaining)`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Reset demo failed');
    }
  };

  const patchStatus = async (id: string, status: string) => {
    await fetch(`/api/receipts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
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
      {notice && <div className="card banner">{notice}</div>}
      <div className="card">
        <div className="nav">
          <button className={statusFilter === 'needs_review' ? 'button' : 'button ghost'} onClick={() => setStatusFilter('needs_review')}>
            Needs review
          </button>
          <button className={statusFilter === 'processing' ? 'button' : 'button ghost'} onClick={() => setStatusFilter('processing')}>
            Processing
          </button>
          <button className={statusFilter === 'approved' ? 'button' : 'button ghost'} onClick={() => setStatusFilter('approved')}>
            Approved
          </button>
        </div>
      </div>
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
            <div className="flex" style={{ gap: 8 }}>
              <button className="button secondary" onClick={() => patchStatus(r.id, 'approved')}>
                Approve
              </button>
              <button className="button ghost" onClick={() => patchStatus(r.id, 'rejected')}>
                Reject
              </button>
            </div>
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
