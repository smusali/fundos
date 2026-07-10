import type { Db } from 'mongodb';
import type { Thesis } from '../models/thesis';

export class ThesisRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Thesis>('theses');
  }

  async insert(thesis: Thesis): Promise<Thesis> {
    await this.collection.insertOne(thesis);
    return thesis;
  }

  async findActive(workspaceId: string): Promise<Thesis | null> {
    return this.collection.findOne({ workspaceId }, { sort: { version: -1 } });
  }

  async findByVersion(workspaceId: string, version: number): Promise<Thesis | null> {
    return this.collection.findOne({ workspaceId, version });
  }

  async listVersions(workspaceId: string): Promise<Thesis[]> {
    return this.collection.find({ workspaceId }, { sort: { version: -1 } }).toArray();
  }
}
