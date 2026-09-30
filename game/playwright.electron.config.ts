import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Electron spec suites:
// - B1.8 (BETA-FINAL PR6) process close/reopen: OS-protected durable guest
//   credential, rotated/rejected/transient refresh paths and finalize
//   interruption through the real packaged wiring. GoTrue/PostgREST are
//   network-stubbed (see the spec's stub), never staged credentials.
// - BETA-FINAL PR12 / spec B6 packaged-app update journey: a REAL installed
//   build driven through _electron.launch (no webServer block; the spec
//   self-gates on its env contract, missing provisioning fails loudly).
// Build runs once in global-setup. The larger timeout covers a real
// download + relaunch, which is minutes, not seconds.
const gameRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './tests/electron',
  outputDir: './test-results/electron',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: path.join(gameRoot, 'tests', 'electron', 'global-setup.ts'),
})
