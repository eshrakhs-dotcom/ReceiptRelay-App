import Link from 'next/link';
import InboxList from '@/components/InboxList';

export const dynamic = 'force-dynamic';

export default function Home() {
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
      <InboxList />
    </div>
  );
}
