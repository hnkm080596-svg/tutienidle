import { defineConfig } from '@playwright/test'

// BETA B1-A authority contract suite. Runs the real Supabase project over
// HTTP (GoTrue + PostgREST) plus a direct postgres connection for setup and
// invariant assertions - no browser, no dev server.
//
// Serialization note: tests share the staging database, and several specs
// deliberately hold locks or toggle backend_config, so workers stay at 1.
export default defineConfig({
  testDir: './tests/integration/supabase',
  outputDir: './test-results/supabase',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {},
})
