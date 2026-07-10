import { Redis } from 'ioredis';
import { loadConfig } from '../config';

let redis: Redis | undefined;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(loadConfig().REDIS_URL, { maxRetriesPerRequest: 2 });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}

const PROGRESS_TTL_SECONDS = 3_600;

export interface ProgressEntry {
  id: string;
  payload: string;
}

/** Appends one extraction progress event to the deal's Redis stream. */
export async function publishProgress(dealId: string, payload: unknown): Promise<void> {
  const client = getRedis();
  const key = `progress:${dealId}`;
  await client.xadd(key, '*', 'payload', JSON.stringify(payload));
  await client.expire(key, PROGRESS_TTL_SECONDS);
}

/** Reads progress events after the given stream id; '0' reads from the start. */
export async function readProgress(dealId: string, afterId: string): Promise<ProgressEntry[]> {
  const client = getRedis();
  const entries = await client.xrange(`progress:${dealId}`, afterId === '0' ? '-' : `(${afterId}`, '+');
  return entries.map(([id, fields]) => {
    const payloadIndex = fields.findIndex((field, index) => index % 2 === 0 && field === 'payload');
    return { id, payload: fields[payloadIndex + 1] ?? '{}' };
  });
}
