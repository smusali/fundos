import { PDFExtract } from 'pdf.js-extract';

export interface ParsedItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedLine {
  text: string;
  x: number;
  y: number;
}

export interface ParsedPage {
  page: number;
  width: number;
  height: number;
  items: ParsedItem[];
  lines: ParsedLine[];
}

export interface ParsedDocument {
  pageCount: number;
  pages: ParsedPage[];
}

const LINE_Y_TOLERANCE = 2;

/** Groups positioned text items into reading-order lines so spans stay anchored to x,y. */
function toLines(items: ParsedItem[]): ParsedLine[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: { y: number; parts: ParsedItem[] }[] = [];
  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_Y_TOLERANCE);
    if (line) {
      line.parts.push(item);
    } else {
      lines.push({ y: item.y, parts: [item] });
    }
  }
  return lines.map((line) => {
    const parts = line.parts.sort((a, b) => a.x - b.x);
    const first = parts[0];
    return {
      text: parts.map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim(),
      x: first?.x ?? 0,
      y: line.y,
    };
  });
}

/** Extracts the pdf.js text layer with x,y coordinates for every item and line. */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const extractor = new PDFExtract();
  const result = await extractor.extractBuffer(buffer, {});
  const pages: ParsedPage[] = result.pages.map((page) => {
    const items: ParsedItem[] = page.content
      .filter((item) => item.str.trim() !== '')
      .map((item) => ({
        text: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      }));
    return {
      page: page.info.num,
      width: page.info.width,
      height: page.info.height,
      items,
      lines: toLines(items),
    };
  });
  return { pageCount: pages.length, pages };
}
