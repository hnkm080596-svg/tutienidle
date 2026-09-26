import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// QA probe runner - includes only the evidence probe files; separate
// from the product include globs so runs/ evidence stays out of tests.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../../../../src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['docs/qa/runs/phap-tu-beta-2026-09-25/evidence/probe-*.test.ts'],
  },
})
