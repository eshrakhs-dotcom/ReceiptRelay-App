import Link from 'next/link';
import ReceiptCard from '@/components/ReceiptCard';
import { ensureUser, getReceipts } from '@/lib/data';

export default async function Home({ searchParams }: { searchParams?: { status?: string } }) {
  const status = (searchParams?.status as 'inbox' | 'approved') || 'inbox';
  await ensureUser();
  const receipts = await getReceipts(status);

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
        <div className="nav">
          <Link href="/?status=inbox" className={status === 'inbox' ? 'active' : ''}>Inbox</Link>
          <Link href="/?status=approved" className={status === 'approved' ? 'active' : ''}>Approved</Link>
        </div>
      </div>
      <div className="grid two-col">
        {receipts.length === 0 && <div className="card">No receipts yet. Upload to get started.</div>}
        {receipts.map((r) => (
          <ReceiptCard key={r.id} receipt={r} />
        ))}
      </div>
    </div>
  );
}
