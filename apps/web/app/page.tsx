import Link from 'next/link';
import { DealService, ensureDevSession, getDb, getStorage } from '@fundos/core';
import { NewDealForm } from './new-deal';

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

  const deals = await new DealService(await getDb(), getStorage()).listDeals(session.workspace._id);

  return (
    <main>
      <header className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold">Decision Inbox</h1>
        <span className="text-sm text-slate-500">
          {session.workspace.fundName} · {session.user.email}
        </span>
      </header>

      <NewDealForm />

      {deals.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No deals yet. Paste a thesis, then upload a deck to see evidence-cited scoring here.
        </p>
      ) : (
        <ul className="mt-6 space-y-2" data-testid="deal-list">
          {deals.map((deal) => (
            <li key={deal._id}>
              <Link
                href={`/deals/${deal._id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white p-3 hover:border-slate-400"
              >
                <div>
                  <span className="font-medium">{deal.company}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {deal.source} · {deal.status}
                  </span>
                </div>
                <span className="text-lg font-semibold">{deal.fitScore ?? '…'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
