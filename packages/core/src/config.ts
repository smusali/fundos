import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/fundos'),
  CLICKHOUSE_URL: z.string().default('http://127.0.0.1:8123'),
  CLICKHOUSE_ADMIN_USER: z.string().default('fundos_admin'),
  CLICKHOUSE_ADMIN_PASSWORD: z.string().default('fundos-admin-local'),
  CLICKHOUSE_LEDGER_PASSWORD: z.string().default('fundos-ledger-local'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  EXA_API_KEY: z.string().min(1).optional(),
  APOLLO_MCP_TOKEN: z.string().min(1).optional(),
  AFFINITY_API_KEY: z.string().min(1).optional(),
  ATTIO_MCP_TOKEN: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  SMTP_URL: z.string().min(1).optional(),
  MAIL_FROM: z.string().default('fundos <no-reply@fundos.local>'),
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
