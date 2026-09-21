# P3 — Production Combat Vertical Slice — Adversarial QA (quick)

Date: 2026-09-22. Branch: `p1-canonical-path-authority` (worktree
`.agent-worktrees/p1-canonical-path-authority`). Mapper output:
`deepAuditCandidate: true` (3 domains: combat, pinia-phaser-sync,
ui-input-lifecycle) — bounded by inspection: the production delta is ONE
CSS line in `CombatExitConfirmModal.vue`; all other files are new tests
(`unmappedPaths`) + docs. The domain span comes from the E2E spec
touching UI+engine, not from production surface.

## Hypotheses checked (bounded)

1. **`pointer-events:auto` on the exit-confirm overlay could swallow
   canvas/scene clicks.** Bounded: the overlay is `v-if="visible"` — it
   exists only while the modal is open, and a modal scrim swallowing
   clicks is the intended behavior (same pattern as
   `CombatResultModal:49`). While closed, zero hit-test impact. Verified
   live: `combat-vertical-slice.spec.ts` abandon loop clicks "Thoát Trận"
   through the real browser and lands `abandonBattle` -> home.

2. **Modal staying open over a natural terminal could deadlock the
   result panel.** Bounded: exit-confirm is `z-index:50`, result modal
   `z-index:30` — the exit modal stays on top and clickable ("Ở Lại"
   dismisses; "Thoát Trận" exits via `exitCombatToHome`, and
   `abandonBattle` self-guards on an already-terminal battle). No
   unreachable UI state.

3. **Seeded vertical-slice test could be flaky via between-poll seal
   consumption.** Bounded: `ManualClockSource` + `SeededCombatRng` make
   poll points deterministic — same input sequence yields identical
   observed sets. The pinned seal/reaction-id sets are the regression
   oracle by design.

4. **E2E `w.__vsWinningBattle` window pollution.** Test-scoped field,
   no production read. Non-issue. (Renamed post-review: the fresh-instance
   oracle compares against the exact winning terminal battle captured
   before retry, not the stage-entry attempt.)

## Verdict

**PASS WITH EVIDENCE.**

- `npm run verify` — type-check ✓, build ✓, 692 files / 6051 tests
  (4 expected-fail) after the post-review strengthening round.
- `tests/e2e/combat-vertical-slice.spec.ts` — 2/2 (victory loop 2.7m,
  abandon loop 2.2m), inside this worktree.
- `tests/e2e/cultivation-path-ritual.spec.ts` — 7/7 (P13 regression on
  the same surface).
- ASCII ratchet — green.
- Confirmed production defect found BY the E2E and repaired:
  `CombatExitConfirmModal` unclickable (`pointer-events` inheritance) —
  evidence: Playwright hit-test log (canvas intercepting) -> fix ->
  green abandon loop.

## Residuals (recorded, not blocking)

- The victory loop accepts defeat->retry once before requiring a win —
  honest flake guard for an unseeded browser battle.
- `expect.poll` around `getBattleBuffs` covers the aura grant window;
  seal polling at engine level is the deterministic oracle (E2E does not
  assert seal ids — per the approved evidence split).

## Post-external-review round (ChatGPT CHANGES -> fixes)

External review returned 1 HIGH + 2 MEDIUM + 1 LOW on the test matrix
itself (no production-code findings). Fixes applied and verified:

1. **HIGH — terminal matrix under-proved the contract.** The matrix now
   behaviorally asserts per path: fresh scheduler instance
   (`combatScheduler` identity differs — op queue + reaction journal live
   on it), clock counters restart at 0 on synchronous mints, sentinel
   seals applied pre-terminal never reach the next battle (extended to
   the natural-defeat path), entry aura re-grants as a NEW instanceId
   (embeds per-cycle battleId — a carried registry entry would keep the
   old id), survive-lethal charge re-derives per cycle (consume -> 0 ->
   re-mint 1 -> talent swap -> 0, which also proves activeBuild
   re-resolution), and a failed mid-commit cycle leaves the guard
   untouched (0) with the next battle minting it fresh (1).
2. **MEDIUM — listener audit strengthened with a cycle-scoped
   double-fire oracle.** New test: ngo_dao battle 1 resolves one manual
   seal pair (xuyen_tho) -> abandon -> battle 2 resolves the same pair.
   Exactly +1 `reaction_resolved` on the bus and exactly 1 in cycle-2's
   own scheduler trace proves: no journal-cursor leak (a leak re-emits
   battle-1's entries), no duplicated per-cycle dispatcher subscription
   (a leak double-fires), fresh elemental boards (a leak refuses or
   stacks the re-application). Kit stripped post-ritual so every
   reaction comes from the manual pair.
3. **MEDIUM — E2E refight identity false-pass.** `__vsBattle1` (minted at
   stage entry) could differ trivially from a post-retry battle when
   attempt 1 lost. Now captures `__vsWinningBattle` — the exact terminal
   object the victory panel belongs to — immediately before retry, and
   asserts the new battle differs from it + `roundsElapsed` resets.
4. **LOW — stale plan/docs.** M3 Step 1/3 checked off; Step 3 and the
   header flow corrected to the real routing (abandon -> home under the
   curtain; the defeat panel is the natural-defeat surface only).

Verification post-fix: battleTeardown 10/10, type-check clean, ASCII
ratchet green, E2E spec re-run (see final gate line).

Post-fix gate evidence: `npm run verify` 692 files / 6051 tests
(4 expected-fail); `combat-vertical-slice.spec.ts` 2/2 (4.7m) after the
emit-retry fix (the exit modal subscribes in onMounted - a lone early
emit could drop, so both exit flows now emit idempotently until the
modal or a result panel renders).

## Sequential review - delta pass over the review-fix delta

Pass over the post-CHANGES state (test-only + doc delta):

```
Sequential Review Pass 4 (delta - local correctness + adversarial)
  Reviewed state: post-CHANGES teardown/E2E strengthening
  Findings:
    - e2e single-emit race in BOTH exit flows (top-bar visible before
      the modal's onMounted subscription) - caught by a real rerun
      failure, fixed with idempotent emit-until-visible loops
    - roundsElapsed missing from GameManagerHandle type - fixed
  Verification: battleTeardown 10/10, verticalSlice 2/2, type-check,
    ratchet, full verify 692/6051, E2E 2/2
  Residual: none Medium+ - all oracles behavioral, no production delta.
```
