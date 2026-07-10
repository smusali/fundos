import { describe, expect, test } from 'vitest';
import { applyDeltasToRubric, computeRecalibrationDeltas, compileThesis } from '@fundos/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('computeRecalibrationDeltas', () => {
  test('rewards dimensions that separated winners from losers', () => {
    const deltas = computeRecalibrationDeltas([
      { dimensionKey: 'traction', score: 90, success: true },
      { dimensionKey: 'traction', score: 80, success: true },
      { dimensionKey: 'traction', score: 40, success: false },
      { dimensionKey: 'market', score: 60, success: true },
      { dimensionKey: 'market', score: 62, success: false },
    ]);
    expect(deltas).toEqual([{ dimension: 'traction', delta: 5, decidedDeals: 3 }]);
  });

  test('penalizes dimensions that scored losers higher', () => {
    const deltas = computeRecalibrationDeltas([
      { dimensionKey: 'team', score: 30, success: true },
      { dimensionKey: 'team', score: 85, success: false },
    ]);
    expect(deltas).toEqual([{ dimension: 'team', delta: -5, decidedDeals: 2 }]);
  });

  test('clamps deltas to plus or minus 5 and needs both outcome classes', () => {
    const deltas = computeRecalibrationDeltas([
      { dimensionKey: 'market', score: 100, success: true },
      { dimensionKey: 'market', score: 0, success: false },
      { dimensionKey: 'product', score: 88, success: true },
    ]);
    expect(deltas).toEqual([{ dimension: 'market', delta: 5, decidedDeals: 2 }]);
  });

  test('returns nothing with no outcome data', () => {
    expect(computeRecalibrationDeltas([])).toEqual([]);
  });
});

describe('applyDeltasToRubric', () => {
  test('shifts weights and keeps the total at exactly 100', () => {
    const rubric = compileThesis(
      readFileSync(join(__dirname, '..', '..', 'fixtures', 'theses', 'vertical-ai-memo.md'), 'utf8'),
    );
    const recalibrated = applyDeltasToRubric(rubric, [
      { dimension: 'traction', delta: 5, decidedDeals: 3 },
      { dimension: 'team', delta: -3, decidedDeals: 3 },
    ]);
    expect(recalibrated.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0)).toBe(100);
    const before = new Map(rubric.dimensions.map((dimension) => [dimension.key, dimension.weight]));
    const after = new Map(recalibrated.dimensions.map((dimension) => [dimension.key, dimension.weight]));
    expect(after.get('traction') ?? 0).toBeGreaterThan(before.get('traction') ?? 0);
    expect(after.get('team') ?? 0).toBeLessThan(before.get('team') ?? 0);
  });
});
