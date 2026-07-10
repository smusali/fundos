'use client';

import { useRef, useState } from 'react';

export function IntakeForm({ slug }: { slug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    setState('pending');
    setError(null);
    const response = await fetch(`/api/intake/${slug}`, {
      method: 'POST',
      body: new FormData(formRef.current),
    });
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? 'submission failed');
      setState('idle');
      return;
    }
    setState('done');
  }

  if (state === 'done') {
    return (
      <p className="mt-6 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="intake-done">
        Thanks, your submission is in. The team reviews every screened submission.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-6 space-y-3 rounded border border-slate-200 bg-white p-4">
      <label className="block text-sm">
        <span className="text-slate-600">Company</span>
        <input name="company" required className="mt-1 w-full rounded border border-slate-300 p-2" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">Your name</span>
          <input name="founderName" required className="mt-1 w-full rounded border border-slate-300 p-2" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Email</span>
          <input name="founderEmail" type="email" required className="mt-1 w-full rounded border border-slate-300 p-2" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-slate-600">What are you building? (2-3 sentences)</span>
        <textarea name="summary" required className="mt-1 h-24 w-full rounded border border-slate-300 p-2" />
      </label>
      <label className="block text-sm">
        <span className="text-slate-600">Deck PDF</span>
        <input name="deck" type="file" accept="application/pdf" required className="mt-1 w-full" />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === 'pending'}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {state === 'pending' ? 'Submitting…' : 'Submit'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}
