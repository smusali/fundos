import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import {
  closeMongo,
  closeRedis,
  DealService,
  getDb,
  LocalObjectStorage,
  readProgress,
  ThesisRepository,
  ThesisService,
  type UploadFile,
} from '@fundos/core';

const fixtures = join(__dirname, '..', '..', 'fixtures');
const scratchRoot = join(__dirname, '..', '..', '.uploads');

delete process.env.ANTHROPIC_API_KEY;

afterAll(async () => {
  await closeRedis();
  await closeMongo();
});

function upload(kind: 'deck' | 'dataroom', ...segments: string[]): UploadFile {
  const filename = segments[segments.length - 1] ?? '';
  return { filename, kind, bytes: readFileSync(join(fixtures, ...segments)) };
}

test('scoring parser lane: deck plus data room scores with anchored citations', async () => {
  const db = await getDb();
  const thesisService = new ThesisService(new ThesisRepository(db));
  const workspaceId = `e2e-${randomUUID()}`;
  const thesis = await thesisService.compileAndSave(
    workspaceId,
    readFileSync(join(fixtures, 'theses', 'vertical-ai-memo.md'), 'utf8'),
  );

  const service = new DealService(db, new LocalObjectStorage(scratchRoot));
  const deal = await service.createDeal(workspaceId, 'Helix Compliance', [
    upload('deck', 'decks', 'helix-compliance-seed.pdf'),
    upload('dataroom', 'dataroom', 'overview-memo.pdf'),
    upload('dataroom', 'dataroom', 'financial-summary.pdf'),
    upload('dataroom', 'dataroom', 'cap-table.pdf'),
    upload('dataroom', 'dataroom', 'customer-pipeline.pdf'),
    upload('dataroom', 'dataroom', 'security-compliance.pdf'),
  ]);
  await service.processDeal(deal._id);

  const scored = await service.getDeal(deal._id);
  expect(scored?.status).toBe('scored');
  expect(scored?.fitScore).toBeGreaterThan(0);
  expect(scored?.fitScore).toBeLessThanOrEqual(100);
  expect(scored?.thesisVersion).toBe(thesis.version);
  expect(scored?.breakdown?.dimensions.length).toBeGreaterThanOrEqual(3);

  const documents = await service.listDocuments(deal._id);
  expect(documents).toHaveLength(6);
  const deckDocument = documents.find((document) => document.kind === 'deck');
  expect(deckDocument?.pageCount).toBe(12);

  const evidence = await service.listEvidence(deal._id);
  expect(evidence.length).toBeGreaterThan(10);
  for (const item of evidence) {
    expect(item.pageRef.page).toBeGreaterThanOrEqual(1);
    expect(item.pageRef.x).toBeGreaterThan(0);
    expect(item.pageRef.y).toBeGreaterThan(0);
    expect(item.confidence).toBeGreaterThan(0);
  }

  const arrClaim = evidence.find((item) => item.claim.includes('ARR $410K'));
  expect(arrClaim).toBeDefined();
  expect(arrClaim?.pageRef.page).toBe(7);
  expect(arrClaim?.documentId).toBe(deckDocument?._id);

  const dataroomDocumentIds = new Set(
    documents.filter((document) => document.kind === 'dataroom').map((document) => document._id),
  );
  const dataroomCitations = evidence.filter((item) => dataroomDocumentIds.has(item.documentId));
  expect(dataroomCitations.length).toBeGreaterThan(3);

  const progress = await readProgress(deal._id, '0');
  const types = progress.map((entry) => {
    const payload: { type: string } = JSON.parse(entry.payload);
    return payload.type;
  });
  expect(types).toContain('claim');
  expect(types.at(-1)).toBe('scored');

  const rerun = await service.createDeal(workspaceId, 'Helix Compliance rerun', [
    upload('deck', 'decks', 'helix-compliance-seed.pdf'),
  ]);
  await service.processDeal(rerun._id);
  const rerunEvidence = await service.listEvidence(rerun._id);
  const anchorsOf = (items: typeof rerunEvidence) =>
    items.map((item) => `${item.pageRef.page}:${item.pageRef.x.toFixed(2)}:${item.claim}`).sort();
  const deckEvidence = evidence.filter((item) => item.documentId === deckDocument?._id);
  expect(anchorsOf(rerunEvidence)).toEqual(anchorsOf(deckEvidence));
});
