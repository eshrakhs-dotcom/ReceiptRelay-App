export default function LandingPage() {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card" style={{ padding: 26, background: 'linear-gradient(135deg,#0f1629,#0b1324)' }}>
        <div className="title" style={{ fontSize: 30, marginBottom: 8 }}>ReceiptRelay</div>
        <div className="small" style={{ color: '#c5c8d8', fontSize: 15, lineHeight: 1.6 }}>
          Hey! This workspace turns messy receipts into clean, policy-checked rows in under a minute. Upload, review, approve, export—no drama.
        </div>
        <div className="flex" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <a className="button" href="/">Inbox</a>
          <a className="button secondary" href="/upload">Upload</a>
          <a className="button secondary" href="/?status=approved">Approved</a>
          <a className="button secondary" href="/export">Export</a>
          <a className="button ghost" href="/settings/policy">Policies</a>
        </div>
      </div>

      <div className="grid two-col" style={{ gap: 14 }}>
        <div className="card" style={{ background: '#0f1118', borderColor: '#20263a' }}>
          <div className="title" style={{ fontSize: 18 }}>How to get value fast</div>
          <ol className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text)', lineHeight: 1.7 }}>
            <li>Drop a receipt on <strong>Upload</strong> (image/PDF).</li>
            <li>In <strong>Inbox</strong>, edit anything off, check flags, hit Approve.</li>
            <li>If duplicate flagged, click through and mark legitimate if needed.</li>
            <li>Head to <strong>Export</strong>, pick month, grab CSV or PDF summary.</li>
          </ol>
        </div>

        <div className="card" style={{ background: '#0f1118', borderColor: '#20263a' }}>
          <div className="title" style={{ fontSize: 18 }}>Why it’s different</div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text)', lineHeight: 1.7 }}>
            <li>Auto-OCR with sensible parsing (vendor/date/amount/tax).</li>
            <li>Policy nudges baked in: per-diem, receipt threshold, restricted categories.</li>
            <li>Duplicate detection via vendor+date+amount hash.</li>
            <li>Exports match PRD order; PDF summary with totals, categories, flag counts.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ background: '#0f1118', borderColor: '#20263a' }}>
        <div className="title" style={{ fontSize: 18 }}>Quick navigation</div>
        <div className="flex" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <a className="badge" href="/">Inbox</a>
          <a className="badge" href="/upload">Upload</a>
          <a className="badge" href="/?status=approved">Approved</a>
          <a className="badge" href="/export">Export</a>
          <a className="badge" href="/settings/policy">Policies</a>
        </div>
        <div className="small">Jump anywhere from here or the header.</div>
      </div>

      <div className="card" style={{ background: '#0f1118', borderColor: '#20263a' }}>
        <div className="title" style={{ fontSize: 18 }}>Common questions</div>
        <div className="grid" style={{ gap: 10 }}>
          <div>
            <div className="small" style={{ color: '#c5c8d8' }}>“My PDF uploaded but fields are empty?”</div>
            <div className="small">Browser OCR runs on images; PDFs are stored and can be edited manually.</div>
          </div>
          <div>
            <div className="small" style={{ color: '#c5c8d8' }}>“How are categories chosen?”</div>
            <div className="small">Vendor keywords suggest a category; you can override before approving.</div>
          </div>
          <div>
            <div className="small" style={{ color: '#c5c8d8' }}>“What’s in the CSV?”</div>
            <div className="small">date,vendor,amount,tax,currency,category,payment_method,memo,receipt_id,policy_flags,duplicate_of.</div>
          </div>
          <div>
            <div className="small" style={{ color: '#c5c8d8' }}>“What’s in the PDF?”</div>
            <div className="small">Totals, spend by category, top vendors, and flag counts for the month.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
