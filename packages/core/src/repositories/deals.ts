import type { Db } from 'mongodb';
import type { Deal, DealDocument, DealStatus, Evidence, FitScoreBreakdown } from '../models/deal';

export class DealRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Deal>('deals');
  }

  async insert(deal: Deal): Promise<Deal> {
    await this.collection.insertOne(deal);
    return deal;
  }

  async findById(dealId: string): Promise<Deal | null> {
    return this.collection.findOne({ _id: dealId });
  }

  async listByWorkspace(workspaceId: string): Promise<Deal[]> {
    return this.collection
      .find({ workspaceId }, { sort: { fitScore: -1, createdAt: -1 } })
      .toArray();
  }

  async setScore(dealId: string, breakdown: FitScoreBreakdown): Promise<void> {
    await this.collection.updateOne(
      { _id: dealId },
      {
        $set: {
          fitScore: breakdown.total,
          thesisVersion: breakdown.thesisVersion,
          breakdown,
          status: 'scored',
        },
      },
    );
  }

  async setStatus(dealId: string, status: DealStatus): Promise<void> {
    await this.collection.updateOne({ _id: dealId }, { $set: { status } });
  }
}

export class DocumentRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<DealDocument>('documents');
  }

  async insert(document: DealDocument): Promise<DealDocument> {
    await this.collection.insertOne(document);
    return document;
  }

  async setPageCount(documentId: string, pageCount: number): Promise<void> {
    await this.collection.updateOne({ _id: documentId }, { $set: { pageCount } });
  }

  async listByDeal(dealId: string): Promise<DealDocument[]> {
    return this.collection.find({ dealId }, { sort: { createdAt: 1 } }).toArray();
  }
}

export class EvidenceRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Evidence>('evidence');
  }

  async insert(evidence: Evidence): Promise<Evidence> {
    await this.collection.insertOne(evidence);
    return evidence;
  }

  async listByDeal(dealId: string): Promise<Evidence[]> {
    return this.collection.find({ dealId }, { sort: { createdAt: 1 } }).toArray();
  }
}
