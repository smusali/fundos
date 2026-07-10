'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RecalibrationDelta } from '@fundos/core';

export function CalibrationPanel({ deltas }: { deltas: RecalibrationDelta[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (deltas.length === 0) return null;

  async function approve() {
    setPending(true);
    setError(null);
    const response = await fetch('/api/calibration', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deltas }),
    });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? 'could not apply');
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-8 rounded border border-blue-200 bg-blue-50 p-4" data-testid="calibration-panel">
      <h2 className="text-lg font-medium">Recalibration proposal</h2>
      <p className="mt-1 text-sm text-slate-600">
        Computed from your recorded decisions and realized outcomes. Nothing changes until you approve.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {deltas.map((delta) => (
          <li key={delta.dimension}>
            <span className="font-medium">{delta.dimension}</span>: weight{' '}
            {delta.delta > 0 ? `+${delta.delta}` : delta.delta} (from {delta.decidedDeals} decided deal
            {delta.decidedDeals === 1 ? '' : 's'} with outcomes)
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={approve}
          disabled={pending}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          data-testid="calibration-approve"
        >
          {pending ? 'Applying…' : 'Approve and publish new rubric version'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </section>
  );
}
