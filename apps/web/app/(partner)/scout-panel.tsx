'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ScoutPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!enabled) {
    return (
      <span className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-500" data-testid="scout-disabled">
        Scout disabled: add EXA_API_KEY to enable thesis-driven discovery
      </span>
    );
  }

  async function run() {
    setPending(true);
    setMessage(null);
    const response = await fetch('/api/scout', { method: 'POST' });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setMessage(body.error ?? 'scout failed');
      return;
    }
    const body: { surfaced: number } = await response.json();
    setMessage(`${body.surfaced} candidates surfaced`);
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        data-testid="scout-run"
      >
        {pending ? 'Scouting…' : 'Run scout'}
      </button>
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
    </span>
  );
}
