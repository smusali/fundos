import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { locateSpan, parsePdf, type ParsedDocument } from '@fundos/pipeline';

const deckPath = join(__dirname, '..', '..', 'fixtures', 'decks', 'helix-compliance-seed.pdf');

describe('citation anchor mapping', () => {
  let parsed: ParsedDocument;

  beforeAll(async () => {
    parsed = await parsePdf(readFileSync(deckPath));
  });

  test('parses the fixture deck with real page coordinates', () => {
    expect(parsed.pageCount).toBe(12);
    for (const page of parsed.pages) {
      expect(page.lines.length).toBeGreaterThan(0);
      for (const line of page.lines) {
        expect(line.x).toBeGreaterThan(0);
        expect(line.y).toBeGreaterThan(0);
      }
    }
  });

  test('locates a known span on its page', () => {
    const anchor = locateSpan(parsed, 'ARR $410K across 6 bank customers');
    expect(anchor).not.toBeNull();
    expect(anchor?.page).toBe(7);
    expect(anchor?.x).toBeGreaterThan(0);
    expect(anchor?.y).toBeGreaterThan(0);
    expect(anchor?.snippet).toContain('ARR $410K');
  });

  test('prefers the hinted page when the span appears there', () => {
    const anchor = locateSpan(parsed, 'Helix Compliance', 1);
    expect(anchor?.page).toBe(1);
  });

  test('is case and whitespace insensitive', () => {
    const anchor = locateSpan(parsed, 'arr  $410k ACROSS 6 bank customers');
    expect(anchor?.page).toBe(7);
  });

  test('returns null for spans that do not exist', () => {
    expect(locateSpan(parsed, 'quantum blockchain synergies')).toBeNull();
  });
});
