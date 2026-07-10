'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function WorkspaceSettingsForm({ fundName, intakeSlug }: { fundName: string; intakeSlug: string }) {
  const router = useRouter();
  const [name, setName] = useState(fundName);
  const [slug, setSlug] = useState(intakeSlug);
  const [state, setState] = useState<string | null>(null);

  async function save() {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'workspace', fundName: name, intakeSlug: slug }),
    });
    if (!response.ok) {
      const body: { error?: string } = await response.json().catch(() => ({}));
      setState(body.error ?? 'save failed');
      return;
    }
    setState('saved');
    router.refresh();
  }

  return (
    <section className="mt-6 rounded border border-slate-200 bg-white p-4" data-testid="workspace-settings">
      <h2 className="text-lg font-medium">Fund workspace</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-600">Fund name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Intake slug</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 p-2 font-mono"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Save workspace settings
        </button>
        {state ? <span className="text-sm text-slate-500">{state}</span> : null}
      </div>
    </section>
  );
}

export function UserSettingsForm({ notifyOnQueue }: { notifyOnQueue: boolean }) {
  const router = useRouter();
  const [notify, setNotify] = useState(notifyOnQueue);
  const [state, setState] = useState<string | null>(null);

  async function save() {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'user', settings: { notifyOnQueue: notify } }),
    });
    setState(response.ok ? 'saved' : 'save failed');
    router.refresh();
  }

  return (
    <section className="mt-6 rounded border border-slate-200 bg-white p-4" data-testid="user-settings">
      <h2 className="text-lg font-medium">Your settings</h2>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
        <span>Notify me when something lands in the approval queue</span>
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Save my settings
        </button>
        {state ? <span className="text-sm text-slate-500">{state}</span> : null}
      </div>
    </section>
  );
}
