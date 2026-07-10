import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Db } from 'mongodb';
import { loadConfig } from '../config';
import { canDeliver, type Approval } from '../models/memo';
import { ApprovalRepository } from '../repositories/approvals';
import { getLedgerClient, LedgerRepository } from '../repositories/clickhouse';
import { dataRoot } from '../storage';

export interface DeliveredMessage {
  approvalId: string;
  recipient: string;
  subject: string;
  body: string;
  deliveredAt: string;
}

/**
 * The only delivery path in the system. Delivery hard-fails unless the
 * approval row passed the gate predicate, so nothing founder-facing can send
 * without an explicit partner approval by construction. Without mail
 * credentials, sends land in a local outbox directory for observation.
 */
export class OutboundService {
  constructor(private readonly outboxDir: string = resolve(dataRoot(), '.outbox')) {}

  async deliver(approval: Approval): Promise<DeliveredMessage> {
    if (!canDeliver(approval)) {
      throw new Error(`approval ${approval._id} has not been approved; delivery refused`);
    }
    if (approval.payload.recipient === null) {
      throw new Error(`approval ${approval._id} has no recipient`);
    }
    const message: DeliveredMessage = {
      approvalId: approval._id,
      recipient: approval.payload.recipient,
      subject: approval.payload.subject,
      body: approval.payload.body,
      deliveredAt: new Date().toISOString(),
    };
    const smtpUrl = loadConfig().SMTP_URL;
    if (smtpUrl) {
      await this.deliverSmtp(smtpUrl, message);
    } else {
      await mkdir(this.outboxDir, { recursive: true });
      await writeFile(join(this.outboxDir, `${approval._id}.json`), JSON.stringify(message, null, 2));
    }
    return message;
  }

  private async deliverSmtp(smtpUrl: string, message: DeliveredMessage): Promise<void> {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({
      from: loadConfig().MAIL_FROM,
      to: message.recipient,
      subject: message.subject,
      text: message.body,
    });
  }

  async listOutbox(): Promise<DeliveredMessage[]> {
    try {
      const files = await readdir(this.outboxDir);
      const messages: DeliveredMessage[] = [];
      for (const file of files.filter((name) => name.endsWith('.json'))) {
        messages.push(JSON.parse(await readFile(join(this.outboxDir, file), 'utf8')));
      }
      return messages;
    } catch {
      return [];
    }
  }
}

export class ApprovalService {
  private readonly approvals: ApprovalRepository;

  constructor(
    db: Db,
    private readonly outbound: OutboundService = new OutboundService(),
  ) {
    this.approvals = new ApprovalRepository(db);
  }

  async listPending(workspaceId: string): Promise<Approval[]> {
    return this.approvals.listPending(workspaceId);
  }

  private async audit(approval: Approval, eventType: string, actor: string, result: string): Promise<void> {
    const ledger = new LedgerRepository(await getLedgerClient());
    await ledger.appendAudit({
      workspaceId: approval.workspaceId,
      dealId: approval.dealId,
      eventType,
      actor,
      result,
      ts: new Date().toISOString(),
    });
  }

  /** Approve sends: the decide happens first, then delivery runs through the gate. */
  async approve(approvalId: string, decidedBy: string): Promise<Approval> {
    const decided = await this.approvals.decide(approvalId, 'approved', decidedBy);
    if (!decided) throw new Error(`approval not found: ${approvalId}`);
    const delivered = await this.outbound.deliver(decided);
    await this.audit(decided, 'approval.approved', decidedBy, `${decided.actionType} delivered to ${delivered.recipient}`);
    return decided;
  }

  /** Edit re-drafts: the partner's edited body replaces the draft and waits for approval again. */
  async edit(approvalId: string, body: string, editedBy: string): Promise<Approval> {
    const approval = await this.approvals.findById(approvalId);
    if (!approval || approval.status !== 'pending') {
      throw new Error(`no pending approval to edit: ${approvalId}`);
    }
    const redrafted = await this.approvals.insert({
      ...approval,
      _id: randomUUID(),
      payload: { ...approval.payload, body },
      createdAt: new Date(),
    });
    await this.approvals.decide(approvalId, 'rejected', editedBy);
    await this.audit(redrafted, 'approval.redrafted', editedBy, `supersedes ${approvalId}`);
    return redrafted;
  }

  /** Reject leaves only the ledger row; nothing is delivered anywhere. */
  async reject(approvalId: string, decidedBy: string): Promise<Approval> {
    const decided = await this.approvals.decide(approvalId, 'rejected', decidedBy);
    if (!decided) throw new Error(`approval not found: ${approvalId}`);
    await this.audit(decided, 'approval.rejected', decidedBy, decided.actionType);
    return decided;
  }
}
