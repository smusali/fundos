import type { ParsedPage } from './parser';

export type PageClassification = 'text' | 'sparse' | 'image-heavy';

const TEXT_THRESHOLD = 120;
const IMAGE_HEAVY_THRESHOLD = 40;

/**
 * Classifies a page by extractable text density: rich pages take the fast text
 * path, sparse pages still extract, and image-heavy pages escalate to vision.
 */
export function classifyPage(page: ParsedPage): PageClassification {
  const chars = page.lines.reduce((sum, line) => sum + line.text.length, 0);
  if (chars >= TEXT_THRESHOLD) return 'text';
  if (chars < IMAGE_HEAVY_THRESHOLD) return 'image-heavy';
  return 'sparse';
}
