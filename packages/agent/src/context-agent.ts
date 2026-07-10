import { z } from 'zod';
import { getRedis, loadConfig, type Deal } from '@fundos/core';
import { connectMCP, isMCPConfigured } from './mcp';

export interface CrmTouchpoint {
  source: 'affinity' | 'attio';
  summary: string;
}

export interface CrmContext {
  connected: boolean;
  providers: string[];
  touchpoints: CrmTouchpoint[];
  fetchedAt: string;
}

const CACHE_TTL_SECONDS = 300;
const AFFINITY_BASE_URL = 'https://api.affinity.co';

function disabledContext(): CrmContext {
  return { connected: false, providers: [], touchpoints: [], fetchedAt: new Date().toISOString() };
}

async function affinityTouchpoints(company: string): Promise<CrmTouchpoint[]> {
  const key = loadConfig().AFFINITY_API_KEY;
  if (!key) return [];
  const response = await fetch(
    `${AFFINITY_BASE_URL}/organizations?term=${encodeURIComponent(company)}&page_size=3`,
    { headers: { authorization: `Basic ${Buffer.from(`:${key}`).toString('base64')}` } },
  );
  if (!response.ok) throw new Error(`affinity responded ${response.status}`);
  const bodySchema = z.object({
    organizations: z.array(z.object({ name: z.string().optional(), domain: z.string().optional() })).optional(),
  });
  const body = bodySchema.parse(await response.json());
  return (body.organizations ?? []).map((organization) => ({
    source: 'affinity',
    summary: `Known organization: ${organization.name ?? 'unnamed'}${organization.domain ? ` (${organization.domain})` : ''}`,
  }));
}

async function attioTouchpoints(company: string): Promise<CrmTouchpoint[]> {
  const client = await connectMCP('attio');
  if (!client) return [];
  try {
    const tools = await client.tools();
    const search = tools['search-records'] ?? tools['records.search'] ?? tools['search_records'];
    if (!search?.execute) return [];
    const result = await search.execute(
      { query: company, object: 'companies', limit: 3 },
      { toolCallId: 'crm-context', messages: [], context: undefined },
    );
    return [{ source: 'attio', summary: JSON.stringify(result).slice(0, 400) }];
  } finally {
    await client.close();
  }
}

/**
 * The context agent: pulls prior touchpoints from the CRM MCP servers at read
 * time, cached per deal in Redis. Reads are automatic; any write-back is a
 * separate, click-gated action.
 */
export async function fetchCrmContext(deal: Deal): Promise<CrmContext> {
  const config = loadConfig();
  const providers: string[] = [];
  if (config.AFFINITY_API_KEY) providers.push('affinity');
  if (isMCPConfigured('attio')) providers.push('attio');
  if (providers.length === 0) return disabledContext();

  const redis = getRedis();
  const cacheKey = `crmctx:${deal._id}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed: CrmContext = JSON.parse(cached);
    return parsed;
  }

  const touchpoints: CrmTouchpoint[] = [];
  for (const [provider, fetcher] of [
    ['affinity', affinityTouchpoints],
    ['attio', attioTouchpoints],
  ] as const) {
    if (!providers.includes(provider)) continue;
    try {
      touchpoints.push(...(await fetcher(deal.company)));
    } catch (error) {
      console.error(`${provider} context fetch failed for ${deal.company}`, error);
    }
  }
  const context: CrmContext = { connected: true, providers, touchpoints, fetchedAt: new Date().toISOString() };
  await redis.set(cacheKey, JSON.stringify(context), 'EX', CACHE_TTL_SECONDS);
  return context;
}
