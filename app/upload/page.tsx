'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage('');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON response */
      }
      if (res.ok && data.receipt_id) {
        setMessage('Uploaded. Redirecting to receipt…');
        window.location.href = `/receipt/${data.receipt_id}`;
      } else {
        const bodyText = !res.ok ? (await res.text().catch(() => '')) : '';
        setMessage(data.error || bodyText || 'Upload failed');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Upload failed. Check connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="title">Upload receipt</div>
      <p className="small">Images or PDFs. We run OCR, parse fields, and flag policies.</p>
      <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
        <div className="upload-drop">
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button className="button" type="submit" disabled={!file || loading}>
          {loading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {message && <div className="banner warn" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
