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

  // Two workers, not Playwright's default of half the cores (6 here).
  //
  // Raising the timeouts above was necessary and not sufficient: at 6 workers
  // the full suite still failed about 2 of 17, and the FAILING SET SHIFTED
  // between runs -- reduced-motion in one, combat-overlay-layout and
  // presentation-routing in the next. Shifting failures are contention, not
  // regression. The symptom is not only slowness: the presentation overlay
  // reaches `data-phase="failed"`, because a transition deadline elapses while
  // the machine is oversubscribed, so it looks exactly like a real bug.
  //
  // Measured on this machine, full suite: 6 workers -> 15/17 twice with
  // different tests failing; 1 worker -> 17/17 in 6.4m; 2 workers -> 17/17 in
  // 4.4m and 4.7m. Two is both the reliable choice and the fast one, because
  // these tests spend most of their time waiting on a real browser booting a
  // real game rather than on CPU.
  workers: 2,

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
    env: {
      // Coordinator deadline scale (R12 retained debt): the deadlines are
      // wall-clock failure detectors, but under multi-worker WebGL
      // contention a healthy transition can legitimately outlast them.
      // Scaling applies to E2E runs only - App.vue reads this at boot.
      VITE_PRESENTATION_DEADLINE_SCALE: '3',
    },
  },
})
