import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import {
  closeMongo,
  closeRedis,
  DealService,
  GatekeeperService,
  getDb,
  LocalObjectStorage,
  ThesisRepository,
  ThesisService,
  WorkspaceRepository,
} from '@fundos/core';

const fixtures = join(__dirname, '..', '..', 'fixtures');
const storage = new LocalObjectStorage(join(__dirname, '..', '..', '.uploads'));

delete process.env.ANTHROPIC_API_KEY;

afterAll(async () => {
  await closeRedis();
  await closeMongo();
});

test('gatekeeper: a scripted founder submission lands in the inbox scored with citations', async () => {
  const db = await getDb();
  const slug = `e2e-intake-${randomUUID()}`;
  const workspace = await new WorkspaceRepository(db).insert({
    _id: randomUUID(),
    fundName: 'E2E Capital',
    ssoDomain: null,
    settings: {},
    intakeSlug: slug,
    createdAt: new Date(),
  });

  const gatekeeper = new GatekeeperService(db, storage);

  const closedGate = await gatekeeper.gateFor(slug);
  expect(closedGate?.accepting).toBe(false);
  await expect(
    gatekeeper.submit(slug, {
      company: 'Too Early Inc',
      founder: { name: 'Ada', email: 'ada@example.com', summary: 'We are too early.' },
      deck: { filename: 'deck.pdf', bytes: readFileSync(join(fixtures, 'decks', 'cascade-health-series-a.pdf')) },
    }),
  ).rejects.toThrow('not accepting');

  const thesis = await new ThesisService(new ThesisRepository(db)).compileAndSave(
    workspace._id,
    readFileSync(join(fixtures, 'theses', 'vertical-ai-memo.md'), 'utf8'),
  );
  const openGate = await gatekeeper.gateFor(slug);
  expect(openGate?.accepting).toBe(true);

  const deal = await gatekeeper.submit(slug, {
    company: 'Cascade Health',
    founder: {
      name: 'Priya Raman',
      email: 'priya@cascadehealth.example',
      summary: 'AI prior-authorization workflow for specialty clinics.',
    },
    deck: {
      filename: 'cascade-health-series-a.pdf',
      bytes: readFileSync(join(fixtures, 'decks', 'cascade-health-series-a.pdf')),
    },
  });
  await gatekeeper.screen(deal._id);

  const dealService = new DealService(db, storage);
  const screened = await dealService.getDeal(deal._id);
  expect(screened?.source).toBe('gatekeeper');
  expect(screened?.status).toBe('scored');
  expect(screened?.fitScore).toBeGreaterThan(0);
  expect(screened?.thesisVersion).toBe(thesis.version);
  expect(screened?.founder?.email).toBe('priya@cascadehealth.example');

  const evidence = await dealService.listEvidence(deal._id);
  expect(evidence.length).toBeGreaterThan(5);
  for (const item of evidence) {
    expect(item.pageRef.page).toBeGreaterThanOrEqual(1);
    expect(item.pageRef.x).toBeGreaterThan(0);
  }

  const inbox = await dealService.listDeals(workspace._id);
  expect(inbox[0]?._id).toBe(deal._id);
});
