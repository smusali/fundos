import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { compileThesis, diffRubrics, rubricFromYaml, rubricToYaml } from '@fundos/core';

const fixturesDir = join(__dirname, '..', '..', 'fixtures', 'theses');
const fixtures = {
  memo: readFileSync(join(fixturesDir, 'vertical-ai-memo.md'), 'utf8'),
  bullets: readFileSync(join(fixturesDir, 'climate-deeptech-bullets.md'), 'utf8'),
  answers: readFileSync(join(fixturesDir, 'fintech-infra-answers.md'), 'utf8'),
};

describe('compileThesis', () => {
  test.each(Object.entries(fixtures))('compiles the %s fixture sanely', (_kind, artifact) => {
    const rubric = compileThesis(artifact);
    expect(rubric.dimensions.length).toBeGreaterThanOrEqual(3);
    expect(rubric.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0)).toBe(100);
    for (const dimension of rubric.dimensions) {
      expect(dimension.criteria.length).toBeGreaterThan(0);
      expect(dimension.weight).toBeGreaterThan(0);
    }
    expect(rubric.disqualifiers.length).toBeGreaterThan(0);
  });

  test('is deterministic', () => {
    expect(compileThesis(fixtures.memo)).toEqual(compileThesis(fixtures.memo));
  });

  test('round-trips through YAML', () => {
    const rubric = compileThesis(fixtures.bullets);
    expect(rubricFromYaml(rubricToYaml(rubric))).toEqual(rubric);
  });
});

describe('diffRubrics', () => {
  test('reports no changes for identical rubrics', () => {
    const rubric = compileThesis(fixtures.memo);
    const diff = diffRubrics(rubric, rubric);
    expect(diff.addedDimensions).toEqual([]);
    expect(diff.removedDimensions).toEqual([]);
    expect(diff.weightChanges).toEqual([]);
    expect(diff.criteriaChanges).toEqual([]);
  });

  test('surfaces added criteria and weight shifts after an edit', () => {
    const before = compileThesis(fixtures.memo);
    const edited = `${fixtures.memo}\nWe now also require SOC 2 readiness as product evidence of enterprise maturity.`;
    const after = compileThesis(edited);
    const diff = diffRubrics(before, after);
    const productChange = diff.criteriaChanges.find((change) => change.key === 'product');
    expect(productChange?.added.length).toBeGreaterThan(0);
    expect(diff.weightChanges.length).toBeGreaterThan(0);
  });

  test('surfaces dimension removal', () => {
    const before = compileThesis(fixtures.bullets);
    const after = compileThesis('- Team: technical founder with patents required\n- Traction: paid pilot required\n- Market: $5B addressable market');
    const diff = diffRubrics(before, after);
    expect(diff.removedDimensions.length).toBeGreaterThan(0);
  });
});
