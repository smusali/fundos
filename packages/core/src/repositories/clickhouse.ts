import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { loadConfig } from '../config';
import type { AuditRow, CalibrationRow, DecisionRow, OutcomeRow } from '../models/ledger';

const LEDGER_USER = 'fundos_ledger';

const TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS decisions (
    deal_id String,
    outcome String,
    reason String,
    decided_by String,
    thesis_version UInt32,
    evidence_hash String,
    ts DateTime64(3)
  ) ENGINE = MergeTree ORDER BY (deal_id, ts)`,
  `CREATE TABLE IF NOT EXISTS outcomes (
    deal_id String,
    realized_type String,
    value Float64,
    period String,
    ts DateTime64(3)
  ) ENGINE = MergeTree ORDER BY (deal_id, ts)`,
  `CREATE TABLE IF NOT EXISTS calibrations (
    workspace_id String,
    thesis_version UInt32,
    dimension String,
    delta Float64,
    approved_by String,
    ts DateTime64(3)
  ) ENGINE = MergeTree ORDER BY (workspace_id, ts)`,
  `CREATE TABLE IF NOT EXISTS audit_entries (
    workspace_id String,
    deal_id String,
    event_type String,
    actor String,
    result String,
    ts DateTime64(3)
  ) ENGINE = MergeTree ORDER BY (workspace_id, ts)`,
];

let adminClient: ClickHouseClient | undefined;
let ledgerClient: ClickHouseClient | undefined;
let prepared: Promise<void> | undefined;

function admin(): ClickHouseClient {
  if (!adminClient) {
    const config = loadConfig();
    adminClient = createClient({
      url: config.CLICKHOUSE_URL,
      database: 'fundos',
      username: config.CLICKHOUSE_ADMIN_USER,
      password: config.CLICKHOUSE_ADMIN_PASSWORD,
    });
  }
  return adminClient;
}

/**
 * The ledger writes through a ClickHouse user granted INSERT and SELECT only,
 * so mutation statements fail at the database itself: immutability is enforced
 * by the store, not by application discipline.
 */
async function prepare(): Promise<void> {
  prepared ??= (async () => {
    for (const ddl of TABLE_DDL) {
      await admin().command({ query: ddl });
    }
    const password = loadConfig().CLICKHOUSE_LEDGER_PASSWORD.replace(/'/g, "\\'");
    await admin().command({
      query: `CREATE USER IF NOT EXISTS ${LEDGER_USER} IDENTIFIED WITH plaintext_password BY '${password}'`,
    });
    await admin().command({
      query: `ALTER USER ${LEDGER_USER} IDENTIFIED WITH plaintext_password BY '${password}'`,
    });
    await admin().command({ query: `GRANT SELECT, INSERT ON fundos.* TO ${LEDGER_USER}` });
  })();
  await prepared;
}

/** Returns the insert-and-select-only client every ledger write goes through. */
export async function getLedgerClient(): Promise<ClickHouseClient> {
  await prepare();
  ledgerClient ??= createClient({
    url: loadConfig().CLICKHOUSE_URL,
    database: 'fundos',
    username: LEDGER_USER,
    password: loadConfig().CLICKHOUSE_LEDGER_PASSWORD,
  });
  return ledgerClient;
}

export async function closeClickHouse(): Promise<void> {
  await ledgerClient?.close();
  await adminClient?.close();
  ledgerClient = undefined;
  adminClient = undefined;
  prepared = undefined;
}

function toDateTime(iso: string): string {
  return iso.replace('T', ' ').replace('Z', '');
}

export class LedgerRepository {
  constructor(private readonly client: ClickHouseClient) {}

  private async insert(table: string, row: Record<string, unknown>): Promise<void> {
    await this.client.insert({ table, values: [row], format: 'JSONEachRow' });
  }

  async appendDecision(row: DecisionRow): Promise<void> {
    await this.insert('decisions', {
      deal_id: row.dealId,
      outcome: row.outcome,
      reason: row.reason,
      decided_by: row.decidedBy,
      thesis_version: row.thesisVersion,
      evidence_hash: row.evidenceHash,
      ts: toDateTime(row.ts),
    });
  }

  async appendOutcome(row: OutcomeRow): Promise<void> {
    await this.insert('outcomes', {
      deal_id: row.dealId,
      realized_type: row.realizedType,
      value: row.value,
      period: row.period,
      ts: toDateTime(row.ts),
    });
  }

  async appendCalibration(row: CalibrationRow): Promise<void> {
    await this.insert('calibrations', {
      workspace_id: row.workspaceId,
      thesis_version: row.thesisVersion,
      dimension: row.dimension,
      delta: row.delta,
      approved_by: row.approvedBy,
      ts: toDateTime(row.ts),
    });
  }

  async appendAudit(row: AuditRow): Promise<void> {
    await this.insert('audit_entries', {
      workspace_id: row.workspaceId,
      deal_id: row.dealId,
      event_type: row.eventType,
      actor: row.actor,
      result: row.result,
      ts: toDateTime(row.ts),
    });
  }

  async decisionsForDeal(dealId: string): Promise<DecisionRow[]> {
    const result = await this.client.query({
      query: 'SELECT * FROM decisions WHERE deal_id = {dealId:String} ORDER BY ts ASC',
      query_params: { dealId },
      format: 'JSONEachRow',
    });
    const rows = await result.json<{
      deal_id: string;
      outcome: string;
      reason: string;
      decided_by: string;
      thesis_version: number;
      evidence_hash: string;
      ts: string;
    }>();
    return rows.map((row) => ({
      dealId: row.deal_id,
      outcome: parseOutcome(row.outcome),
      reason: row.reason,
      decidedBy: row.decided_by,
      thesisVersion: row.thesis_version,
      evidenceHash: row.evidence_hash,
      ts: row.ts,
    }));
  }

  async outcomesForDeal(dealId: string): Promise<OutcomeRow[]> {
    const result = await this.client.query({
      query: 'SELECT * FROM outcomes WHERE deal_id = {dealId:String} ORDER BY ts ASC',
      query_params: { dealId },
      format: 'JSONEachRow',
    });
    const rows = await result.json<{
      deal_id: string;
      realized_type: string;
      value: number;
      period: string;
      ts: string;
    }>();
    return rows.map((row) => ({
      dealId: row.deal_id,
      realizedType: parseRealizedType(row.realized_type),
      value: row.value,
      period: row.period,
      ts: row.ts,
    }));
  }
}

function parseOutcome(value: string): DecisionRow['outcome'] {
  if (value === 'pass' || value === 'advance' || value === 'invest') return value;
  throw new Error(`unexpected decision outcome in ledger: ${value}`);
}

function parseRealizedType(value: string): OutcomeRow['realizedType'] {
  if (value === 'mark-up' || value === 'exit' || value === 'write-off' || value === 'follow-on') return value;
  throw new Error(`unexpected realized type in ledger: ${value}`);
}
