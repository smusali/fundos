import { z } from 'zod';

export const decisionOutcomeSchema = z.enum(['pass', 'advance', 'invest']);

export type DecisionOutcome = z.infer<typeof decisionOutcomeSchema>;

export const decisionRowSchema = z.object({
  dealId: z.string(),
  outcome: decisionOutcomeSchema,
  reason: z.string(),
  decidedBy: z.string(),
  thesisVersion: z.number().int(),
  evidenceHash: z.string(),
  ts: z.string(),
});

export type DecisionRow = z.infer<typeof decisionRowSchema>;

export const realizedTypeSchema = z.enum(['mark-up', 'exit', 'write-off', 'follow-on']);

export type RealizedType = z.infer<typeof realizedTypeSchema>;

export const outcomeRowSchema = z.object({
  dealId: z.string(),
  realizedType: realizedTypeSchema,
  value: z.number(),
  period: z.string(),
  ts: z.string(),
});

export type OutcomeRow = z.infer<typeof outcomeRowSchema>;

export const calibrationRowSchema = z.object({
  workspaceId: z.string(),
  thesisVersion: z.number().int(),
  dimension: z.string(),
  delta: z.number(),
  approvedBy: z.string(),
  ts: z.string(),
});

export type CalibrationRow = z.infer<typeof calibrationRowSchema>;

export const auditRowSchema = z.object({
  workspaceId: z.string(),
  dealId: z.string(),
  eventType: z.string(),
  actor: z.string(),
  result: z.string(),
  ts: z.string(),
});

export type AuditRow = z.infer<typeof auditRowSchema>;

export interface RecalibrationDelta {
  dimension: string;
  delta: number;
  decidedDeals: number;
}
