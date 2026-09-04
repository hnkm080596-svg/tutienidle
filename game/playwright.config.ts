import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 45_000,
  use: {
    ...devices['Desktop Chrome'],
    // 'localhost' not '127.0.0.1': `npm run dev` binds IPv6 ::1 by default on
    // this machine, so an IPv4 literal would ECONNREFUSED and each test would
    // stall until the 45s timeout (looks like a hang).
    baseURL: 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
