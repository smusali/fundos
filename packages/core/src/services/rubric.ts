import { parse, stringify } from 'yaml';
import {
  rubricSchema,
  type Rubric,
  type RubricCriteriaChange,
  type RubricDiff,
  type RubricDimension,
  type RubricWeightChange,
} from '../models/thesis';

interface DimensionFamily {
  key: string;
  label: string;
  patterns: RegExp[];
}

const DIMENSION_FAMILIES: DimensionFamily[] = [
  {
    key: 'market',
    label: 'Market',
    patterns: [/\btam\b/i, /market/i, /addressable/i, /tailwind/i, /regulatory/i, /incumbent/i],
  },
  {
    key: 'team',
    label: 'Team',
    patterns: [/team/i, /founder/i, /\bceo\b/i, /\bcto\b/i, /domain expert/i, /technical lead/i, /published work/i],
  },
  {
    key: 'traction',
    label: 'Traction',
    patterns: [/traction/i, /\barr\b/i, /revenue/i, /retention/i, /pilot/i, /\bloi\b/i, /customer/i, /design partner/i, /usage/i, /volume/i],
  },
  {
    key: 'product',
    label: 'Product & Technology',
    patterns: [/product/i, /technolog/i, /\bip\b/i, /defensib/i, /patent/i, /workflow/i, /platform/i, /lab-validated/i],
  },
  {
    key: 'business_model',
    label: 'Business Model',
    patterns: [/business model/i, /pricing/i, /margin/i, /unit economics/i, /\bacv\b/i, /contract value/i, /saas/i, /usage-based/i, /transaction-based/i, /cost parity/i, /services-to-software/i, /sales cycle/i],
  },
  {
    key: 'deal_fit',
    label: 'Deal Fit',
    patterns: [/check size/i, /round size/i, /ownership/i, /stage:/i, /pre-seed/i, /\bseed\b/i, /series a/i, /we lead/i, /first institutional/i, /capital plan/i, /invest in/i],
  },
];

const DISQUALIFIER_CUES = [/deal.?breaker/i, /exclusion/i, /\bavoid\b/i, /we pass on/i, /^no /i];

const BASE_DIMENSION_WEIGHT = 10;
const CRITERION_WEIGHT = 5;
const MAX_CRITERION_LENGTH = 240;

/** Splits a thesis artifact into candidate criterion segments: bullets, or prose sentences. */
function segment(artifact: string): string[] {
  const segments: string[] = [];
  for (const rawLine of artifact.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet?.[1]) {
      segments.push(bullet[1]);
      continue;
    }
    const cleaned = line.replace(/^\*\*[^*]+\*\*$/, '');
    if (cleaned === '') continue;
    for (const sentence of cleaned.split(/(?<=[.!?])\s+/)) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10) segments.push(trimmed);
    }
  }
  return segments;
}

function familyScore(family: DimensionFamily, text: string): number {
  return family.patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function isDisqualifier(text: string): boolean {
  return DISQUALIFIER_CUES.some((cue) => cue.test(text));
}

/** Splits "Deal breakers: a, b, and c" style segments into individual disqualifier items. */
function splitDisqualifiers(text: string): string[] {
  const colonIndex = text.indexOf(':');
  const list = colonIndex >= 0 ? text.slice(colonIndex + 1) : text;
  const items = list
    .split(/[,;]/)
    .map((item) => item.trim().replace(/^(and|or|no)\s+/i, '').replace(/\.$/, '').trim())
    .filter((item) => item.length > 2);
  return items.length > 0 ? items : [text];
}

function extractName(artifact: string): string {
  const heading = artifact.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() ?? 'Untitled thesis';
}

/** Largest-remainder normalization so integer weights always sum to exactly 100. */
function normalizeWeights(rawWeights: number[]): number[] {
  const total = rawWeights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return rawWeights;
  const exact = rawWeights.map((weight) => (weight / total) * 100);
  const floored = exact.map(Math.floor);
  let remainder = 100 - floored.reduce((sum, weight) => sum + weight, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    const current = floored[index] ?? 0;
    floored[index] = current + 1;
    remainder -= 1;
  }
  return floored;
}

/**
 * Deterministically compiles any thesis artifact (memo prose, bullet criteria,
 * or guided answers) into a weighted rubric. Dimension weights reflect how much
 * of the artifact speaks to each dimension and always sum to 100.
 */
export function compileThesis(artifact: string): Rubric {
  const dimensions = new Map<string, RubricDimension>();
  const disqualifiers: string[] = [];

  for (const text of segment(artifact)) {
    const criterion = text.slice(0, MAX_CRITERION_LENGTH);
    if (isDisqualifier(criterion)) {
      disqualifiers.push(...splitDisqualifiers(criterion));
      continue;
    }
    let best: DimensionFamily | undefined;
    let bestScore = 0;
    for (const family of DIMENSION_FAMILIES) {
      const score = familyScore(family, criterion);
      if (score > bestScore) {
        best = family;
        bestScore = score;
      }
    }
    if (!best) continue;
    const existing = dimensions.get(best.key);
    if (existing) {
      existing.criteria.push(criterion);
    } else {
      dimensions.set(best.key, { key: best.key, label: best.label, weight: 0, criteria: [criterion] });
    }
  }

  const ordered = DIMENSION_FAMILIES.map((family) => dimensions.get(family.key)).filter(
    (dimension): dimension is RubricDimension => dimension !== undefined,
  );
  const weights = normalizeWeights(
    ordered.map((dimension) => BASE_DIMENSION_WEIGHT + dimension.criteria.length * CRITERION_WEIGHT),
  );
  ordered.forEach((dimension, index) => {
    dimension.weight = weights[index] ?? 0;
  });

  return { name: extractName(artifact), dimensions: ordered, disqualifiers };
}

export function rubricToYaml(rubric: Rubric): string {
  return stringify(rubric);
}

export function rubricFromYaml(yamlText: string): Rubric {
  return rubricSchema.parse(parse(yamlText));
}

/** Structural diff between two rubric versions; drives the visible version diff. */
export function diffRubrics(before: Rubric, after: Rubric): RubricDiff {
  const beforeByKey = new Map(before.dimensions.map((dimension) => [dimension.key, dimension]));
  const afterByKey = new Map(after.dimensions.map((dimension) => [dimension.key, dimension]));

  const addedDimensions = after.dimensions
    .filter((dimension) => !beforeByKey.has(dimension.key))
    .map((dimension) => dimension.key);
  const removedDimensions = before.dimensions
    .filter((dimension) => !afterByKey.has(dimension.key))
    .map((dimension) => dimension.key);

  const weightChanges: RubricWeightChange[] = [];
  const criteriaChanges: RubricCriteriaChange[] = [];
  for (const dimension of after.dimensions) {
    const previous = beforeByKey.get(dimension.key);
    if (!previous) continue;
    if (previous.weight !== dimension.weight) {
      weightChanges.push({ key: dimension.key, from: previous.weight, to: dimension.weight });
    }
    const previousSet = new Set(previous.criteria);
    const currentSet = new Set(dimension.criteria);
    const added = dimension.criteria.filter((criterion) => !previousSet.has(criterion));
    const removed = previous.criteria.filter((criterion) => !currentSet.has(criterion));
    if (added.length > 0 || removed.length > 0) {
      criteriaChanges.push({ key: dimension.key, added, removed });
    }
  }

  const beforeDisqualifiers = new Set(before.disqualifiers);
  const afterDisqualifiers = new Set(after.disqualifiers);
  return {
    addedDimensions,
    removedDimensions,
    weightChanges,
    criteriaChanges,
    disqualifiersAdded: after.disqualifiers.filter((item) => !beforeDisqualifiers.has(item)),
    disqualifiersRemoved: before.disqualifiers.filter((item) => !afterDisqualifiers.has(item)),
  };
}
