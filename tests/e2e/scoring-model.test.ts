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
  ThesisRepository,
  ThesisService,
} from '@fundos/core';

const fixtures = join(__dirname, '..', '..', 'fixtures');
const hasModelKey = typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY !== '';

afterAll(async () => {
  await closeRedis();
  await closeMongo();
});

test.skipIf(!hasModelKey)(
  'scoring model lane: real extractor scores a small deck with citation integrity',
  { timeout: 300_000 },
  async () => {
    const db = await getDb();
    const workspaceId = `e2e-model-${randomUUID()}`;
    await new ThesisService(new ThesisRepository(db)).compileAndSave(
      workspaceId,
      readFileSync(join(fixtures, 'theses', 'vertical-ai-memo.md'), 'utf8'),
    );

    const service = new DealService(db, new LocalObjectStorage(join(__dirname, '..', '..', '.uploads')));
    const deal = await service.createDeal(workspaceId, 'Cascade Health', [
      {
        filename: 'cascade-health-series-a.pdf',
        kind: 'deck',
        bytes: readFileSync(join(fixtures, 'decks', 'cascade-health-series-a.pdf')),
      },
    ]);
    await service.processDeal(deal._id);

    const scored = await service.getDeal(deal._id);
    expect(scored?.status).toBe('scored');
    expect(scored?.fitScore).toBeGreaterThan(0);

    const documents = await service.listDocuments(deal._id);
    const pageCount = documents[0]?.pageCount ?? 0;
    expect(pageCount).toBe(10);

    const evidence = await service.listEvidence(deal._id);
    expect(evidence.length).toBeGreaterThanOrEqual(5);

    const anchored = evidence.filter(
      (item) =>
        item.pageRef.page >= 1 &&
        item.pageRef.page <= pageCount &&
        item.pageRef.x > 0 &&
        item.pageRef.y > 0 &&
        item.confidence >= 0.5,
    );
    const integrity = anchored.length / evidence.length;
    expect(integrity).toBeGreaterThanOrEqual(0.7);
  },
);
