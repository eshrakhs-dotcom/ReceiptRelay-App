'use client';

import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      setLoading(true);
      setMessage('');
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${bodyText || res.statusText}`);
      }

      const data = await res.json();
      console.log('upload status', res.status, 'ok', res.ok, 'data', data);

      setMessage('Uploaded. Processing… (check Inbox)');
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(e);
        }}
        className="grid"
        style={{ gap: 12 }}
      >
        <div className="upload-drop">
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button className="button" type="button" onClick={handleSubmit} disabled={!file || loading}>
          {loading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {message && <div className="banner warn" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  );
}
