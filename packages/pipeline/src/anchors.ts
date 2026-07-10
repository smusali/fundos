import type { ParsedDocument, ParsedPage } from './parser';

export interface PageAnchor {
  page: number;
  x: number;
  y: number;
  snippet: string;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function locateInPage(page: ParsedPage, span: string): PageAnchor | null {
  const needle = normalize(span);
  if (needle === '') return null;
  for (const line of page.lines) {
    if (normalize(line.text).includes(needle)) {
      return { page: page.page, x: line.x, y: line.y, snippet: line.text };
    }
  }
  const joined = normalize(page.lines.map((line) => line.text).join(' '));
  if (joined.includes(needle)) {
    const firstWord = needle.split(' ')[0] ?? needle;
    const line = page.lines.find((candidate) => normalize(candidate.text).includes(firstWord));
    if (line) return { page: page.page, x: line.x, y: line.y, snippet: line.text };
  }
  return null;
}

/**
 * Maps a cited text span back to pdf.js coordinates: the page it appears on and
 * the x,y of the line containing it. Spans that cannot be located return null,
 * which the validate step treats as a failed citation.
 */
export function locateSpan(parsed: ParsedDocument, span: string, pageHint?: number): PageAnchor | null {
  if (pageHint !== undefined) {
    const hinted = parsed.pages.find((page) => page.page === pageHint);
    if (hinted) {
      const anchor = locateInPage(hinted, span);
      if (anchor) return anchor;
    }
  }
  for (const page of parsed.pages) {
    if (page.page === pageHint) continue;
    const anchor = locateInPage(page, span);
    if (anchor) return anchor;
  }
  return null;
}
