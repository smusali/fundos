import {
  ensureDevSession,
  getDb,
  ThesisRepository,
  ThesisService,
  type RubricDiff,
} from '@fundos/core';
import { ThesisComposer } from './composer';

export const dynamic = 'force-dynamic';

function DiffView({ diff, fromVersion, toVersion }: { diff: RubricDiff; fromVersion: number; toVersion: number }) {
  const empty =
    diff.addedDimensions.length === 0 &&
    diff.removedDimensions.length === 0 &&
    diff.weightChanges.length === 0 &&
    diff.criteriaChanges.length === 0 &&
    diff.disqualifiersAdded.length === 0 &&
    diff.disqualifiersRemoved.length === 0;

  return (
    <section className="mt-8" data-testid="version-diff">
      <h2 className="text-lg font-medium">
        Changes from v{fromVersion} to v{toVersion}
      </h2>
      {empty ? (
        <p className="mt-2 text-sm text-slate-500">No structural changes.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {diff.addedDimensions.map((key) => (
            <li key={`add-${key}`} className="text-emerald-700">
              + dimension {key}
            </li>
          ))}
          {diff.removedDimensions.map((key) => (
            <li key={`rm-${key}`} className="text-red-700">
              - dimension {key}
            </li>
          ))}
          {diff.weightChanges.map((change) => (
            <li key={`w-${change.key}`} className="text-slate-700">
              ~ {change.key} weight {change.from} → {change.to}
            </li>
          ))}
          {diff.criteriaChanges.map((change) => (
            <li key={`c-${change.key}`} className="text-slate-700">
              ~ {change.key}: {change.added.length} criteria added, {change.removed.length} removed
            </li>
          ))}
          {diff.disqualifiersAdded.map((item) => (
            <li key={`dq-add-${item}`} className="text-emerald-700">
              + disqualifier: {item}
            </li>
          ))}
          {diff.disqualifiersRemoved.map((item) => (
            <li key={`dq-rm-${item}`} className="text-red-700">
              - disqualifier: {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ThesisPage() {
  const { workspace } = await ensureDevSession();
  const service = new ThesisService(new ThesisRepository(await getDb()));
  const intakePath = `/intake/${workspace.intakeSlug}`;
  const versions = await service.listVersions(workspace._id);
  const active = versions[0];
  const previous = versions[1];
  const rubric = active ? service.rubricOf(active) : null;

  return (
    <main>
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold">Thesis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste any thesis artifact; fundos compiles it into a versioned, weighted rubric.
        </p>
      </header>

      <div className="mt-6">
        <ThesisComposer />
      </div>

      {active && rubric ? (
        <section className="mt-8" data-testid="active-rubric">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">{rubric.name}</h2>
            <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium">v{active.version}</span>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4 font-medium">Dimension</th>
                <th className="py-2 pr-4 font-medium">Weight</th>
                <th className="py-2 font-medium">Criteria</th>
              </tr>
            </thead>
            <tbody>
              {rubric.dimensions.map((dimension) => (
                <tr key={dimension.key} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 font-medium">{dimension.label}</td>
                  <td className="py-2 pr-4">{dimension.weight}</td>
                  <td className="py-2 text-slate-600">
                    <ul className="list-disc space-y-1 pl-4">
                      {dimension.criteria.map((criterion) => (
                        <li key={criterion}>{criterion}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rubric.disqualifiers.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-red-700">Disqualifiers</h3>
              <ul className="mt-1 list-disc pl-4 text-sm text-slate-600">
                {rubric.disqualifiers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="mt-8 text-sm text-slate-500">No rubric yet. Paste a thesis artifact above.</p>
      )}

      {active ? (
        <p className="mt-4 text-sm text-slate-600" data-testid="intake-link">
          Founder intake link:{' '}
          <a href={intakePath} className="font-mono text-blue-700 underline">
            {intakePath}
          </a>{' '}
          (submissions are auto-screened against the active rubric)
        </p>
      ) : null}

      {active && previous ? (
        <DiffView diff={service.diff(previous, active)} fromVersion={previous.version} toVersion={active.version} />
      ) : null}

      {versions.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Versions</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {versions.map((thesis) => (
              <li key={thesis._id}>
                v{thesis.version} · {thesis.createdAt.toISOString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
