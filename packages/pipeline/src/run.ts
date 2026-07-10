import { locateSpan, type PageAnchor } from './anchors';
import { classifyPage, type PageClassification } from './classify';
import { heuristicExtractPage, modelExtractPage, visionExtractPage, type ExtractedClaim } from './extract';
import { parsePdf, type ParsedDocument } from './parser';

export interface AnchoredClaim extends ExtractedClaim {
  anchor: PageAnchor;
}

export type ExtractionEvent =
  | { type: 'page'; page: number; classification: PageClassification }
  | { type: 'claim'; claim: AnchoredClaim }
  | { type: 'assumption'; page: number; note: string }
  | { type: 'document-done'; pageCount: number; claimCount: number };

export interface ExtractionOptions {
  useModel: boolean;
  maxVisionPages?: number;
  onEvent?: (event: ExtractionEvent) => Promise<void> | void;
}

const DEFAULT_MAX_VISION_PAGES = 3;

function validate(parsed: ParsedDocument, claims: ExtractedClaim[]): AnchoredClaim[] {
  const anchored: AnchoredClaim[] = [];
  for (const claim of claims) {
    const anchor = locateSpan(parsed, claim.span, claim.page);
    if (anchor) anchored.push({ ...claim, page: anchor.page, anchor });
  }
  return anchored;
}

/**
 * The classify-extract-validate-escalate loop for one document. Claims are
 * validated against the text layer: a claim survives only when its span
 * anchors to real page coordinates. Image-heavy pages escalate to vision only
 * when a model key is present, bounded by maxVisionPages.
 */
export async function extractDocument(buffer: Buffer, options: ExtractionOptions): Promise<{
  parsed: ParsedDocument;
  claims: AnchoredClaim[];
}> {
  const parsed = await parsePdf(buffer);
  const claims: AnchoredClaim[] = [];
  let visionBudget = options.maxVisionPages ?? DEFAULT_MAX_VISION_PAGES;

  for (const page of parsed.pages) {
    const classification = classifyPage(page);
    await options.onEvent?.({ type: 'page', page: page.page, classification });

    let pageClaims: ExtractedClaim[];
    if (classification === 'image-heavy') {
      if (options.useModel && visionBudget > 0) {
        visionBudget -= 1;
        pageClaims = await visionExtractPage(buffer, page.page);
      } else {
        await options.onEvent?.({
          type: 'assumption',
          page: page.page,
          note: `Page ${page.page} is image-heavy and was not parsed; its contents are not reflected in the score.`,
        });
        continue;
      }
    } else if (options.useModel) {
      pageClaims = await modelExtractPage(page);
    } else {
      pageClaims = heuristicExtractPage(page);
    }

    const validated = classification === 'image-heavy' ? withoutAnchors(pageClaims) : validate(parsed, pageClaims);
    for (const claim of validated) {
      claims.push(claim);
      await options.onEvent?.({ type: 'claim', claim });
    }
  }

  await options.onEvent?.({ type: 'document-done', pageCount: parsed.pageCount, claimCount: claims.length });
  return { parsed, claims };
}

/** Vision claims have no text layer to anchor into; they carry page-level anchors. */
function withoutAnchors(claims: ExtractedClaim[]): AnchoredClaim[] {
  return claims.map((claim) => ({
    ...claim,
    anchor: { page: claim.page, x: 0, y: 0, snippet: claim.span },
  }));
}
