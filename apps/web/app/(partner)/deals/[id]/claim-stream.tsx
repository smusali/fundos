'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StreamedClaim {
  claim: string;
  filename: string;
  page: number;
  confidence: number;
  dimensionKey: string | null;
}

interface StreamedAssumption {
  filename: string;
  note: string;
}

export function ClaimStream({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [claims, setClaims] = useState<StreamedClaim[]>([]);
  const [assumptions, setAssumptions] = useState<StreamedAssumption[]>([]);
  const [status, setStatus] = useState<'streaming' | 'scored' | 'error'>('streaming');

  useEffect(() => {
    const source = new EventSource(`/api/deals/${dealId}/progress`);
    source.onmessage = (message: MessageEvent<string>) => {
      const event: {
        type: string;
        claim?: string;
        filename?: string;
        page?: number;
        confidence?: number;
        dimensionKey?: string | null;
        note?: string;
      } = JSON.parse(message.data);
      if (event.type === 'claim' && event.claim && event.filename && event.page !== undefined) {
        setClaims((current) => [
          ...current,
          {
            claim: event.claim ?? '',
            filename: event.filename ?? '',
            page: event.page ?? 0,
            confidence: event.confidence ?? 0,
            dimensionKey: event.dimensionKey ?? null,
          },
        ]);
      } else if (event.type === 'assumption' && event.filename && event.note) {
        setAssumptions((current) => [...current, { filename: event.filename ?? '', note: event.note ?? '' }]);
      } else if (event.type === 'scored') {
        setStatus('scored');
        source.close();
        router.refresh();
      } else if (event.type === 'error') {
        setStatus('error');
        source.close();
        router.refresh();
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [dealId, router]);

  return (
    <section className="mt-6" data-testid="claim-stream">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium">Extracted claims</h2>
        {status === 'streaming' ? (
          <span className="animate-pulse rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">streaming…</span>
        ) : null}
        {status === 'error' ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">failed</span>
        ) : null}
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {claims.map((claim, index) => (
          <li key={index} className="rounded border border-slate-200 bg-white p-2">
            <span>{claim.claim}</span>
            <span className="ml-2 text-xs text-slate-500">
              {claim.filename} · p.{claim.page} · {(claim.confidence * 100).toFixed(0)}%
              {claim.dimensionKey ? ` · ${claim.dimensionKey}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {assumptions.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-700">
          {assumptions.map((assumption, index) => (
            <li key={index}>
              ⚠ {assumption.filename}: {assumption.note}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
