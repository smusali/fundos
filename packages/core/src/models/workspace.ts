import { z } from 'zod';

export const workspaceSchema = z.object({
  _id: z.string(),
  fundName: z.string(),
  ssoDomain: z.string().nullable(),
  settings: z.record(z.string(), z.unknown()),
  intakeSlug: z.string(),
  createdAt: z.date(),
});

export type Workspace = z.infer<typeof workspaceSchema>;

export const userSchema = z.object({
  _id: z.string(),
  email: z.string(),
  ssoProvider: z.enum(['google', 'dev']),
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});

export type User = z.infer<typeof userSchema>;

export const membershipSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  role: z.enum(['partner', 'admin']),
  createdAt: z.date(),
});

export type Membership = z.infer<typeof membershipSchema>;
