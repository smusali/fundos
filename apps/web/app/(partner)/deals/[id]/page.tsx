import { notFound } from 'next/navigation';
import { DealService, getDb, getStorage, LedgerService, type Evidence } from '@fundos/core';
import { ClaimStream } from './claim-stream';
import { DecisionPanel, OutcomePanel } from './decision-panel';

export const dynamic = 'force-dynamic';

function confidenceLabel(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const service = new DealService(db, getStorage());
  const deal = await service.getDeal(id);
  if (!deal) notFound();

  const documents = await service.listDocuments(id);
  const evidence = await service.listEvidence(id);
  const evidenceById = new Map<string, Evidence>(evidence.map((item) => [item._id, item]));
  const documentNames = new Map(documents.map((document) => [document._id, document.filename]));
  const ledger = new LedgerService(db);
  let decisions: Awaited<ReturnType<LedgerService['decisionsForDeal']>> = [];
  let outcomes: Awaited<ReturnType<LedgerService['outcomesForDeal']>> = [];
  if (deal.status !== 'processing') {
    try {
      [decisions, outcomes] = await Promise.all([ledger.decisionsForDeal(id), ledger.outcomesForDeal(id)]);
    } catch (error) {
      console.error(`ledger unavailable for deal ${id}`, error);
    }
  }
  const decided = decisions.length > 0;

  return (
    <main>
      <header className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">{deal.company}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {documents.length} document{documents.length === 1 ? '' : 's'} · source: {deal.source} · status:{' '}
            {deal.status}
          </p>
          {deal.founder ? (
            <p className="mt-1 text-sm text-slate-500" data-testid="founder-contact">
              Founder: {deal.founder.name} ({deal.founder.email}) · {deal.founder.summary}
            </p>
          ) : null}
        </div>
        {deal.fitScore !== null ? (
          <div className="text-right" data-testid="fit-score">
            <div className="text-3xl font-semibold">{deal.fitScore}</div>
            <div className="text-xs text-slate-500">Fit Score · rubric v{deal.thesisVersion}</div>
          </div>
        ) : null}
      </header>

      {deal.status === 'processing' ? <ClaimStream dealId={deal._id} /> : null}

      {deal.breakdown ? (
        <section className="mt-6" data-testid="score-breakdown">
          <h2 className="text-lg font-medium">Dimension breakdown</h2>
          <div className="mt-3 space-y-4">
            {deal.breakdown.dimensions.map((dimension) => (
              <div key={dimension.key} className="rounded border border-slate-200 bg-white p-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">{dimension.label}</h3>
                  <span className="text-sm">
                    {dimension.score} <span className="text-xs text-slate-500">(weight {dimension.weight})</span>
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {dimension.evidenceIds.map((evidenceId) => {
                    const item = evidenceById.get(evidenceId);
                    if (!item) return null;
                    return (
                      <li key={evidenceId}>
                        {item.claim}{' '}
                        <span className="text-xs text-slate-400">
                          [{documentNames.get(item.documentId) ?? 'document'} · p.{item.pageRef.page} ·{' '}
                          {confidenceLabel(item.confidence)}]
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {dimension.assumptions.map((assumption) => (
                  <p key={assumption} className="mt-2 text-sm text-amber-700">
                    ⚠ {assumption}
                  </p>
                ))}
              </div>
            ))}
          </div>
          {deal.breakdown.assumptions.length > 0 ? (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-medium text-amber-800">Assumptions</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-700">
                {deal.breakdown.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {deal.status !== 'processing' ? <DecisionPanel dealId={deal._id} decided={decided} /> : null}

      {decisions.length > 0 ? (
        <section className="mt-6 rounded border border-slate-200 bg-white p-4" data-testid="ledger-decisions">
          <h2 className="text-lg font-medium">Ledger</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {decisions.map((decision) => (
              <li key={decision.ts}>
                <span className="font-medium uppercase">{decision.outcome}</span> by {decision.decidedBy} ·{' '}
                {decision.reason} · rubric v{decision.thesisVersion} · {decision.ts} · evidence{' '}
                <span className="font-mono text-xs">{decision.evidenceHash.slice(0, 12)}</span>
              </li>
            ))}
            {outcomes.map((outcome) => (
              <li key={outcome.ts} className="text-slate-500">
                outcome: {outcome.realizedType} · value {outcome.value} · {outcome.period} · {outcome.ts}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            Provenance export:{' '}
            <a href={`/api/deals/${deal._id}/provenance`} className="text-blue-700 underline" download>
              JSON
            </a>{' '}
            ·{' '}
            <a href={`/api/deals/${deal._id}/provenance?format=pdf`} className="text-blue-700 underline" download>
              PDF
            </a>
          </p>
        </section>
      ) : null}

      {decided ? <OutcomePanel dealId={deal._id} /> : null}
    </main>
  );
}
