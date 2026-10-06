import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// r17 INT audit repro config - docs/qa-scoped, no production edits.
// Same alias + beta-scope setup as vite.config.ts so domain modules
// resolve identically to the main suite.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../../src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: [fileURLToPath(new URL('../../../tests/setup.betaScope.ts', import.meta.url))],
    include: ['docs/qa/r17-int-repro/**/*.test.ts'],
  },
})
