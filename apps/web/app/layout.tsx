import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'fundos',
  description: 'The system-of-record for AI-influenced investment decisions',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <nav className="mb-6 flex gap-5 text-sm font-medium text-slate-600">
            <a href="/" className="hover:text-slate-900">
              Inbox
            </a>
            <a href="/thesis" className="hover:text-slate-900">
              Thesis
            </a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
