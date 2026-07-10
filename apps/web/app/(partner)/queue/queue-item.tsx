'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Approval } from '@fundos/core';

export function QueueItem({ approval, company }: { approval: Approval; company: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(approval.payload.body);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(payload: { action: 'approve' | 'reject' } | { action: 'edit'; body: string }) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/approvals/${approval._id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!response.ok) {
      const errorBody: { error?: string } = await response.json().catch(() => ({}));
      setError(errorBody.error ?? 'action failed');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <li className="rounded border border-slate-200 bg-white p-4" data-testid="queue-item">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-medium">{company}</span>
          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">{approval.actionType}</span>
          <span className="ml-2 text-xs text-slate-500">
            to {approval.payload.recipient ?? 'no recipient'} · {approval.payload.subject}
          </span>
        </div>
        <span className="text-xs text-slate-400">{approval.createdAt.toISOString()}</span>
      </div>
      {editing ? (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-3 h-40 w-full rounded border border-slate-300 p-2 font-mono text-xs"
        />
      ) : (
        <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
          {approval.payload.body}
        </pre>
      )}
      <div className="mt-3 flex items-center gap-2">
        {editing ? (
          <button
            onClick={() => void act({ action: 'edit', body })}
            disabled={pending}
            className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Save re-draft
          </button>
        ) : (
          <>
            <button
              onClick={() => void act({ action: 'approve' })}
              disabled={pending}
              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              data-testid="approve-send"
            >
              Approve & send
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={pending}
              className="rounded bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
            >
              Edit
            </button>
            <button
              onClick={() => void act({ action: 'reject' })}
              disabled={pending}
              className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Reject
            </button>
          </>
        )}
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </li>
  );
}
