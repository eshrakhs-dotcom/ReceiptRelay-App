import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { Metadata } from 'next';

const font = Plus_Jakarta_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ReceiptRelay',
  description: 'Turn receipts into clean, policy-checked expense rows fast.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.className}>
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="logo-mark">RR</div>
            <div className="topbar-copy">
              <div className="title">ReceiptRelay</div>
              <div className="subtitle">Receipts → approvals → export in under a minute.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a className="ghost" href="/landing">Guide</a>
              <a className="ghost" href="/settings/policy">Policies</a>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
