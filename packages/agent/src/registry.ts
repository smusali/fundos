import { tool, type Tool } from 'ai';
import type { Db } from 'mongodb';
import { z } from 'zod';
import {
  CalibrationService,
  DealRepository,
  DocumentRepository,
  EvidenceRepository,
  getLedgerClient,
  LedgerRepository,
  LedgerService,
  ThesisRepository,
} from '@fundos/core';
import { fetchCrmContext } from './context-agent';
import { Drafter } from './drafter';

export interface RegistryContext {
  db: Db;
  workspaceId: string;
  actor: string;
  dealId: string;
}

async function audit(context: RegistryContext, toolName: string, result: string): Promise<void> {
  try {
    const ledger = new LedgerRepository(await getLedgerClient());
    await ledger.appendAudit({
      workspaceId: context.workspaceId,
      dealId: context.dealId,
      eventType: `tool.${toolName}`,
      actor: context.actor,
      result: result.slice(0, 500),
      ts: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`audit append failed for tool ${toolName}`, error);
  }
}

/**
 * The one shared tool registry the orchestra runs on. Every invocation lands
 * in the audit trail; consequential actions only ever create pending approval
 * rows, never sends.
 */
export function buildToolRegistry(context: RegistryContext): Record<string, Tool> {
  const deals = new DealRepository(context.db);
  const documents = new DocumentRepository(context.db);
  const evidence = new EvidenceRepository(context.db);
  const theses = new ThesisRepository(context.db);
  const drafter = new Drafter(context.db);

  return {
    getDealSummary: tool({
      description: 'Get the deal: company, source, status, Fit Score, and per-dimension breakdown.',
      inputSchema: z.object({}),
      execute: async () => {
        const deal = await deals.findById(context.dealId);
        await audit(context, 'getDealSummary', deal ? `deal ${deal.company}` : 'not found');
        if (!deal) return { error: 'deal not found' };
        return {
          company: deal.company,
          source: deal.source,
          status: deal.status,
          fitScore: deal.fitScore,
          thesisVersion: deal.thesisVersion,
          dimensions: deal.breakdown?.dimensions ?? [],
          assumptions: deal.breakdown?.assumptions ?? [],
        };
      },
    }),
    getEvidence: tool({
      description: 'List the extracted claims with document, page, coordinates, and confidence.',
      inputSchema: z.object({
        dimensionKey: z.string().nullable().describe('Filter to one rubric dimension, or null for all'),
      }),
      execute: async ({ dimensionKey }) => {
        const [rows, docs] = await Promise.all([evidence.listByDeal(context.dealId), documents.listByDeal(context.dealId)]);
        const names = new Map(docs.map((document) => [document._id, document.filename]));
        const filtered = dimensionKey ? rows.filter((row) => row.dimensionKey === dimensionKey) : rows;
        await audit(context, 'getEvidence', `${filtered.length} claims`);
        return filtered.map((row) => ({
          claim: row.claim,
          document: names.get(row.documentId) ?? row.documentId,
          page: row.pageRef.page,
          confidence: row.confidence,
          dimensionKey: row.dimensionKey,
        }));
      },
    }),
    getRubric: tool({
      description: 'Get the rubric version this deal was scored against, including weights and criteria.',
      inputSchema: z.object({}),
      execute: async () => {
        const deal = await deals.findById(context.dealId);
        const thesis = deal?.thesisVersion
          ? await theses.findByVersion(context.workspaceId, deal.thesisVersion)
          : await theses.findActive(context.workspaceId);
        await audit(context, 'getRubric', thesis ? `v${thesis.version}` : 'none');
        return thesis ? { version: thesis.version, yaml: thesis.yaml } : { error: 'no rubric yet' };
      },
    }),
    getLedger: tool({
      description: 'Get the recorded decisions and realized outcomes for this deal from the immutable ledger.',
      inputSchema: z.object({}),
      execute: async () => {
        const ledger = new LedgerService(context.db);
        const [decisions, outcomes] = await Promise.all([
          ledger.decisionsForDeal(context.dealId),
          ledger.outcomesForDeal(context.dealId),
        ]);
        await audit(context, 'getLedger', `${decisions.length} decisions, ${outcomes.length} outcomes`);
        return { decisions, outcomes };
      },
    }),
    getCrmContext: tool({
      description: 'Fetch prior CRM touchpoints for this company from Affinity and Attio. Read-only.',
      inputSchema: z.object({}),
      execute: async () => {
        const deal = await deals.findById(context.dealId);
        if (!deal) return { error: 'deal not found' };
        const crm = await fetchCrmContext(deal);
        await audit(context, 'getCrmContext', crm.connected ? `${crm.touchpoints.length} touchpoints` : 'disabled');
        return crm;
      },
    }),
    getCalibration: tool({
      description: 'Compute pending recalibration deltas from recorded decisions versus realized outcomes.',
      inputSchema: z.object({}),
      execute: async () => {
        const deltas = await new CalibrationService(context.db).pendingDeltas(context.workspaceId);
        await audit(context, 'getCalibration', `${deltas.length} deltas`);
        return { deltas, note: 'Deltas only alter the rubric after explicit partner approval.' };
      },
    }),
    draftMemo: tool({
      description: 'Draft an evidence-cited IC memo for this deal. The draft waits for partner approval.',
      inputSchema: z.object({}),
      execute: async () => {
        const memo = await drafter.draftMemo(context.dealId);
        await audit(context, 'draftMemo', `memo ${memo._id} drafted`);
        return { memoId: memo._id, status: memo.status, preview: memo.bodyMd.slice(0, 400) };
      },
    }),
    draftPassNote: tool({
      description:
        'Draft a founder-facing pass note referencing the rubric dimensions that fell short. It lands in the approval queue and is never sent from here.',
      inputSchema: z.object({}),
      execute: async () => {
        const approval = await drafter.draftPassNote(context.dealId);
        await audit(context, 'draftPassNote', `approval ${approval._id} pending`);
        return { approvalId: approval._id, status: approval.status, preview: approval.payload.body.slice(0, 400) };
      },
    }),
    draftAdvanceRequest: tool({
      description:
        'Draft a founder-facing request for missing materials. It lands in the approval queue and is never sent from here.',
      inputSchema: z.object({}),
      execute: async () => {
        const approval = await drafter.draftAdvanceRequest(context.dealId);
        await audit(context, 'draftAdvanceRequest', `approval ${approval._id} pending`);
        return { approvalId: approval._id, status: approval.status, preview: approval.payload.body.slice(0, 400) };
      },
    }),
  };
}
