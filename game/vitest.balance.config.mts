import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Balance simulation gate (test-workload remediation phase 1). Separate
// from the default regression gate: `vitest run` uses vite.config.ts whose
// include covers src/**/*.test.ts + tests/architecture/** only, so
// tests/balance/** never runs there. `npm run test:balance` points vitest
// here explicitly - the same pattern as vitest.lab.config.mts / `npm run lab`.
// environment: 'node' + the @/ alias mirror vite.config.ts's test block.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/balance/**/*.test.ts'],
  },
})
