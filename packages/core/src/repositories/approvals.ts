import type { Db } from 'mongodb';
import type { Approval, Memo } from '../models/memo';

export class MemoRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Memo>('memos');
  }

  async insert(memo: Memo): Promise<Memo> {
    await this.collection.insertOne(memo);
    return memo;
  }

  async listByDeal(dealId: string): Promise<Memo[]> {
    return this.collection.find({ dealId }, { sort: { createdAt: -1 } }).toArray();
  }
}

export class ApprovalRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Approval>('approvals');
  }

  async insert(approval: Approval): Promise<Approval> {
    await this.collection.insertOne(approval);
    return approval;
  }

  async findById(approvalId: string): Promise<Approval | null> {
    return this.collection.findOne({ _id: approvalId });
  }

  async listPending(workspaceId: string): Promise<Approval[]> {
    return this.collection.find({ workspaceId, status: 'pending' }, { sort: { createdAt: 1 } }).toArray();
  }

  async listByDeal(dealId: string): Promise<Approval[]> {
    return this.collection.find({ dealId }, { sort: { createdAt: -1 } }).toArray();
  }

  async decide(approvalId: string, status: 'approved' | 'rejected', decidedBy: string): Promise<Approval | null> {
    await this.collection.updateOne(
      { _id: approvalId, status: 'pending' },
      { $set: { status, decidedBy, decidedAt: new Date() } },
    );
    return this.findById(approvalId);
  }
}
