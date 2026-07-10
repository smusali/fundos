import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { afterAll, expect, test } from 'vitest';
import {
  ApprovalRepository,
  ApprovalService,
  closeClickHouse,
  closeMongo,
  closeRedis,
  DealService,
  getDb,
  LocalObjectStorage,
  OutboundService,
  ThesisRepository,
  ThesisService,
} from '@fundos/core';
import { Drafter } from '@fundos/agent';

const fixtures = join(__dirname, '..', '..', 'fixtures');
const storage = new LocalObjectStorage(join(__dirname, '..', '..', '.uploads'));
const outboxDir = join(__dirname, '..', '..', '.outbox', `e2e-${randomUUID()}`);

afterAll(async () => {
  await rm(outboxDir, { recursive: true, force: true });
  await closeClickHouse();
  await closeRedis();
  await closeMongo();
});

test('outbound: nothing founder-facing can send without an approval row', { timeout: 120_000 }, async () => {
  const db = await getDb();
  const workspaceId = `e2e-approvals-${randomUUID()}`;
  await new ThesisService(new ThesisRepository(db)).compileAndSave(
    workspaceId,
    readFileSync(join(fixtures, 'theses', 'vertical-ai-memo.md'), 'utf8'),
  );
  const dealService = new DealService(db, storage);
  const deal = await dealService.createDeal(
    workspaceId,
    'Cascade Health',
    [
      {
        filename: 'cascade-health-series-a.pdf',
        kind: 'deck',
        bytes: readFileSync(join(fixtures, 'decks', 'cascade-health-series-a.pdf')),
      },
    ],
    { source: 'gatekeeper', founder: { name: 'Priya', email: 'priya@cascade.example', summary: 'Prior auth AI.' } },
  );
  await dealService.processDeal(deal._id);

  const outbound = new OutboundService(outboxDir);
  const service = new ApprovalService(db, outbound);
  const drafter = new Drafter(db);

  const draft = await drafter.draftPassNote(deal._id);
  await expect(outbound.deliver(draft)).rejects.toThrow(/delivery refused/);
  expect(await outbound.listOutbox()).toHaveLength(0);

  const rejected = await service.reject(draft._id, 'partner@e2e');
  expect(rejected.status).toBe('rejected');
  await expect(outbound.deliver(rejected)).rejects.toThrow(/delivery refused/);
  expect(await outbound.listOutbox()).toHaveLength(0);

  const second = await drafter.draftPassNote(deal._id);
  const edited = await service.edit(second._id, 'Edited pass note body with our regards.', 'partner@e2e');
  expect(edited.status).toBe('pending');
  expect(edited.payload.body).toContain('Edited pass note');
  expect((await new ApprovalRepository(db).findById(second._id))?.status).toBe('rejected');
  expect(await outbound.listOutbox()).toHaveLength(0);

  const approved = await service.approve(edited._id, 'partner@e2e');
  expect(approved.status).toBe('approved');
  const outbox = await outbound.listOutbox();
  expect(outbox).toHaveLength(1);
  expect(outbox[0]?.recipient).toBe('priya@cascade.example');
  expect(outbox[0]?.body).toContain('Edited pass note');
  expect(outbox[0]?.approvalId).toBe(edited._id);
});
