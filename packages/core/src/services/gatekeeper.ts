import type { Db } from 'mongodb';
import type { Deal, FounderContact } from '../models/deal';
import type { Workspace } from '../models/workspace';
import { ThesisRepository } from '../repositories/theses';
import { WorkspaceRepository } from '../repositories/workspaces';
import type { ObjectStorage } from '../storage';
import { DealService } from './deals';

export interface IntakeSubmission {
  company: string;
  founder: FounderContact;
  deck: { filename: string; bytes: Buffer };
}

export interface IntakeGate {
  workspace: Workspace;
  accepting: boolean;
}

/**
 * The thesis-gated intake gatekeeper: founders submit through a workspace's
 * hosted link and every submission is auto-screened against the active rubric
 * into the Decision Inbox. Intake only opens once a rubric exists.
 */
export class GatekeeperService {
  private readonly workspaces: WorkspaceRepository;
  private readonly theses: ThesisRepository;
  private readonly deals: DealService;

  constructor(db: Db, storage: ObjectStorage) {
    this.workspaces = new WorkspaceRepository(db);
    this.theses = new ThesisRepository(db);
    this.deals = new DealService(db, storage);
  }

  async gateFor(intakeSlug: string): Promise<IntakeGate | null> {
    const workspace = await this.workspaces.findByIntakeSlug(intakeSlug);
    if (!workspace) return null;
    const thesis = await this.theses.findActive(workspace._id);
    return { workspace, accepting: thesis !== null };
  }

  /** Creates the gatekeeper deal; auto-screening runs via the returned deal's processDeal. */
  async submit(intakeSlug: string, submission: IntakeSubmission): Promise<Deal> {
    const gate = await this.gateFor(intakeSlug);
    if (!gate) throw new Error(`unknown intake link: ${intakeSlug}`);
    if (!gate.accepting) throw new Error('this fund is not accepting submissions yet');
    return this.deals.createDeal(
      gate.workspace._id,
      submission.company,
      [{ filename: submission.deck.filename, kind: 'deck', bytes: submission.deck.bytes }],
      { source: 'gatekeeper', founder: submission.founder },
    );
  }

  async screen(dealId: string): Promise<void> {
    await this.deals.processDeal(dealId);
  }
}
