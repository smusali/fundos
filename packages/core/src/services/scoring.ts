import type { DimensionScore, Evidence, FitScoreBreakdown } from '../models/deal';
import type { Rubric } from '../models/thesis';

const FULL_COVERAGE_CLAIMS = 3;
const COVERAGE_SHARE = 0.6;
const CONFIDENCE_SHARE = 0.4;

/**
 * Deterministic, auditable Fit Score: each dimension scores on evidence
 * coverage and confidence, dimensions without evidence score zero with an
 * explicit assumption flag, and the total is the rubric-weighted sum.
 */
export function scoreDeal(
  rubric: Rubric,
  thesisVersion: number,
  evidence: Evidence[],
  extraAssumptions: string[] = [],
): FitScoreBreakdown {
  const dimensions: DimensionScore[] = rubric.dimensions.map((dimension) => {
    const matched = evidence.filter((item) => item.dimensionKey === dimension.key);
    const coverage = Math.min(1, matched.length / FULL_COVERAGE_CLAIMS);
    const meanConfidence =
      matched.length === 0
        ? 0
        : matched.reduce((sum, item) => sum + item.confidence, 0) / matched.length;
    const score = Math.round(100 * (COVERAGE_SHARE * coverage + CONFIDENCE_SHARE * meanConfidence));
    const assumptions =
      matched.length === 0
        ? [`No evidence found for ${dimension.label}; this dimension scored 0.`]
        : [];
    return {
      key: dimension.key,
      label: dimension.label,
      weight: dimension.weight,
      score,
      evidenceIds: matched.map((item) => item._id),
      assumptions,
    };
  });

  const total = Math.round(
    dimensions.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0) / 100,
  );
  return {
    total,
    thesisVersion,
    dimensions,
    assumptions: [...dimensions.flatMap((dimension) => dimension.assumptions), ...extraAssumptions],
  };
}
