import { z } from 'zod';

export const memoSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  dealId: z.string(),
  bodyMd: z.string(),
  status: z.enum(['draft', 'approved', 'rejected']),
  approvedBy: z.string().nullable(),
  createdAt: z.date(),
});

export type Memo = z.infer<typeof memoSchema>;

export const approvalActionSchema = z.enum([
  'memo.send',
  'pass_note.send',
  'advance_request.send',
  'crm.note',
]);

export type ApprovalAction = z.infer<typeof approvalActionSchema>;

export const approvalSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  dealId: z.string(),
  actionType: approvalActionSchema,
  payload: z.object({
    subject: z.string(),
    body: z.string(),
    recipient: z.string().nullable(),
  }),
  status: z.enum(['pending', 'approved', 'rejected']),
  decidedBy: z.string().nullable(),
  decidedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type Approval = z.infer<typeof approvalSchema>;

/** Actions that reach a founder; these may never execute without an approved row. */
export const FOUNDER_FACING_ACTIONS: ReadonlySet<ApprovalAction> = new Set([
  'pass_note.send',
  'advance_request.send',
]);

/**
 * The approval-gate predicate: delivery is only possible for a row a named
 * partner explicitly approved. Pending, rejected, and undecided rows never pass.
 */
export function canDeliver(approval: Approval): boolean {
  return approval.status === 'approved' && approval.decidedBy !== null && approval.decidedAt !== null;
}
