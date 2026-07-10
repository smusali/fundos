'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DecisionPanel({ dealId, decided }: { dealId: string; decided: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(outcome: 'pass' | 'advance' | 'invest') {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/deals/${dealId}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome, reason }),
    });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? 'could not record decision');
      return;
    }
    router.refresh();
  }

  if (decided) return null;

  return (
    <section className="mt-6 rounded border border-slate-200 bg-white p-4" data-testid="decision-panel">
      <h2 className="text-lg font-medium">Record decision</h2>
      <p className="mt-1 text-xs text-slate-500">
        The decision lands in the append-only ledger with the rubric version and evidence set you see now.
      </p>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="One-line reason"
        className="mt-3 w-full rounded border border-slate-300 p-2 text-sm"
        data-testid="decision-reason"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => record('pass')}
          disabled={pending || reason.trim().length < 3}
          className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          data-testid="decision-pass"
        >
          Pass
        </button>
        <button
          onClick={() => record('advance')}
          disabled={pending || reason.trim().length < 3}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          data-testid="decision-advance"
        >
          Advance
        </button>
        <button
          onClick={() => record('invest')}
          disabled={pending || reason.trim().length < 3}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Invest
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </section>
  );
}

const REALIZED_TYPES = ['mark-up', 'exit', 'write-off', 'follow-on'] as const;

export function OutcomePanel({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [realizedType, setRealizedType] = useState<(typeof REALIZED_TYPES)[number]>('mark-up');
  const [value, setValue] = useState('');
  const [period, setPeriod] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/deals/${dealId}/outcome`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ realizedType, value: Number(value), period }),
    });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? 'could not record outcome');
      return;
    }
    setValue('');
    setPeriod('');
    router.refresh();
  }

  return (
    <section className="mt-6 rounded border border-slate-200 bg-white p-4" data-testid="outcome-panel">
      <h2 className="text-lg font-medium">Record realized outcome</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
        <label className="block">
          <span className="text-slate-600">Type</span>
          <select
            value={realizedType}
            onChange={(event) => {
              const next = REALIZED_TYPES.find((candidate) => candidate === event.target.value);
              if (next) setRealizedType(next);
            }}
            className="mt-1 block rounded border border-slate-300 p-2"
          >
            {REALIZED_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-slate-600">Value (multiple)</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            type="number"
            step="0.1"
            min="0"
            className="mt-1 block w-28 rounded border border-slate-300 p-2"
          />
        </label>
        <label className="block">
          <span className="text-slate-600">Period</span>
          <input
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            placeholder="2027-H1"
            className="mt-1 block w-28 rounded border border-slate-300 p-2"
          />
        </label>
        <button
          onClick={record}
          disabled={pending || value === '' || period.trim().length < 2}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Record outcome
        </button>
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>
    </section>
  );
}
