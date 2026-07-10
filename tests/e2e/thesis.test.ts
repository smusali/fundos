import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import { closeMongo, getDb, ThesisRepository, ThesisService } from '@fundos/core';

const fixturesDir = join(__dirname, '..', '..', 'fixtures', 'theses');
const artifacts = [
  readFileSync(join(fixturesDir, 'vertical-ai-memo.md'), 'utf8'),
  readFileSync(join(fixturesDir, 'climate-deeptech-bullets.md'), 'utf8'),
  readFileSync(join(fixturesDir, 'fintech-infra-answers.md'), 'utf8'),
];

afterAll(closeMongo);

test('thesis engine: fixtures compile, edits version, diff is visible', async () => {
  const service = new ThesisService(new ThesisRepository(await getDb()));
  const workspaceId = `e2e-${randomUUID()}`;

  for (const artifact of artifacts) {
    const thesis = await service.compileAndSave(workspaceId, artifact);
    const rubric = service.rubricOf(thesis);
    expect(rubric.dimensions.length).toBeGreaterThanOrEqual(3);
    expect(rubric.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0)).toBe(100);
  }

  const versions = await service.listVersions(workspaceId);
  expect(versions.map((thesis) => thesis.version)).toEqual([3, 2, 1]);

  const memoArtifact = artifacts[0];
  if (!memoArtifact) throw new Error('missing memo fixture');
  const editedArtifact = `${memoArtifact}\nWe now require SOC 2 readiness as product evidence before any Series A check.`;
  const edited = await service.compileAndSave(workspaceId, editedArtifact);
  expect(edited.version).toBe(4);

  const active = await service.getActive(workspaceId);
  expect(active?.version).toBe(4);

  const [latest, prior] = await service.listVersions(workspaceId);
  if (!latest || !prior) throw new Error('expected at least two versions');
  const diff = service.diff(prior, latest);
  const changed =
    diff.addedDimensions.length +
    diff.removedDimensions.length +
    diff.weightChanges.length +
    diff.criteriaChanges.length +
    diff.disqualifiersAdded.length +
    diff.disqualifiersRemoved.length;
  expect(changed).toBeGreaterThan(0);
});
