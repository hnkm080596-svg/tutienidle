# E2E baseline repair — 2026-09-14

Branch: `arch/e2e-baseline` (base `arch/repair-2026-09` @ `1afd7c51` — includes M1-M8, M11).
Worktree: `.agent-worktrees/arch-e2e-baseline`. Scope: Playwright suite `game/tests/e2e/**` only — no production changes.

## Result summary

| Run | Result |
|---|---|
| Audit baseline (`f284606`, `--workers=1`, ~19.6m, from `audit-playwright.json`) | 14 pass / 5 fail |
| This branch before changes (config default `--workers=2`, 7.7m) | 18 pass / 1 fail |
| After changes (config default `--workers=2`, 9.2m) | **19 pass / 0 fail** |

Four of the five audit failures were already resolved on this base by the M-wave
repairs; `turn-combat-hud` remained failing with the same signature as the audit.
`accessibility` passed on this machine before the fix but was still
network-dependent (see below), so its fix is resilience, not regression repair.

## Per-spec findings

### accessibility — FAIL → PASS (resilience fix)

- Audit: FAIL at 16.7s — `không được có console error ngoài allowlist`
  (assertNoBrowserErrors tripped).
- Root cause: `src/assets/theme.css:10` `@import`s a Google Fonts stylesheet at
  runtime. Where external requests are blocked the failure surfaces as a console
  `Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED` error, which the
  spec's console-error gate collects. The spec itself is keyboard-only and
  font-agnostic — the dependency was incidental.
- Fix (test-side, per task ruling): new `tests/e2e/fixtures.ts` exports `test`
  extended with an auto fixture that `page.route`s `https://fonts.googleapis.com/**`
  to an empty `200 text/css` response before any navigation. No `@font-face`
  rules → no `fonts.gstatic.com` binaries requested → zero console noise,
  deterministic offline. Every font stack in theme.css already carries system
  fallbacks, so rendering is unaffected. All 14 specs now import
  `test`/`expect` from `./fixtures` (type-only imports unchanged).
- **Product question for user (deferred):** self-hosting the fonts (bundled
  woff2 + local `@font-face`) would make the *game itself* work fully offline
  and is the stronger fix for real players — a product decision involving
  font licensing and asset pipeline, deliberately not taken here.

### create-to-combat — FAIL → PASS (resolved by base repairs, verified)

- Audit: FAIL at 200.3s — "Combat result modal (victory/defeat) should appear"
  (180s poll inside the 210s cap).
- Diagnosis: a stage-1 battle is real-time turn-based — measured ~65-70 actor
  turns at ~1.8s/turn wall-clock (combat clock 0.1s steps on RAF + per-phase
  Phaser ack pipeline) ⇒ ~118-133s per battle. On the pre-repair audit base
  (ARCH-004 session handoff still broken) the battle did not reach its result
  inside 180s.
- This branch: PASS 2.4m → 2.5m unchanged. No spec edit needed.
- Watch item: the 180s poll has ~35% headroom over the ~135s worst observed
  battle — same measurement basis now documented in turn-combat-hud. If slower
  CI hardware appears, apply the same measured-budget treatment rather than
  investigating a non-existent stall.

### presentation-routing — FAIL → PASS (resolved by M3, verified)

- Audit: FAIL at 41.9s — `expect.poll` for `isActive('CombatScene') &&
  !isActive('MainScene')` stayed false (ARCH-004 session handoff).
- This branch: PASS 22.7s → 27.9s. M3 (`88ed4052`) threads the accepted session
  identity through admission → prepare → READY, so the routing contract holds.
  No spec edit.

### tribulation-flow — FAIL → PASS (resolved by M5/M6, verified)

- Audit: timedOut at 210.6s — the route-home/oracle sequence never completed
  (ARCH-006 duplicate/overwrite-prone terminal outcome; the audit recorded the
  stall at the world-announcement click, where a stuck transition leaves the
  announcement unclickable behind the curtain).
- This branch: PASS 28.1s → 40.9s. M5's unique terminal outcome
  (`89a02161`) + M6 domain-owned settlement (`53889a9a`) let the coordinator
  issue `request({ target: 'home' })` and restore chrome. No spec edit.

### turn-combat-hud — FAIL → PASS (budget repaired from measurement)

- Audit: timedOut at 212.3s waiting for the SECOND battle's result panel.
- This branch before changes: same signature — `Test timeout of 210000ms
  exceeded` at spec line 121 (`victory.or(defeat)` 120s assert for battle 2).
  Error-context snapshot showed battle 2 alive and progressing: wave 6/10,
  round 13/20, player 90/116 HP — not stalled.
- Root cause (instrumented run, polling `getTurnBattle()` via the registry
  seam): battle 1 resolved victory at +138.6s; battle 2 (after refight click)
  resolved victory at +258.4s. Two real-time battles + setup ≈ 260-280s cannot
  fit a 210s cap, and each 120s per-assert budget sat *under* the ~135s
  worst-measured battle. **Not ARCH-005**: the result modal rendered
  (`resultModal:true`) the moment the domain state reached victory — the
  projection the spec waits on is unaffected by the useTurnCombatManual
  reactivity debt, which is M12's scope.
- Fix: `test.setTimeout` 210s → 420s; both per-battle `toBeVisible` budgets
  120s → 180s (same ~1.35x headroom create-to-combat already applies to the
  same battle shape). Header comment now records the measured pacing so the
  budget is attributable to evidence, matching the config's convention.
- After: PASS 4.6m — battle 2 resolved, refight regression oracle intact
  (full "resolves" assertion kept; no coverage traded for time).

## Changes

- `tests/e2e/fixtures.ts` (new): auto font-stub fixture + re-exported
  `expect`/`Page`/`Locator`.
- `tests/e2e/*.spec.ts` (14 files): import `test`/`expect` from `./fixtures`.
- `tests/e2e/turn-combat-hud.spec.ts`: measurement-based budgets
  (210s→420s test cap, 120s→180s per-battle asserts) + pacing comment update.

No production files touched. `npm run type-check` clean; `npx eslint
tests/e2e/**` clean; full `npx playwright test` 19/19.

## Remaining concerns

- `turn-combat-hud` is now the suite's critical path (~4.6m of a 9.2m run at
  2 workers). Acceptable per the config's reliability-first precedent; a
  faster oracle (e.g., asserting battle-2 *progress* rather than resolution)
  was deliberately not taken to keep the refight-resolves coverage.
- The suite is still Chromium-only; audit environment blocked external
  network — fixtures.ts removes that dependency entirely.
- M12 (ARCH-005/012/014) lands in parallel: ARCH-005 does not block any spec
  here, but ARCH-014 (natural defeat never emits `battle_end`) may matter if a
  future spec asserts scene/audio cleanup on the defeat path — noted for the
  coordinator.
