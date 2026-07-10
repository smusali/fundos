import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { RecalibrationDelta } from '../models/ledger';
import type { Rubric } from '../models/thesis';
import { getLedgerClient, LedgerRepository } from '../repositories/clickhouse';
import { DealRepository } from '../repositories/deals';
import { ThesisRepository } from '../repositories/theses';
import { normalizeWeights, rubricFromYaml, rubricToYaml } from './rubric';

export interface DimensionOutcomeRecord {
  dimensionKey: string;
  score: number;
  success: boolean;
}

const DELTA_SCALE = 10;
const MAX_DELTA = 5;

/**
 * Recalibration delta math: for each dimension, the gap between its mean score
 * on successful outcomes and on failed ones indicates predictive value. The
 * delta is that gap scaled down and clamped, in weight points. Dimensions need
 * both a success and a failure sample to move.
 */
export function computeRecalibrationDeltas(records: DimensionOutcomeRecord[]): RecalibrationDelta[] {
  const byDimension = new Map<string, { success: number[]; failure: number[] }>();
  for (const record of records) {
    let bucket = byDimension.get(record.dimensionKey);
    if (!bucket) {
      bucket = { success: [], failure: [] };
      byDimension.set(record.dimensionKey, bucket);
    }
    (record.success ? bucket.success : bucket.failure).push(record.score);
  }

  const deltas: RecalibrationDelta[] = [];
  for (const [dimension, bucket] of byDimension) {
    if (bucket.success.length === 0 || bucket.failure.length === 0) continue;
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const gap = mean(bucket.success) - mean(bucket.failure);
    const delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, Math.round(gap / DELTA_SCALE)));
    if (delta !== 0) {
      deltas.push({ dimension, delta, decidedDeals: bucket.success.length + bucket.failure.length });
    }
  }
  return deltas.sort((a, b) => a.dimension.localeCompare(b.dimension));
}

/** Applies approved deltas to rubric weights and re-normalizes to 100. */
export function applyDeltasToRubric(rubric: Rubric, deltas: RecalibrationDelta[]): Rubric {
  const deltaByKey = new Map(deltas.map((delta) => [delta.dimension, delta.delta]));
  const shifted = rubric.dimensions.map((dimension) => ({
    ...dimension,
    weight: Math.max(1, dimension.weight + (deltaByKey.get(dimension.key) ?? 0)),
  }));
  const weights = normalizeWeights(shifted.map((dimension) => dimension.weight));
  return {
    ...rubric,
    dimensions: shifted.map((dimension, index) => ({ ...dimension, weight: weights[index] ?? dimension.weight })),
  };
}

const SUCCESSFUL_TYPES = new Set(['mark-up', 'exit', 'follow-on']);

export class CalibrationService {
  private readonly deals: DealRepository;
  private readonly theses: ThesisRepository;

  constructor(db: Db) {
    this.deals = new DealRepository(db);
    this.theses = new ThesisRepository(db);
  }

  /** Joins decided deals with realized outcomes and computes reviewable deltas. */
  async pendingDeltas(workspaceId: string): Promise<RecalibrationDelta[]> {
    const ledger = new LedgerRepository(await getLedgerClient());
    const deals = await this.deals.listByWorkspace(workspaceId);
    const records: DimensionOutcomeRecord[] = [];
    for (const deal of deals) {
      if (!deal.breakdown) continue;
      const outcomes = await ledger.outcomesForDeal(deal._id);
      if (outcomes.length === 0) continue;
      const success = outcomes.some((outcome) => SUCCESSFUL_TYPES.has(outcome.realizedType));
      for (const dimension of deal.breakdown.dimensions) {
        records.push({ dimensionKey: dimension.key, score: dimension.score, success });
      }
    }
    return computeRecalibrationDeltas(records);
  }

  /**
   * The gated apply: only invoked from an explicit partner approval. Writes the
   * calibration rows to the ledger and publishes the recalibrated rubric as a
   * new thesis version.
   */
  async applyDeltas(workspaceId: string, deltas: RecalibrationDelta[], approvedBy: string): Promise<number> {
    const active = await this.theses.findActive(workspaceId);
    if (!active) throw new Error('no active thesis to recalibrate');
    const recalibrated = applyDeltasToRubric(rubricFromYaml(active.yaml), deltas);
    const next = await this.theses.insert({
      _id: randomUUID(),
      workspaceId,
      yaml: rubricToYaml(recalibrated),
      version: active.version + 1,
      createdAt: new Date(),
    });
    const ledger = new LedgerRepository(await getLedgerClient());
    const ts = new Date().toISOString();
    for (const delta of deltas) {
      await ledger.appendCalibration({
        workspaceId,
        thesisVersion: next.version,
        dimension: delta.dimension,
        delta: delta.delta,
        approvedBy,
        ts,
      });
    }
    await ledger.appendAudit({
      workspaceId,
      dealId: '',
      eventType: 'calibration.applied',
      actor: approvedBy,
      result: `v${active.version} to v${next.version}: ${deltas.map((delta) => `${delta.dimension} ${delta.delta > 0 ? '+' : ''}${delta.delta}`).join(', ')}`,
      ts,
    });
    return next.version;
  }
}
