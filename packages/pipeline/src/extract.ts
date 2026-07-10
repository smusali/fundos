import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import type { ParsedPage } from './parser';

export interface ExtractedClaim {
  claim: string;
  span: string;
  page: number;
  confidence: number;
}

const EXTRACTION_MODEL = 'claude-sonnet-5';
const MAX_CLAIMS_PER_PAGE = 5;
const MAX_MODEL_OUTPUT_TOKENS = 1_500;
const MIN_CLAIM_LENGTH = 15;

const CURRENCY_OR_PERCENT = /\$[\d,.]+\s?[bmk]?\b|\d+(\.\d+)?\s?%/i;
const NUMERIC = /\b\d{2,}\b|\b\d+(\.\d+)?x\b/i;
const FACT_CUES = /\bceo\b|\bcto\b|customers?|team|founder|partner|contract|pilot|patent|margin|retention|runway|burn|churn|revenue|market|competitor/i;

/**
 * Deterministic extractor: lines carrying quantitative or factual signal become
 * claims whose span is the line itself, so every claim anchors exactly. Powers
 * the zero-credential demo and the PR-lane E2E.
 */
export function heuristicExtractPage(page: ParsedPage): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  for (const line of page.lines) {
    if (claims.length >= MAX_CLAIMS_PER_PAGE) break;
    if (line.text.length < MIN_CLAIM_LENGTH) continue;
    let confidence: number;
    if (CURRENCY_OR_PERCENT.test(line.text)) {
      confidence = 0.85;
    } else if (NUMERIC.test(line.text)) {
      confidence = 0.7;
    } else if (FACT_CUES.test(line.text)) {
      confidence = 0.55;
    } else {
      continue;
    }
    claims.push({ claim: line.text, span: line.text, page: page.page, confidence });
  }
  return claims;
}

const modelClaimsSchema = z.object({
  claims: z
    .array(
      z.object({
        claim: z.string().describe('One factual claim stated by the document'),
        span: z.string().describe('The exact text span on the page that states it, quoted verbatim'),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(MAX_CLAIMS_PER_PAGE),
});

/** Model extractor for one parsed page: strict-JSON claims with verbatim spans. */
export async function modelExtractPage(page: ParsedPage): Promise<ExtractedClaim[]> {
  const pageText = page.lines.map((line) => line.text).join('\n');
  const { object } = await generateObject({
    model: anthropic(EXTRACTION_MODEL),
    schema: modelClaimsSchema,
    maxOutputTokens: MAX_MODEL_OUTPUT_TOKENS,
    prompt: `Extract the investable factual claims from this pitch material page. Quote each span verbatim from the page text. Page text:\n\n${pageText}`,
  });
  return object.claims.map((claim) => ({ ...claim, page: page.page }));
}

/**
 * Vision escalation for image-heavy pages: slices the single page out of the
 * source PDF and sends it as a native PDF part.
 */
export async function visionExtractPage(pdf: Buffer, pageNumber: number): Promise<ExtractedClaim[]> {
  const source = await PDFDocument.load(pdf);
  const single = await PDFDocument.create();
  const [copied] = await single.copyPages(source, [pageNumber - 1]);
  if (!copied) return [];
  single.addPage(copied);
  const bytes = await single.save();
  const { object } = await generateObject({
    model: anthropic(EXTRACTION_MODEL),
    schema: modelClaimsSchema,
    maxOutputTokens: MAX_MODEL_OUTPUT_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file', data: bytes, mediaType: 'application/pdf' },
          {
            type: 'text',
            text: 'This is one page of pitch material that could not be parsed as text. Extract the investable factual claims. Quote each span verbatim as it appears visually.',
          },
        ],
      },
    ],
  });
  return object.claims.map((claim) => ({ ...claim, page: pageNumber }));
}
