import { z } from 'zod';

export const rubricDimensionSchema = z.object({
  key: z.string(),
  label: z.string(),
  weight: z.number().int().min(0).max(100),
  criteria: z.array(z.string()),
});

export type RubricDimension = z.infer<typeof rubricDimensionSchema>;

export const rubricSchema = z.object({
  name: z.string(),
  dimensions: z.array(rubricDimensionSchema),
  disqualifiers: z.array(z.string()),
});

export type Rubric = z.infer<typeof rubricSchema>;

export const thesisSchema = z.object({
  _id: z.string(),
  workspaceId: z.string(),
  yaml: z.string(),
  version: z.number().int().min(1),
  createdAt: z.date(),
});

export type Thesis = z.infer<typeof thesisSchema>;

export interface RubricWeightChange {
  key: string;
  from: number;
  to: number;
}

export interface RubricCriteriaChange {
  key: string;
  added: string[];
  removed: string[];
}

export interface RubricDiff {
  addedDimensions: string[];
  removedDimensions: string[];
  weightChanges: RubricWeightChange[];
  criteriaChanges: RubricCriteriaChange[];
  disqualifiersAdded: string[];
  disqualifiersRemoved: string[];
}
