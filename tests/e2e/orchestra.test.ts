import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import {
  ApprovalRepository,
  canDeliver,
  closeClickHouse,
  closeMongo,
  closeRedis,
  DealService,
  getDb,
  LocalObjectStorage,
  MemoRepository,
  ThesisRepository,
  ThesisService,
} from '@fundos/core';
import { buildDealChatAgent, Drafter, isChatEnabled, isScoutEnabled, Scout } from '@fundos/agent';

const fixtures = join(__dirname, '..', '..', 'fixtures');
const storage = new LocalObjectStorage(join(__dirname, '..', '..', '.uploads'));

afterAll(async () => {
  await closeClickHouse();
  await closeRedis();
  await closeMongo();
});

async function scoredDeal() {
  const db = await getDb();
  const workspaceId = `e2e-orchestra-${randomUUID()}`;
  await new ThesisService(new ThesisRepository(db)).compileAndSave(
    workspaceId,
    readFileSync(join(fixtures, 'theses', 'vertical-ai-memo.md'), 'utf8'),
  );
  const dealService = new DealService(db, storage);
  const deal = await dealService.createDeal(
    workspaceId,
    'Helix Compliance',
    [
      {
        filename: 'helix-compliance-seed.pdf',
        kind: 'deck',
        bytes: readFileSync(join(fixtures, 'decks', 'helix-compliance-seed.pdf')),
      },
    ],
    {
      source: 'gatekeeper',
      founder: { name: 'Dana Whitfield', email: 'dana@helix.example', summary: 'AI for bank compliance.' },
    },
  );
  await dealService.processDeal(deal._id);
  return { db, workspaceId, dealId: deal._id };
}

test('orchestra: drafts land in the approval queue and cannot deliver', async () => {
  const { db, dealId } = await scoredDeal();
  const drafter = new Drafter(db);

  const passNote = await drafter.draftPassNote(dealId);
  expect(passNote.status).toBe('pending');
  expect(passNote.actionType).toBe('pass_note.send');
  expect(passNote.payload.recipient).toBe('dana@helix.example');
  expect(passNote.payload.body).toContain('Dana');
  expect(canDeliver(passNote)).toBe(false);

  const advance = await drafter.draftAdvanceRequest(dealId);
  expect(advance.status).toBe('pending');
  expect(canDeliver(advance)).toBe(false);

  const memo = await drafter.draftMemo(dealId);
  expect(memo.status).toBe('draft');
  expect(memo.bodyMd).toContain('IC memo draft');
  expect(memo.bodyMd).toContain('p.');

  const approvals = new ApprovalRepository(db);
  const pending = await approvals.listByDeal(dealId);
  expect(pending).toHaveLength(2);
  expect(pending.every((approval) => approval.status === 'pending')).toBe(true);
  expect(await new MemoRepository(db).listByDeal(dealId)).toHaveLength(1);
});

test.skipIf(!isChatEnabled())(
  'orchestra: chat answers grounded questions and queues a pass note',
  { timeout: 300_000 },
  async () => {
    const { db, workspaceId, dealId } = await scoredDeal();
    const agent = buildDealChatAgent({ db, workspaceId, actor: 'e2e@fundos', dealId });

    const scoreAnswer = await agent.generate({
      prompt: 'Why did this deal score the way it did? Cite the strongest evidence with its page.',
    });
    expect(scoreAnswer.text.length).toBeGreaterThan(50);
    expect(scoreAnswer.text).toMatch(/p\.?\s?\d|page\s?\d/i);

    const draftAnswer = await agent.generate({ prompt: 'Draft the pass note for this deal.' });
    expect(draftAnswer.text.length).toBeGreaterThan(0);
    const pending = await new ApprovalRepository(db).listByDeal(dealId);
    const passNote = pending.find((approval) => approval.actionType === 'pass_note.send');
    expect(passNote?.status).toBe('pending');
    expect(passNote ? canDeliver(passNote) : true).toBe(false);
  },
);

test.skipIf(!isScoutEnabled())('orchestra: scout returns structured candidates', { timeout: 300_000 }, async () => {
  const { db, workspaceId } = await scoredDeal();
  const scout = new Scout(db);
  const candidates = await scout.research(workspaceId);
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    expect(candidate.company.length).toBeGreaterThan(0);
    expect(candidate.url).toMatch(/^https?:\/\//);
  }
  const surfaced = await scout.surface(workspaceId, candidates);
  expect(surfaced.every((deal) => deal.source === 'scout' && deal.fitScore !== null)).toBe(true);
});
