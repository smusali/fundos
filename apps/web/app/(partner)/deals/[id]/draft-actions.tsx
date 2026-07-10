'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const DRAFT_TYPES = [
  { type: 'memo', label: 'Draft IC memo' },
  { type: 'pass_note', label: 'Draft pass note' },
  { type: 'advance_request', label: 'Request materials' },
] as const;

export function DraftActions({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function draft(type: (typeof DRAFT_TYPES)[number]['type']) {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/deals/${dealId}/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setMessage(body.error ?? 'draft failed');
      return;
    }
    setMessage(type === 'memo' ? 'Memo drafted' : 'Draft waiting in the approval queue');
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="draft-actions">
      {DRAFT_TYPES.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => void draft(type)}
          disabled={pending}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-500 disabled:opacity-40"
        >
          {label}
        </button>
      ))}
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </div>
  );
}
