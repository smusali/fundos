import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/fundos'),
  CLICKHOUSE_URL: z.string().default('http://127.0.0.1:8123'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  EXA_API_KEY: z.string().min(1).optional(),
  APOLLO_MCP_TOKEN: z.string().min(1).optional(),
  AFFINITY_API_KEY: z.string().min(1).optional(),
  ATTIO_MCP_TOKEN: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

/** Parses process.env once; empty strings collapse to undefined so optional integrations disable cleanly. */
export function loadConfig(): AppConfig {
  if (!cached) {
    const raw = Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== ''),
    );
    cached = envSchema.parse(raw);
  }
  return cached;
}
