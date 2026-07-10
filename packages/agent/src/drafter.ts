import { randomUUID } from 'node:crypto';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { Db } from 'mongodb';
import {
  ApprovalRepository,
  DealRepository,
  DocumentRepository,
  EvidenceRepository,
  loadConfig,
  MemoRepository,
  type Approval,
  type ApprovalAction,
  type Deal,
  type Evidence,
  type Memo,
} from '@fundos/core';

const DRAFT_MODEL = 'claude-sonnet-5';
const MAX_DRAFT_TOKENS = 1_200;

interface DraftMaterial {
  deal: Deal;
  evidence: Evidence[];
  documentNames: Map<string, string>;
}

function citation(item: Evidence, documentNames: Map<string, string>): string {
  return `[${documentNames.get(item.documentId) ?? 'document'} p.${item.pageRef.page}]`;
}

function memoTemplate({ deal, evidence, documentNames }: DraftMaterial): string {
  const lines = [
    `# IC memo draft: ${deal.company}`,
    '',
    `Fit Score ${deal.fitScore ?? 'n/a'} against rubric v${deal.thesisVersion ?? 'n/a'}.`,
    '',
  ];
  for (const dimension of deal.breakdown?.dimensions ?? []) {
    lines.push(`## ${dimension.label} (${dimension.score}, weight ${dimension.weight})`);
    const cited = evidence.filter((item) => dimension.evidenceIds.includes(item._id));
    for (const item of cited) {
      lines.push(`- ${item.claim} ${citation(item, documentNames)}`);
    }
    for (const assumption of dimension.assumptions) {
      lines.push(`- Assumption: ${assumption}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function passNoteTemplate({ deal }: DraftMaterial): string {
  const weakest = [...(deal.breakdown?.dimensions ?? [])].sort((a, b) => a.score - b.score).slice(0, 2);
  const reasons = weakest
    .map((dimension) => `${dimension.label.toLowerCase()} (scored ${dimension.score} of 100 on our rubric)`)
    .join(' and ');
  return [
    `Hi ${deal.founder?.name ?? 'there'},`,
    '',
    `Thank you for sharing ${deal.company} with us. After reviewing your materials against our investment thesis, we will not be moving forward at this time.`,
    '',
    reasons
      ? `The dimensions that fell short of our bar were ${reasons}. This reflects our current thesis rather than a judgment of your business.`
      : 'This reflects our current thesis rather than a judgment of your business.',
    '',
    'We would be glad to take another look as these areas develop.',
  ].join('\n');
}

function advanceRequestTemplate({ deal }: DraftMaterial): string {
  const assumptions = deal.breakdown?.assumptions ?? [];
  const asks = assumptions.length > 0 ? assumptions.map((assumption) => `- ${assumption}`).join('\n') : '- Any materials that complete the picture';
  return [
    `Hi ${deal.founder?.name ?? 'there'},`,
    '',
    `We are actively evaluating ${deal.company} and would like to go deeper. To complete our review, could you share materials covering:`,
    '',
    asks,
  ].join('\n');
}

async function polishWithModel(draft: string, purpose: string): Promise<string> {
  if (loadConfig().ANTHROPIC_API_KEY === undefined) return draft;
  const { text } = await generateText({
    model: anthropic(DRAFT_MODEL),
    maxOutputTokens: MAX_DRAFT_TOKENS,
    prompt: `Polish this ${purpose} for clarity and tone. Keep every factual claim and every citation marker exactly as written; do not invent facts.\n\n${draft}`,
  });
  return text;
}

/**
 * The drafter agent: produces evidence-cited IC memos and founder-facing
 * drafts. Every founder-facing draft lands in the approval queue as a pending
 * row; nothing here can send anything.
 */
export class Drafter {
  private readonly deals: DealRepository;
  private readonly documents: DocumentRepository;
  private readonly evidence: EvidenceRepository;
  private readonly memos: MemoRepository;
  private readonly approvals: ApprovalRepository;

  constructor(db: Db) {
    this.deals = new DealRepository(db);
    this.documents = new DocumentRepository(db);
    this.evidence = new EvidenceRepository(db);
    this.memos = new MemoRepository(db);
    this.approvals = new ApprovalRepository(db);
  }

  private async material(dealId: string): Promise<DraftMaterial> {
    const deal = await this.deals.findById(dealId);
    if (!deal) throw new Error(`deal not found: ${dealId}`);
    const [documents, evidence] = await Promise.all([
      this.documents.listByDeal(dealId),
      this.evidence.listByDeal(dealId),
    ]);
    return { deal, evidence, documentNames: new Map(documents.map((document) => [document._id, document.filename])) };
  }

  async draftMemo(dealId: string): Promise<Memo> {
    const material = await this.material(dealId);
    const body = await polishWithModel(memoTemplate(material), 'IC memo');
    return this.memos.insert({
      _id: randomUUID(),
      workspaceId: material.deal.workspaceId,
      dealId,
      bodyMd: body,
      status: 'draft',
      approvedBy: null,
      createdAt: new Date(),
    });
  }

  private async draftOutbound(material: DraftMaterial, actionType: ApprovalAction, subject: string, body: string): Promise<Approval> {
    return this.approvals.insert({
      _id: randomUUID(),
      workspaceId: material.deal.workspaceId,
      dealId: material.deal._id,
      actionType,
      payload: { subject, body, recipient: material.deal.founder?.email ?? null },
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      createdAt: new Date(),
    });
  }

  async draftPassNote(dealId: string): Promise<Approval> {
    const material = await this.material(dealId);
    const body = await polishWithModel(passNoteTemplate(material), 'founder pass note');
    return this.draftOutbound(material, 'pass_note.send', `Update on ${material.deal.company}`, body);
  }

  async draftAdvanceRequest(dealId: string): Promise<Approval> {
    const material = await this.material(dealId);
    const body = await polishWithModel(advanceRequestTemplate(material), 'materials request');
    return this.draftOutbound(material, 'advance_request.send', `Next steps for ${material.deal.company}`, body);
  }
}
