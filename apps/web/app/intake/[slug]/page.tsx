import { notFound } from 'next/navigation';
import { GatekeeperService, getDb, getStorage } from '@fundos/core';
import { IntakeForm } from './intake-form';

export const dynamic = 'force-dynamic';

export default async function IntakePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await new GatekeeperService(await getDb(), getStorage()).gateFor(slug);
  if (!gate) notFound();

  return (
    <main className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">{gate.workspace.fundName}</h1>
      {gate.accepting ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Submit your company for review. Every submission is screened against our investment
            thesis and a partner sees the result.
          </p>
          <IntakeForm slug={slug} />
        </>
      ) : (
        <p className="mt-4 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This fund is not accepting submissions right now.
        </p>
      )}
    </main>
  );
}
