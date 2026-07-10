import { notFound } from 'next/navigation';
import { DealService, getDb, getStorage, type Evidence } from '@fundos/core';
import { ClaimStream } from './claim-stream';

export const dynamic = 'force-dynamic';

function confidenceLabel(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = new DealService(await getDb(), getStorage());
  const deal = await service.getDeal(id);
  if (!deal) notFound();

  const documents = await service.listDocuments(id);
  const evidence = await service.listEvidence(id);
  const evidenceById = new Map<string, Evidence>(evidence.map((item) => [item._id, item]));
  const documentNames = new Map(documents.map((document) => [document._id, document.filename]));

  return (
    <main>
      <header className="flex items-baseline justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">{deal.company}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {documents.length} document{documents.length === 1 ? '' : 's'} · source: {deal.source} · status:{' '}
            {deal.status}
          </p>
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
    </main>
  );
}
