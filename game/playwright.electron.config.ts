import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// B1.8 (BETA-FINAL PR6) - Electron process close/reopen suite: the OS
// protected durable guest credential, rotated/rejected/transient refresh
// paths and finalize interruption, driven through the real packaged
// wiring. GoTrue/PostgREST are network-stubbed (see the spec's stub),
// never staged credentials. Build runs once in global-setup.
const gameRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './tests/electron',
  outputDir: './test-results/electron',
  // Process launches + vite build-dependent startup dominate; each spec
  // drives two or more full app processes sequentially.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: path.join(gameRoot, 'tests', 'electron', 'global-setup.ts'),
})
