import type { Db } from 'mongodb';
import type { Membership, User, Workspace } from '../models/workspace';

export class WorkspaceRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Workspace>('workspaces');
  }

  async findByIntakeSlug(intakeSlug: string): Promise<Workspace | null> {
    return this.collection.findOne({ intakeSlug });
  }

  async findById(workspaceId: string): Promise<Workspace | null> {
    return this.collection.findOne({ _id: workspaceId });
  }

  async insert(workspace: Workspace): Promise<Workspace> {
    await this.collection.insertOne(workspace);
    return workspace;
  }

  async update(
    workspaceId: string,
    patch: Partial<Pick<Workspace, 'fundName' | 'intakeSlug' | 'settings'>>,
  ): Promise<void> {
    await this.collection.updateOne({ _id: workspaceId }, { $set: patch });
  }
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<User>('users');
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.collection.findOne({ email });
  }

  async insert(user: User): Promise<User> {
    await this.collection.insertOne(user);
    return user;
  }

  async updateSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    await this.collection.updateOne({ _id: userId }, { $set: { settings } });
  }
}

export class MembershipRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Membership>('memberships');
  }

  async findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<Membership | null> {
    return this.collection.findOne({ workspaceId, userId });
  }

  async findByUser(userId: string): Promise<Membership | null> {
    return this.collection.findOne({ userId });
  }

  async insert(membership: Membership): Promise<Membership> {
    await this.collection.insertOne(membership);
    return membership;
  }
}
