import type { ReactNode } from 'react';

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="mb-6 flex gap-5 text-sm font-medium text-slate-600">
        <a href="/" className="hover:text-slate-900">
          Inbox
        </a>
        <a href="/thesis" className="hover:text-slate-900">
          Thesis
        </a>
      </nav>
      {children}
    </>
  );
}
