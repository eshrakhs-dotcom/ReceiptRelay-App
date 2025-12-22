import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function fetchReceipts() {
  const base =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;
  const res = await fetch(`${base}/api/receipts`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return json.receipts || [];
}

export default async function Home() {
  const receipts = await fetchReceipts();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="flex space-between" style={{ marginBottom: 12 }}>
          <div>
            <div className="title">Inbox</div>
            <div className="small">Upload receipts, review flags, approve fast.</div>
          </div>
          <div className="flex" style={{ gap: 10 }}>
            <Link className="button secondary" href="/upload">Upload</Link>
            <Link className="button" href="/export">Export</Link>
          </div>
        </div>
      </div>
      <div className="grid two-col">
        {receipts.length === 0 && <div className="card">No receipts yet. Upload to get started.</div>}
        {receipts.map((r: any) => (
          <div key={r.id} className="card" style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700 }}>{r.filename || r.id}</div>
            <div className="small">Status: {r.status}</div>
            <div className="small">Uploaded: {r.uploadedAt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
