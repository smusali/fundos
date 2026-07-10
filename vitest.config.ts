import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@fundos/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@fundos/pipeline': fileURLToPath(new URL('./packages/pipeline/src/index.ts', import.meta.url)),
      '@fundos/agent': fileURLToPath(new URL('./packages/agent/src/index.ts', import.meta.url)),
    },
  },
  test: {
    testTimeout: 30_000,
  },
});
