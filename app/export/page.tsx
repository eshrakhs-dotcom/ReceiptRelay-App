'use client';

import { useEffect, useMemo, useState } from 'react';

type Summary = { count: number; flags: number } | null;

export default function ExportPage() {
  const [month, setMonth] = useState('');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [summary, setSummary] = useState<Summary>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const validMonth = useMemo(() => /^\d{4}-\d{2}$/.test(month), [month]);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      if (!validMonth) {
        setSummary(null);
        return;
      }
      setLoading(true);
      const res = await fetch(`/api/export/stats?month=${month}`);
      if (!res.ok) {
        setSummary(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const count = data.approved || 0;
      const flags = data.flagged || 0;
      if (!cancelled) {
        setSummary({ count, flags });
        setLoading(false);
      }
    }
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [month, validMonth]);

  async function handleExport() {
    if (!validMonth) return;
    setMessage('');
    const res = await fetch(`/api/export?month=${month}&format=${format}`);
    if (!res.ok) {
      const text = await res.text();
      setMessage(text || 'No approved receipts for this month.');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${month}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <div className="title">Export</div>
      <p className="small">CSV (exact column order) or PDF summary with totals, spend by category, and flag counts.</p>
      <div className="form-row">
        <label>Month (YYYY-MM)</label>
        <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="2025-02" />
      </div>
      <div className="form-row">
        <label>Format</label>
        <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      {validMonth && !loading && summary && (
        <div className="small">
          {summary.count > 0
            ? `${summary.count} approved receipts, ${summary.flags} flags`
            : `No approved receipts for ${month}. Upload or change month.`}
        </div>
      )}
      {!validMonth && <div className="small">Enter month as YYYY-MM (e.g., 2025-02).</div>}
      {message && <div className="banner warn">{message}</div>}
      <button className="button" onClick={handleExport} disabled={!validMonth || loading}>
        {loading ? 'Checking…' : 'Download'}
      </button>
    </div>
  );
}
