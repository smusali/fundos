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

  async insert(workspace: Workspace): Promise<Workspace> {
    await this.collection.insertOne(workspace);
    return workspace;
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
}

export class MembershipRepository {
  constructor(private readonly db: Db) {}

  private get collection() {
    return this.db.collection<Membership>('memberships');
  }

  async findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<Membership | null> {
    return this.collection.findOne({ workspaceId, userId });
  }

  async insert(membership: Membership): Promise<Membership> {
    await this.collection.insertOne(membership);
    return membership;
  }
}
