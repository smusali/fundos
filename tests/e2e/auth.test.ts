import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import {
  closeClickHouse,
  closeMongo,
  closeRedis,
  DealService,
  GatekeeperService,
  getDb,
  LedgerService,
  LocalObjectStorage,
  SettingsService,
  SsoSessionService,
  ThesisRepository,
  ThesisService,
} from '@fundos/core';

const fixtures = join(__dirname, '..', '..', 'fixtures');
const storage = new LocalObjectStorage(join(__dirname, '..', '..', '.uploads'));

delete process.env.ANTHROPIC_API_KEY;

afterAll(async () => {
  await closeClickHouse();
  await closeRedis();
  await closeMongo();
});

test('auth: SSO session resolves a workspace and carries the golden path', { timeout: 120_000 }, async () => {
  const db = await getDb();
  const sessions = new SsoSessionService(db);
  const email = `partner-${randomUUID().slice(0, 8)}@ridgeline.vc`;

  const first = await sessions.resolve(email, 'Jordan Blake');
  expect(first.user.email).toBe(email);
  expect(first.user.ssoProvider).toBe('google');
  expect(first.workspace.intakeSlug.length).toBeGreaterThan(0);

  const second = await sessions.resolve(email, 'Jordan Blake');
  expect(second.user._id).toBe(first.user._id);
  expect(second.workspace._id).toBe(first.workspace._id);

  const { workspace, user } = first;
  const thesis = await new ThesisService(new ThesisRepository(db)).compileAndSave(
    workspace._id,
    readFileSync(join(fixtures, 'theses', 'fintech-infra-answers.md'), 'utf8'),
  );

  const dealService = new DealService(db, storage);
  const deal = await dealService.createDeal(workspace._id, 'Helix Compliance', [
    {
      filename: 'helix-compliance-seed.pdf',
      kind: 'deck',
      bytes: readFileSync(join(fixtures, 'decks', 'helix-compliance-seed.pdf')),
    },
  ]);
  await dealService.processDeal(deal._id);
  const scored = await dealService.getDeal(deal._id);
  expect(scored?.status).toBe('scored');
  expect(scored?.thesisVersion).toBe(thesis.version);

  const decision = await new LedgerService(db).recordDecision(
    scored ?? deal,
    'advance',
    'signed-in partner advancing',
    user.email,
  );
  expect(decision.decidedBy).toBe(email);

  const uniqueSlug = `ridgeline-${randomUUID().slice(0, 8)}`;
  const settings = new SettingsService(db);
  await settings.updateWorkspace(workspace._id, { fundName: 'Ridgeline Capital', intakeSlug: uniqueSlug });
  await settings.updateUserSettings(user._id, { notifyOnQueue: true });
  const updated = await sessions.resolve(email);
  expect(updated.workspace.fundName).toBe('Ridgeline Capital');
  expect(updated.workspace.intakeSlug).toBe(uniqueSlug);
  expect(updated.user.settings['notifyOnQueue']).toBe(true);
  expect(updated.workspace.settings).toEqual({});

  const gate = await new GatekeeperService(db, storage).gateFor(uniqueSlug);
  expect(gate?.workspace._id).toBe(workspace._id);
  expect(gate?.accepting).toBe(true);
});
