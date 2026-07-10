import { z } from 'zod';

export const pageRefSchema = z.object({
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
});

export type PageRef = z.infer<typeof pageRefSchema>;

export const dealStatusSchema = z.enum(['processing', 'scored', 'advanced', 'passed', 'invested', 'failed']);

export type DealStatus = z.infer<typeof dealStatusSchema>;

export const dimensionScoreSchema = z.object({
  key: z.string(),
  label: z.string(),
  weight: z.number(),
  score: z.number().int().min(0).max(100),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type DimensionScore = z.infer<typeof dimensionScoreSchema>;

export const fitScoreBreakdownSchema = z.object({
  total: z.number().int().min(0).max(100),
  thesisVersion: z.number().int().min(1),
  dimensions: z.array(dimensionScoreSchema),
  assumptions: z.array(z.string()),
});

export type FitScoreBreakdown = z.infer<typeof fitScoreBreakdownSchema>;

export const dealSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  company: z.string(),
  source: z.enum(['upload', 'gatekeeper', 'scout']),
  fitScore: z.number().int().min(0).max(100).nullable(),
  thesisVersion: z.number().int().min(1).nullable(),
  breakdown: fitScoreBreakdownSchema.nullable(),
  status: dealStatusSchema,
  crmContext: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
});

export type Deal = z.infer<typeof dealSchema>;

export const dealDocumentSchema = z.object({
  _id: z.string(),
  dealId: z.string(),
  kind: z.enum(['deck', 'dataroom']),
  filename: z.string(),
  pageCount: z.number().int().min(0),
  storageRef: z.string(),
  createdAt: z.date(),
});

export type DealDocument = z.infer<typeof dealDocumentSchema>;

export const evidenceSchema = z.object({
  _id: z.string(),
  dealId: z.string(),
  documentId: z.string(),
  claim: z.string(),
  pageRef: pageRefSchema,
  confidence: z.number().min(0).max(1),
  dimensionKey: z.string().nullable(),
  embedding: z.array(z.number()).nullable(),
  createdAt: z.date(),
});

export type Evidence = z.infer<typeof evidenceSchema>;
