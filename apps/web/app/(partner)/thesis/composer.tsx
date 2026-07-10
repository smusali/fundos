'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ThesisComposer() {
  const router = useRouter();
  const [artifact, setArtifact] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const response = await fetch('/api/thesis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ artifact }),
    });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? 'compile failed');
      return;
    }
    setArtifact('');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <textarea
        value={artifact}
        onChange={(event) => setArtifact(event.target.value)}
        placeholder="Paste your thesis: a memo, bullet criteria, or guided answers"
        className="h-48 w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm"
        data-testid="thesis-artifact"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || artifact.trim().length < 20}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          data-testid="thesis-compile"
        >
          {pending ? 'Compiling…' : 'Compile rubric'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
