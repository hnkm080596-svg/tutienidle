# QA Quick — R14 Slice 2: Combat Contract + Ownership Guards, Flaky Fixes, Task 9 Leak Fix

- **Date:** 2026-09-11
- **Scope:** branch `r14-slice2` (base: master `c900e48f`) — 2 new guard
  files (7 tests), 2 flaky-test RNG pins, 1 production leak fix
  (CombatScene.onBattleStart), lifecycle-test stub update.

## Mapper result

2 domains (`combat-and-tribulation`, `pinia-phaser-sync`),
`deepAuditCandidate: true`. Bounded by inspection:

- **Phaser lifecycle:** the only production change adds
  destroy+clear of `turnCountdownSpawnVfxHandles` in `onBattleStart` —
  byte-equivalent to the shutdown pattern that already clears the same map;
  no new Phaser objects, no event rewiring. The full scene suite (29 files /
  180 tests) is green, and the lifecycle test caught the stub gap RED
  before being updated — the change is observable, not paper-green.
- **Combat outcome:** the two new guards are read-only source scans; they
  cannot change runtime behavior. RNG pins touch only test dice in the 2
  named test files.
- Escalation to deep therefore not warranted.

## Invariant ledger

| # | Hypothesis | Evidence | Result |
|---|---|---|---|
| H1 | Guards silently pass (not falsifiable) | Probe runs: injected `p.greatDaoOpportunityLost = true` into an adapter tripped R14.5 (2 tests RED); injected `this.scene.pause()` into CombatScene tripped R14.4 (1 RED). Probes removed, all green after | PASS |
| H2 | Task 9 fix breaks scene lifecycle | backgroundLifecycle test RED on the stub gap (undefined `.values()`), GREEN with 3-line stub update; full scenes suite 180/180 | PASS |
| H3 | RNG pins change test meaning | HiddenBeast: pinned sequence yields exactly 5 hits in 100 rolls — same assertions pass, now deterministic (10/10 runs). selfBuff leech: 0.5 lands the hit, heal > 0 — same assertion, 10/10 runs | PASS |
| H4 | Flake #3 (useAppLifecycle) misclassified | 5/5 isolated passes; the full-run failure was "Failed to start forks worker" = vitest worker spawn under cold-start contention, not test logic. No fix available at test level; documented | BOUNDED (environment) |
| H5 | Full-suite stability after fixes | P3 full: 490 files / 3295 tests — **zero flakes in the run** (previous full runs dropped 1-2 flakes) | PASS |

## Confirmed defects

None new. One production gap FIXED behind a guard: the QA Task 9
"enforced nowhere" invariant (onBattleStart countdown telegraph leak).

## Suspected / coverage gaps

- The R14.4 guard anchors are source-scans: renaming `onBattleStart` or
  moving `drainBoundaryQueueIfIdle` would trip the guard (intended —
  forces a conscious guard update), not silently pass.
- useAppLifecycle worker-spawn flake remains an environment limitation
  (vitest forks pool under cold start); revisit only if it recurs with a
  test-logic signature.
- P14 deferred (isolated worktree; no visual surface — handle clear is
  behavioral hygiene, already covered by scene suites).

## Verification evidence

- type-check PASS, build PASS
- Full suite: **490 files / 3295 tests PASS, zero flakes**
- Architecture guards: 15 files / 60 tests PASS (13 old + 2 new)
- eslint on all touched files: 0 errors (39 pre-existing warnings)

## Verdict

**PASS WITH EVIDENCE**
