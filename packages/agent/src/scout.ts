import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import {
  DealRepository,
  DocumentRepository,
  EvidenceRepository,
  matchDimension,
  rubricFromYaml,
  scoreDeal,
  ThesisRepository,
  type Deal,
  type Evidence,
} from '@fundos/core';
import { connectMCP, isMCPConfigured } from './mcp';

export interface ScoutCandidate {
  company: string;
  url: string;
  summary: string;
  matchEvidence: string[];
}

const MAX_CANDIDATES = 5;
const SCOUT_CONFIDENCE = 0.6;

interface ExaResultShape {
  title?: string;
  url?: string;
  text?: string;
  snippet?: string;
  summary?: string;
}

function parseExaResults(raw: unknown): ExaResultShape[] {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parseExaResults(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is ExaResultShape => typeof item === 'object' && item !== null);
  }
  if (typeof raw === 'object' && raw !== null && 'results' in raw) {
    return parseExaResults(Reflect.get(raw, 'results'));
  }
  if (typeof raw === 'object' && raw !== null && 'content' in raw) {
    const content: unknown = Reflect.get(raw, 'content');
    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === 'object' && part !== null && Reflect.get(part, 'type') === 'text') {
          const nested = parseExaResults(Reflect.get(part, 'text'));
          if (nested.length > 0) return nested;
        }
      }
    }
  }
  return [];
}

export function isScoutEnabled(): boolean {
  return isMCPConfigured('exa');
}

/**
 * The scout agent: thesis-driven deep research through Exa's hosted MCP
 * server. Read-only by design; candidates land in the Decision Inbox as
 * pre-scored scout deals a partner advances or dismisses.
 */
export class Scout {
  private readonly deals: DealRepository;
  private readonly documents: DocumentRepository;
  private readonly evidence: EvidenceRepository;
  private readonly theses: ThesisRepository;

  constructor(db: Db) {
    this.deals = new DealRepository(db);
    this.documents = new DocumentRepository(db);
    this.evidence = new EvidenceRepository(db);
    this.theses = new ThesisRepository(db);
  }

  /** Runs Exa deep research for the active thesis and returns structured candidates. */
  async research(workspaceId: string): Promise<ScoutCandidate[]> {
    const thesis = await this.theses.findActive(workspaceId);
    if (!thesis) throw new Error('no active thesis to scout against');
    const client = await connectMCP('exa');
    if (!client) throw new Error('scout is disabled without an Exa key');

    try {
      const rubric = rubricFromYaml(thesis.yaml);
      const query = `startup companies matching: ${rubric.dimensions
        .flatMap((dimension) => dimension.criteria.slice(0, 1))
        .join('; ')}`.slice(0, 380);
      const tools = await client.tools();
      const search = tools['web_search_exa'] ?? tools['web_search'] ?? tools['search'];
      if (!search?.execute) {
        throw new Error(`no known Exa search tool exposed; server offers: ${Object.keys(tools).join(', ')}`);
      }
      const raw: unknown = await search.execute(
        { query, numResults: MAX_CANDIDATES },
        { toolCallId: 'scout-run', messages: [], context: undefined },
      );
      return parseExaResults(raw)
        .filter((result) => result.url !== undefined)
        .slice(0, MAX_CANDIDATES)
        .map((result) => {
          const summary = result.summary ?? result.snippet ?? result.text?.slice(0, 300) ?? '';
          return {
            company: result.title ?? new URL(result.url ?? 'https://unknown.example').hostname,
            url: result.url ?? '',
            summary,
            matchEvidence: summary === '' ? [] : [summary],
          };
        });
    } finally {
      await client.close();
    }
  }

  /** Persists candidates as pre-scored scout deals with their match evidence cited. */
  async surface(workspaceId: string, candidates: ScoutCandidate[]): Promise<Deal[]> {
    const thesis = await this.theses.findActive(workspaceId);
    if (!thesis) throw new Error('no active thesis');
    const rubric = rubricFromYaml(thesis.yaml);
    const surfaced: Deal[] = [];

    for (const candidate of candidates) {
      const dealId = randomUUID();
      const documentId = randomUUID();
      await this.documents.insert({
        _id: documentId,
        dealId,
        kind: 'dataroom',
        filename: candidate.url,
        pageCount: 0,
        storageRef: '',
        createdAt: new Date(),
      });
      const evidenceRows: Evidence[] = [];
      for (const match of candidate.matchEvidence) {
        const row: Evidence = {
          _id: randomUUID(),
          dealId,
          documentId,
          claim: match.slice(0, 400),
          pageRef: { page: 1, x: 0, y: 0 },
          confidence: SCOUT_CONFIDENCE,
          dimensionKey: matchDimension(match),
          embedding: null,
          createdAt: new Date(),
        };
        evidenceRows.push(await this.evidence.insert(row));
      }
      const breakdown = scoreDeal(rubric, thesis.version, evidenceRows, [
        'Scout candidate: scored from public match evidence only; no deck submitted.',
      ]);
      const deal = await this.deals.insert({
        _id: dealId,
        workspaceId,
        company: candidate.company,
        source: 'scout',
        fitScore: breakdown.total,
        thesisVersion: thesis.version,
        breakdown,
        status: 'scored',
        crmContext: null,
        founder: null,
        createdAt: new Date(),
      });
      surfaced.push(deal);
    }
    return surfaced;
  }
}
