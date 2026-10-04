import { defineConfig, devices } from '@playwright/test'
import { devPortForRoot } from './scripts/dev-port.ts'
import { fileURLToPath } from 'node:url'

// BETA B1-D browser admission suite (PR5): the real app over the real
// staging Supabase project, production timing scale 1. A transport fault
// (route abort on the heartbeat RPC) produces the observed authority
// loss; everything else is live - GoTrue refresh, heartbeat_session,
// load_game_state, write_character_save all hit staging.
//
// Env contract: SUPABASE_URL + SUPABASE_ANON_KEY (+ SUPABASE_DB_URL for
// direct-SQL assertion if a spec needs it) must be present in the runner
// environment, sourced from game/.env.supabase.contract or the shell by
// the caller. Missing env fails the spec loudly - never a skip-pass.
const DEV_PORT = String(process.env.BETA_DEV_PORT ?? process.env.DEV_PORT ?? devPortForRoot(fileURLToPath(new URL('.', import.meta.url))))

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'beta-authority.spec.ts',
  outputDir: './test-results/beta',
  // The heartbeat cadence is production-real (30s): a loss-of-authority
  // spec legitimately spends ~40-80s waiting for observed transitions.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${DEV_PORT}`,
    viewport: { width: 1600, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    url: `http://localhost:${DEV_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      // Remote-authoritative backend over the staging project.
      VITE_BACKEND_MODE: 'supabase',
      VITE_SUPABASE_URL: process.env.SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
      // PR5 spec: production timing scale 1 - no deadline scaling.
      VITE_PRESENTATION_DEADLINE_SCALE: '1',
    },
  },
})
