import { defineConfig } from '@playwright/test'

// BETA-FINAL PR12 / spec B6 - the packaged-app update journey spec.
// No dev server: this spec drives a REAL installed build through
// _electron.launch, so there is no webServer block. The spec self-gates
// on its env contract (see tests/electron/beta-update.spec.ts) - missing
// provisioning fails loudly, never skips.
export default defineConfig({
  testDir: './tests/electron',
  outputDir: './test-results/electron',
  // A real download + relaunch is minutes, not seconds.
  timeout: 300_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
})
