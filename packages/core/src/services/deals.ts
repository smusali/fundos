import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { extractDocument } from '@fundos/pipeline';
import { loadConfig } from '../config';
import type { Deal, DealDocument, Evidence } from '../models/deal';
import { DealRepository, DocumentRepository, EvidenceRepository } from '../repositories/deals';
import { publishProgress } from '../repositories/redis';
import { ThesisRepository } from '../repositories/theses';
import type { ObjectStorage } from '../storage';
import { matchDimension, rubricFromYaml } from './rubric';
import { scoreDeal } from './scoring';

export interface UploadFile {
  filename: string;
  kind: 'deck' | 'dataroom';
  bytes: Buffer;
}

export interface CreateDealOptions {
  source?: Deal['source'];
  founder?: Deal['founder'];
}

const STATUS_RANK: Record<Deal['status'], number> = {
  scored: 0,
  processing: 1,
  failed: 2,
  advanced: 3,
  invested: 3,
  passed: 3,
};

export class DealService {
  private readonly deals: DealRepository;
  private readonly documents: DocumentRepository;
  private readonly evidence: EvidenceRepository;
  private readonly theses: ThesisRepository;

  constructor(
    db: Db,
    private readonly storage: ObjectStorage,
  ) {
    this.deals = new DealRepository(db);
    this.documents = new DocumentRepository(db);
    this.evidence = new EvidenceRepository(db);
    this.theses = new ThesisRepository(db);
  }

  /** Persists the deal and its documents; extraction runs separately via processDeal. */
  async createDeal(
    workspaceId: string,
    company: string,
    files: UploadFile[],
    options: CreateDealOptions = {},
  ): Promise<Deal> {
    const deal = await this.deals.insert({
      _id: randomUUID(),
      workspaceId,
      company,
      source: options.source ?? 'upload',
      founder: options.founder ?? null,
      fitScore: null,
      thesisVersion: null,
      breakdown: null,
      status: 'processing',
      crmContext: null,
      createdAt: new Date(),
    });
    for (const file of files) {
      const documentId = randomUUID();
      const storageRef = await this.storage.put(`${deal._id}/${documentId}.pdf`, file.bytes);
      await this.documents.insert({
        _id: documentId,
        dealId: deal._id,
        kind: file.kind,
        filename: file.filename,
        pageCount: 0,
        storageRef,
        createdAt: new Date(),
      });
    }
    return deal;
  }

  async getDeal(dealId: string): Promise<Deal | null> {
    return this.deals.findById(dealId);
  }

  /** Inbox ordering: undecided scored deals first by Fit Score, then in-flight, then decided. */
  async listDeals(workspaceId: string): Promise<Deal[]> {
    const deals = await this.deals.listByWorkspace(workspaceId);
    return deals.sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        (b.fitScore ?? -1) - (a.fitScore ?? -1) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async listDocuments(dealId: string): Promise<DealDocument[]> {
    return this.documents.listByDeal(dealId);
  }

  async listEvidence(dealId: string): Promise<Evidence[]> {
    return this.evidence.listByDeal(dealId);
  }

  /**
   * Runs classify-extract-validate-escalate over every document of the deal,
   * streaming claims into Redis as they anchor, then scores the deal against
   * the active rubric version.
   */
  async processDeal(dealId: string): Promise<void> {
    const deal = await this.deals.findById(dealId);
    if (!deal) throw new Error(`deal not found: ${dealId}`);
    const thesis = await this.theses.findActive(deal.workspaceId);
    if (!thesis) {
      await this.deals.setStatus(dealId, 'failed');
      await publishProgress(dealId, { type: 'error', message: 'No active thesis; compile a rubric first.' });
      return;
    }

    try {
      const useModel = loadConfig().ANTHROPIC_API_KEY !== undefined;
      const assumptions: string[] = [];
      const collected: Evidence[] = [];

      for (const document of await this.documents.listByDeal(dealId)) {
        const bytes = await this.storage.get(document.storageRef);
        const { parsed } = await extractDocument(bytes, {
          useModel,
          onEvent: async (event) => {
            if (event.type === 'claim') {
              const row: Evidence = {
                _id: randomUUID(),
                dealId,
                documentId: document._id,
                claim: event.claim.claim,
                pageRef: { page: event.claim.anchor.page, x: event.claim.anchor.x, y: event.claim.anchor.y },
                confidence: event.claim.confidence,
                dimensionKey: matchDimension(event.claim.claim),
                embedding: null,
                createdAt: new Date(),
              };
              collected.push(await this.evidence.insert(row));
              await publishProgress(dealId, {
                type: 'claim',
                documentId: document._id,
                filename: document.filename,
                claim: row.claim,
                page: row.pageRef.page,
                confidence: row.confidence,
                dimensionKey: row.dimensionKey,
              });
            } else if (event.type === 'assumption') {
              assumptions.push(`${document.filename}: ${event.note}`);
              await publishProgress(dealId, { type: 'assumption', filename: document.filename, note: event.note });
            } else if (event.type === 'page') {
              await publishProgress(dealId, {
                type: 'page',
                documentId: document._id,
                filename: document.filename,
                page: event.page,
                classification: event.classification,
              });
            }
          },
        });
        await this.documents.setPageCount(document._id, parsed.pageCount);
      }

      const breakdown = scoreDeal(rubricFromYaml(thesis.yaml), thesis.version, collected, assumptions);
      await this.deals.setScore(dealId, breakdown);
      await publishProgress(dealId, { type: 'scored', total: breakdown.total, thesisVersion: thesis.version });
    } catch (error) {
      console.error(`extraction failed for deal ${dealId}`, error);
      await this.deals.setStatus(dealId, 'failed');
      await publishProgress(dealId, { type: 'error', message: 'Extraction failed; check server logs.' });
    }
  }
}
