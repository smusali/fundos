import { randomUUID } from 'node:crypto';
import { getDb } from '../repositories/mongo';
import {
  MembershipRepository,
  UserRepository,
  WorkspaceRepository,
} from '../repositories/workspaces';
import type { User, Workspace } from '../models/workspace';

export interface DevSession {
  workspace: Workspace;
  user: User;
}

const DEV_INTAKE_SLUG = 'meridian-ventures';
const DEV_PARTNER_EMAIL = 'partner@meridian.vc';

/**
 * Stands in for Google SSO until the auth milestone: gets or creates one
 * seeded fund workspace with one partner and returns them as the session.
 */
export async function ensureDevSession(): Promise<DevSession> {
  const db = await getDb();
  const workspaces = new WorkspaceRepository(db);
  const users = new UserRepository(db);
  const memberships = new MembershipRepository(db);

  let workspace = await workspaces.findByIntakeSlug(DEV_INTAKE_SLUG);
  if (!workspace) {
    workspace = await workspaces.insert({
      _id: randomUUID(),
      fundName: 'Meridian Ventures',
      ssoDomain: null,
      settings: {},
      intakeSlug: DEV_INTAKE_SLUG,
      createdAt: new Date(),
    });
  }

  let user = await users.findByEmail(DEV_PARTNER_EMAIL);
  if (!user) {
    user = await users.insert({
      _id: randomUUID(),
      email: DEV_PARTNER_EMAIL,
      ssoProvider: 'dev',
      settings: {},
      createdAt: new Date(),
    });
  }

  const membership = await memberships.findByWorkspaceAndUser(workspace._id, user._id);
  if (!membership) {
    await memberships.insert({
      _id: randomUUID(),
      workspaceId: workspace._id,
      userId: user._id,
      role: 'partner',
      createdAt: new Date(),
    });
  }

  return { workspace, user };
}
