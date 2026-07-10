import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { User, Workspace } from '../models/workspace';
import {
  MembershipRepository,
  UserRepository,
  WorkspaceRepository,
} from '../repositories/workspaces';

export interface SessionContext {
  workspace: Workspace;
  user: User;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolves a Google-signed-in partner to their fund workspace. First sign-in
 * creates the user, a fund workspace named from their email domain, and the
 * partner membership; later sign-ins reuse them.
 */
export class SsoSessionService {
  private readonly workspaces: WorkspaceRepository;
  private readonly users: UserRepository;
  private readonly memberships: MembershipRepository;

  constructor(db: Db) {
    this.workspaces = new WorkspaceRepository(db);
    this.users = new UserRepository(db);
    this.memberships = new MembershipRepository(db);
  }

  private async uniqueSlug(base: string): Promise<string> {
    const candidate = slugify(base) === '' ? 'fund' : slugify(base);
    if (!(await this.workspaces.findByIntakeSlug(candidate))) return candidate;
    return `${candidate}-${randomUUID().slice(0, 8)}`;
  }

  async resolve(email: string, name?: string | null): Promise<SessionContext> {
    let user = await this.users.findByEmail(email);
    if (!user) {
      user = await this.users.insert({
        _id: randomUUID(),
        email,
        ssoProvider: 'google',
        settings: {},
        createdAt: new Date(),
      });
    }

    const membership = await this.memberships.findByUser(user._id);
    if (membership) {
      const workspace = await this.workspaces.findById(membership.workspaceId);
      if (workspace) return { workspace, user };
    }

    const domain = email.split('@')[1] ?? 'fund';
    const fundBase = name && name.trim() !== '' ? `${name.split(' ')[0]} Capital` : domain.split('.')[0] ?? 'fund';
    const workspace = await this.workspaces.insert({
      _id: randomUUID(),
      fundName: fundBase.charAt(0).toUpperCase() + fundBase.slice(1),
      ssoDomain: domain,
      settings: {},
      intakeSlug: await this.uniqueSlug(fundBase),
      createdAt: new Date(),
    });
    await this.memberships.insert({
      _id: randomUUID(),
      workspaceId: workspace._id,
      userId: user._id,
      role: 'partner',
      createdAt: new Date(),
    });
    return { workspace, user };
  }
}

export interface WorkspaceSettingsPatch {
  fundName?: string;
  intakeSlug?: string;
  settings?: Record<string, unknown>;
}

/** Fund-level settings live on the workspace; per-partner settings live on the user. */
export class SettingsService {
  private readonly workspaces: WorkspaceRepository;
  private readonly users: UserRepository;

  constructor(db: Db) {
    this.workspaces = new WorkspaceRepository(db);
    this.users = new UserRepository(db);
  }

  async updateWorkspace(workspaceId: string, patch: WorkspaceSettingsPatch): Promise<void> {
    const normalized: WorkspaceSettingsPatch = { ...patch };
    if (normalized.intakeSlug !== undefined) {
      const slug = slugify(normalized.intakeSlug);
      if (slug === '') throw new Error('intake slug cannot be empty');
      const existing = await this.workspaces.findByIntakeSlug(slug);
      if (existing && existing._id !== workspaceId) throw new Error('intake slug already in use');
      normalized.intakeSlug = slug;
    }
    await this.workspaces.update(workspaceId, normalized);
  }

  async updateUserSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    await this.users.updateSettings(userId, settings);
  }
}
