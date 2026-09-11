import { defineConfig, devices } from '@playwright/test'

// Port per-checkout (2026-09-07) — standing-slot worktree dùng 5175
// (master 5173, UITemp 5174). Vite config đọc cùng giá trị nên dev server
// thủ công và webServer của Playwright luôn cùng port.
const DEV_PORT = process.env.DEV_PORT ?? '5175'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  // Budget raised 45s -> 90s (2026-09-11), from measurement rather than taste.
  // Three specs carry no `test.setTimeout` of their own -- boot-fresh,
  // ink-wash-ui, reduced-motion -- so only they ever saw this number, and on
  // this machine they land about one second inside 45s: `standing-slot-panel`
  // passes at 44.1s, master's `ink-wash tall` at 44.0s. That is not a budget,
  // it is a coin toss, and a full parallel run failed a SHIFTING subset of them
  // while `--workers=1` passed all 17. Doubling keeps a genuine hang detectable
  // while leaving contention room.
  timeout: 90_000,

  // Assertion/poll budget. Playwright's default is 5s, which is what actually
  // failed `presentation-routing` in a parallel run: its `expect.poll` for
  // CombatScene activation ran out while the machine was busy, even though the
  // whole spec finishes in 15s alone. This was NOT a 45s timeout -- the two
  // failure modes look alike in a summary and are not the same bug.
  expect: { timeout: 15_000 },

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
