'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export function NewDealForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    setPending(true);
    setError(null);
    const response = await fetch('/api/deals', { method: 'POST', body: new FormData(formRef.current) });
    setPending(false);
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setError(body.error ?? 'upload failed');
      return;
    }
    const { dealId }: { dealId: string } = await response.json();
    router.push(`/deals/${dealId}`);
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-6 rounded border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium">New deal</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">Company</span>
          <input
            name="company"
            required
            className="mt-1 w-full rounded border border-slate-300 p-2"
            data-testid="deal-company"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Deck PDF</span>
          <input name="deck" type="file" accept="application/pdf" required className="mt-1 w-full" data-testid="deal-deck" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-slate-600">Data room PDFs (optional, multiple)</span>
          <input name="dataroom" type="file" accept="application/pdf" multiple className="mt-1 w-full" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          data-testid="deal-submit"
        >
          {pending ? 'Uploading…' : 'Upload & score'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}
