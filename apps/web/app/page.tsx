import { ensureDevSession } from '@fundos/core';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  let session;
  try {
    session = await ensureDevSession();
  } catch (error) {
    console.error('dev session unavailable', error);
    return (
      <main>
        <h1 className="text-2xl font-semibold">fundos</h1>
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          MongoDB is unreachable. Start the local stores with{' '}
          <code className="font-mono">docker compose up -d</code> and reload.
        </p>
      </main>
    );
  }

  return (
    <main>
      <header className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold">Decision Inbox</h1>
        <span className="text-sm text-slate-500">
          {session.workspace.fundName} · {session.user.email}
        </span>
      </header>
      <p className="mt-6 text-sm text-slate-500">
        No deals yet. Paste a thesis and upload a deck to see evidence-cited scoring here.
      </p>
    </main>
  );
}
