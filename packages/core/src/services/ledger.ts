import { createHash } from 'node:crypto';
import type { Db } from 'mongodb';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Deal, Evidence, FitScoreBreakdown } from '../models/deal';
import type { DecisionOutcome, DecisionRow, OutcomeRow, RealizedType } from '../models/ledger';
import { getLedgerClient, LedgerRepository } from '../repositories/clickhouse';
import { DealRepository, DocumentRepository, EvidenceRepository } from '../repositories/deals';
import { ThesisRepository } from '../repositories/theses';

export interface ProvenanceExport {
  exportedAt: string;
  deal: {
    id: string;
    company: string;
    source: Deal['source'];
    fitScore: number | null;
    thesisVersion: number | null;
  };
  rubricYaml: string | null;
  breakdown: FitScoreBreakdown | null;
  evidence: Array<{
    id: string;
    document: string;
    claim: string;
    page: number;
    x: number;
    y: number;
    confidence: number;
    dimensionKey: string | null;
  }>;
  decisions: DecisionRow[];
  outcomes: OutcomeRow[];
}

/** Hash binding the exact evidence set and breakdown the decider saw. */
export function hashEvidenceSet(breakdown: FitScoreBreakdown | null, evidence: Evidence[]): string {
  const canonical = JSON.stringify({
    breakdown,
    evidence: evidence.map((item) => item._id).sort(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export class LedgerService {
  private readonly deals: DealRepository;
  private readonly documents: DocumentRepository;
  private readonly evidence: EvidenceRepository;
  private readonly theses: ThesisRepository;

  constructor(private readonly db: Db) {
    this.deals = new DealRepository(db);
    this.documents = new DocumentRepository(db);
    this.evidence = new EvidenceRepository(db);
    this.theses = new ThesisRepository(db);
  }

  private async ledger(): Promise<LedgerRepository> {
    return new LedgerRepository(await getLedgerClient());
  }

  /** One-click decision capture: appends the immutable row, then reflects status on the deal. */
  async recordDecision(deal: Deal, outcome: DecisionOutcome, reason: string, decidedBy: string): Promise<DecisionRow> {
    const evidence = await this.evidence.listByDeal(deal._id);
    const row: DecisionRow = {
      dealId: deal._id,
      outcome,
      reason,
      decidedBy,
      thesisVersion: deal.thesisVersion ?? 0,
      evidenceHash: hashEvidenceSet(deal.breakdown, evidence),
      ts: new Date().toISOString(),
    };
    const ledger = await this.ledger();
    await ledger.appendDecision(row);
    await ledger.appendAudit({
      workspaceId: deal.workspaceId,
      dealId: deal._id,
      eventType: 'decision.recorded',
      actor: decidedBy,
      result: `${outcome}: ${reason}`,
      ts: row.ts,
    });
    const statusByOutcome: Record<DecisionOutcome, Deal['status']> = {
      pass: 'passed',
      advance: 'advanced',
      invest: 'invested',
    };
    await this.deals.setStatus(deal._id, statusByOutcome[outcome]);
    return row;
  }

  async recordOutcome(deal: Deal, realizedType: RealizedType, value: number, period: string, actor: string): Promise<OutcomeRow> {
    const row: OutcomeRow = {
      dealId: deal._id,
      realizedType,
      value,
      period,
      ts: new Date().toISOString(),
    };
    const ledger = await this.ledger();
    await ledger.appendOutcome(row);
    await ledger.appendAudit({
      workspaceId: deal.workspaceId,
      dealId: deal._id,
      eventType: 'outcome.recorded',
      actor,
      result: `${realizedType} ${value} (${period})`,
      ts: row.ts,
    });
    return row;
  }

  async decisionsForDeal(dealId: string): Promise<DecisionRow[]> {
    return (await this.ledger()).decisionsForDeal(dealId);
  }

  async outcomesForDeal(dealId: string): Promise<OutcomeRow[]> {
    return (await this.ledger()).outcomesForDeal(dealId);
  }

  /** Reproduces exactly what the decider saw: rubric version, breakdown, evidence, decisions. */
  async exportProvenance(dealId: string): Promise<ProvenanceExport | null> {
    const deal = await this.deals.findById(dealId);
    if (!deal) return null;
    const [documents, evidence, decisions, outcomes] = await Promise.all([
      this.documents.listByDeal(dealId),
      this.evidence.listByDeal(dealId),
      this.decisionsForDeal(dealId),
      this.outcomesForDeal(dealId),
    ]);
    const thesis =
      deal.thesisVersion === null
        ? null
        : await this.theses.findByVersion(deal.workspaceId, deal.thesisVersion);
    const documentNames = new Map(documents.map((document) => [document._id, document.filename]));
    return {
      exportedAt: new Date().toISOString(),
      deal: {
        id: deal._id,
        company: deal.company,
        source: deal.source,
        fitScore: deal.fitScore,
        thesisVersion: deal.thesisVersion,
      },
      rubricYaml: thesis?.yaml ?? null,
      breakdown: deal.breakdown,
      evidence: evidence.map((item) => ({
        id: item._id,
        document: documentNames.get(item.documentId) ?? item.documentId,
        claim: item.claim,
        page: item.pageRef.page,
        x: item.pageRef.x,
        y: item.pageRef.y,
        confidence: item.confidence,
        dimensionKey: item.dimensionKey,
      })),
      decisions,
      outcomes,
    };
  }
}

const PDF_LINE_HEIGHT = 14;
const PDF_MARGIN = 48;

/** Renders the provenance export as a human-readable PDF for LP-facing use. */
export async function provenanceToPdf(provenance: ProvenanceExport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const lines: Array<{ text: string; bold: boolean }> = [
    { text: `Decision provenance: ${provenance.deal.company}`, bold: true },
    { text: `Exported ${provenance.exportedAt} · deal ${provenance.deal.id}`, bold: false },
    {
      text: `Fit Score ${provenance.deal.fitScore ?? 'n/a'} against rubric v${provenance.deal.thesisVersion ?? 'n/a'}`,
      bold: false,
    },
    { text: '', bold: false },
    { text: 'Decisions', bold: true },
    ...provenance.decisions.map((decision) => ({
      text: `${decision.ts} · ${decision.outcome} by ${decision.decidedBy} · "${decision.reason}" · evidence ${decision.evidenceHash.slice(0, 16)}`,
      bold: false,
    })),
    { text: '', bold: false },
    { text: 'Outcomes', bold: true },
    ...provenance.outcomes.map((outcome) => ({
      text: `${outcome.ts} · ${outcome.realizedType} · value ${outcome.value} · ${outcome.period}`,
      bold: false,
    })),
    { text: '', bold: false },
    { text: 'Dimension scores', bold: true },
    ...(provenance.breakdown?.dimensions ?? []).map((dimension) => ({
      text: `${dimension.label}: ${dimension.score} (weight ${dimension.weight})`,
      bold: false,
    })),
    { text: '', bold: false },
    { text: `Evidence (${provenance.evidence.length} claims)`, bold: true },
    ...provenance.evidence.map((item) => ({
      text: `${item.claim.slice(0, 90)} [${item.document} p.${item.page} @ ${item.x.toFixed(0)},${item.y.toFixed(0)} · ${(item.confidence * 100).toFixed(0)}%]`,
      bold: false,
    })),
  ];

  let page = doc.addPage();
  let y = page.getHeight() - PDF_MARGIN;
  for (const line of lines) {
    if (y < PDF_MARGIN) {
      page = doc.addPage();
      y = page.getHeight() - PDF_MARGIN;
    }
    page.drawText(line.text.replace(/[^\x20-\x7E]/g, ' '), {
      x: PDF_MARGIN,
      y,
      size: line.bold ? 12 : 9,
      font: line.bold ? bold : regular,
    });
    y -= PDF_LINE_HEIGHT;
  }
  return doc.save();
}
