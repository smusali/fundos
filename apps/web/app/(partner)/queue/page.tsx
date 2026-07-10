import { ApprovalService, DealRepository, getDb, OutboundService } from '@fundos/core';
import { QueueItem } from './queue-item';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const { workspace } = await currentSession();
  const db = await getDb();
  const pending = await new ApprovalService(db).listPending(workspace._id);
  const deals = new DealRepository(db);
  const companies = new Map<string, string>();
  for (const approval of pending) {
    if (!companies.has(approval.dealId)) {
      const deal = await deals.findById(approval.dealId);
      companies.set(approval.dealId, deal?.company ?? approval.dealId);
    }
  }
  const outbox = await new OutboundService().listOutbox();

  return (
    <main>
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold">Approval queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every founder-facing message pauses here. Approve sends, edit re-drafts, reject leaves only the ledger row.
        </p>
      </header>

      {pending.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nothing waiting for approval.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {pending.map((approval) => (
            <QueueItem key={approval._id} approval={approval} company={companies.get(approval.dealId) ?? ''} />
          ))}
        </ul>
      )}

      {outbox.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Outbox (local, no mail credentials)</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600" data-testid="outbox-list">
            {outbox.map((message) => (
              <li key={message.approvalId}>
                {message.deliveredAt} · to {message.recipient} · {message.subject}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
