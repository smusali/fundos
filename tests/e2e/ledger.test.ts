import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  CalibrationService,
  closeClickHouse,
  closeMongo,
  closeRedis,
  DealService,
  getDb,
  getLedgerClient,
  hashEvidenceSet,
  LedgerService,
  LocalObjectStorage,
  provenanceToPdf,
  rubricFromYaml,
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

test('ledger: append-only decisions and outcomes, gated delta, export round-trip', { timeout: 120_000 }, async () => {
  const db = await getDb();
  const workspaceId = `e2e-ledger-${randomUUID()}`;
  const thesisService = new ThesisService(new ThesisRepository(db));
  await thesisService.compileAndSave(
    workspaceId,
    readFileSync(join(fixtures, 'theses', 'vertical-ai-memo.md'), 'utf8'),
  );

  const dealService = new DealService(db, storage);
  const ledgerService = new LedgerService(db);

  const scoreDeck = async (company: string, deck: string) => {
    const deal = await dealService.createDeal(workspaceId, company, [
      { filename: deck, kind: 'deck', bytes: readFileSync(join(fixtures, 'decks', deck)) },
    ]);
    await dealService.processDeal(deal._id);
    const scored = await dealService.getDeal(deal._id);
    if (!scored?.breakdown) throw new Error('deal did not score');
    return scored;
  };

  const winner = await scoreDeck('Helix Compliance', 'helix-compliance-seed.pdf');
  const loser = await scoreDeck('Cascade Health', 'cascade-health-series-a.pdf');

  const decision = await ledgerService.recordDecision(winner, 'invest', 'strong compliance wedge', 'partner@e2e');
  await ledgerService.recordDecision(loser, 'invest', 'health wedge', 'partner@e2e');
  const expectedHash = hashEvidenceSet(winner.breakdown, await dealService.listEvidence(winner._id));
  expect(decision.evidenceHash).toBe(expectedHash);

  const decisions = await ledgerService.decisionsForDeal(winner._id);
  expect(decisions).toHaveLength(1);
  expect(decisions[0]?.outcome).toBe('invest');
  expect((await dealService.getDeal(winner._id))?.status).toBe('invested');

  await ledgerService.recordOutcome(winner, 'mark-up', 3.2, '2027-H1', 'partner@e2e');
  await ledgerService.recordOutcome(loser, 'write-off', 0, '2027-H2', 'partner@e2e');
  expect(await ledgerService.outcomesForDeal(winner._id)).toHaveLength(1);

  const ledgerClient = await getLedgerClient();
  await expect(
    ledgerClient.command({ query: `ALTER TABLE decisions DELETE WHERE deal_id = '${winner._id}'` }),
  ).rejects.toThrow(/ACCESS_DENIED|Not enough privileges|grant/i);
  await expect(
    ledgerClient.command({ query: `ALTER TABLE decisions UPDATE reason = 'rewritten' WHERE deal_id = '${winner._id}'` }),
  ).rejects.toThrow(/ACCESS_DENIED|Not enough privileges|grant/i);
  await expect(
    ledgerClient.command({ query: 'TRUNCATE TABLE decisions' }),
  ).rejects.toThrow(/ACCESS_DENIED|Not enough privileges|grant/i);
  expect(await ledgerService.decisionsForDeal(winner._id)).toHaveLength(1);

  const calibration = new CalibrationService(db);
  const deltas = await calibration.pendingDeltas(workspaceId);
  expect(deltas.length).toBeGreaterThan(0);
  const winnerDims = new Map(winner.breakdown?.dimensions.map((d) => [d.key, d.score]) ?? []);
  const loserDims = new Map(loser.breakdown?.dimensions.map((d) => [d.key, d.score]) ?? []);
  for (const delta of deltas) {
    const gap = (winnerDims.get(delta.dimension) ?? 0) - (loserDims.get(delta.dimension) ?? 0);
    expect(delta.delta).toBe(Math.max(-5, Math.min(5, Math.round(gap / 10))));
  }

  const activeBefore = await thesisService.getActive(workspaceId);
  const nextVersion = await calibration.applyDeltas(workspaceId, deltas, 'partner@e2e');
  const activeAfter = await thesisService.getActive(workspaceId);
  expect(activeBefore?.version).toBe(1);
  expect(nextVersion).toBe(2);
  expect(activeAfter?.version).toBe(2);
  const weights = rubricFromYaml(activeAfter?.yaml ?? '').dimensions.reduce((sum, d) => sum + d.weight, 0);
  expect(weights).toBe(100);

  const provenance = await ledgerService.exportProvenance(winner._id);
  expect(provenance).not.toBeNull();
  if (!provenance) throw new Error('missing provenance');
  const roundTripped: typeof provenance = JSON.parse(JSON.stringify(provenance));
  expect(roundTripped.deal.fitScore).toBe(winner.fitScore);
  expect(roundTripped.breakdown).toEqual(winner.breakdown);
  expect(roundTripped.decisions[0]?.evidenceHash).toBe(expectedHash);
  expect(roundTripped.evidence.length).toBeGreaterThan(5);
  expect(roundTripped.rubricYaml).toContain('dimensions');

  const pdfBytes = await provenanceToPdf(provenance);
  const pdf = await PDFDocument.load(pdfBytes);
  expect(pdf.getPageCount()).toBeGreaterThan(0);
});
