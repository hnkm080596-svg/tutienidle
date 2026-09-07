import { defineConfig, devices } from '@playwright/test'

// Port per-checkout (2026-09-07) — master 5173, worktree UITemp 5174.
// Biến env DEV_PORT do npm script set (xem package.json "dev"/"test:e2e"),
// fallback 5173 cho master checkout. Vite config đọc cùng env nên dev
// server thủ công và webServer của Playwright luôn cùng port.
const DEV_PORT = process.env.DEV_PORT ?? '5173'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 45_000,
  use: {
    ...devices['Desktop Chrome'],
    // 'localhost' not '127.0.0.1': `npm run dev` binds IPv6 ::1 by default on
    // this machine, so an IPv4 literal would ECONNREFUSED and each test would
    // stall until the 45s timeout (looks like a hang).
    baseURL: `http://localhost:${DEV_PORT}`,
    viewport: { width: 1600, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    url: `http://localhost:${DEV_PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
