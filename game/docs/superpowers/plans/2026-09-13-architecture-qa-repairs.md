# Architecture & Deep-QA Repair Plan — 2026-09-13 audit findings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the defects and authority-boundary leaks found by the 2026-09-13
whole-codebase deep audit (`docs/qa/2026-09-13-whole-codebase-deep.md`), in
severity order, without redesigning gameplay.

**Architecture:** No new systems. Every repair moves the existing rule to its
existing owner: the coordinator owns routes, `GameManagerAutoFarmOps` owns
cycle-guard symmetry, `BattleLootSystem` owns the kill-reward input contract,
formation commit validation belongs in domain ops, dead presentation flags are
retired under R13.

**Source report:** `game/docs/qa/2026-09-13-whole-codebase-deep.md` — read it
first; finding IDs F1-F4 below refer to it.

## Global Constraints

- Commit per wave; **no merge/push** without user authorization (P7).
- TDD: the audit's intended-failing tests already exist — they must flip green
  for the stated reason before a wave is done. New production logic needs new
  failing tests first.
- Comments English/ASCII (P15). No new deps. No `any` without a report note (P8).
- Verify per P3: `quick` = `npm run type-check` + `npx vitest run <scope>`;
  Wave 4 touches e2e infra → run the affected spec.
- Do not weaken or delete the audit's repro tests to make them pass — repair
  production code instead.
- Roadmap note: `docs/roadmap.md` records R13 (legacy/parallel authority
  retirement) as parked — Wave 3 stays inside its scope boundaries and should be
  reported back to the roadmap entry.

---

## Wave 1 — F1 Critical: tribulation outcome never routes home

**Files:** `src/App.vue`, `src/composables/useTribulation.ts`,
`src/presentation/tribulationRouting.test.ts` (repro — flips green),
new `tests/architecture/tribulationOutcomeWiring.test.ts`.

**Root cause:** `App.vue:451` calls
`checkTribulationOutcomeAction(player, gameManager)` without `presentation`, so
the behind-curtain `request({ target:'home' })` branch never runs in production.
The route stays `tribulation` forever → home chrome hidden, overlay empty, Phaser
scene never deactivated → soft-lock until reload.

### Tasks

- [x] **1.1 Wire the presentation object through the real call site.** In
  `App.vue` `tick()`, change the call to
  `checkTribulationOutcomeAction(player, gameManager, presentation)`
  (`presentation` already exists at App.vue:167). No other behavior change —
  the `presentation` branch already implements the intended contract
  (behind-curtain outcome + route home + next-tick retry on rejection).

- [x] **1.2 Confirm the audit repro flips green.**
  `npx vitest run src/presentation/tribulationRouting.test.ts` — the
  `REPRO: production outcome check …` case must now pass, proving the exact
  production signature routes home. Keep the test (rename `REPRO:` prefix to a
  normal name if preferred, but do not delete).

- [x] **1.3 Add a static wiring guard (P13 class).** New
  `tests/architecture/tribulationOutcomeWiring.test.ts`, modeled on
  `paidRandomContract.test.ts`: read `src/App.vue` source and assert the
  `checkTribulationOutcomeAction(` call site passes a third argument
  (regex on the call expression, comment-stripped). This is the cheap guard
  that would have caught the regression.

- [x] **1.4 Retire the dead composable path.** `useTribulation()` returns
  `checkTribulationOutcome` with zero callers — remove that key from the
  returned object (keep `triggerBreakthrough`). Grep first to prove no
  consumer exists.

- [x] **1.5 Manual sanity (optional, P14):** run the app, force a tribulation
  outcome via the debug seam, confirm return to home. If no fast-forward seam
  exists, defer to Wave 4's e2e spec — do not add debug surface here.

## Wave 2 — F2 Medium: `tickAutoFarm` unguarded `cycleSeconds`

**Files:** `src/core/game/GameManagerAutoFarmOps.ts`,
`src/core/game/GameManager.autoFarmAdversarial.test.ts` (repros — flip green),
optionally `src/services/save/saveShapeValidation.ts` (+ its test).

**Root cause:** the online tick checks only `cycleSeconds === undefined`; the
offline path rejects non-positive/non-finite values. `perfectClearSeconds` is
persisted but never shape-validated.

### Tasks

- [x] **2.1 Align the online guard with the offline one.** In `tickAutoFarm`,
  replace the `undefined`-only check with the same predicate
  `settleAutoFarmOffline` uses:
  `cycleSeconds === undefined || !(cycleSeconds > 0) || !Number.isFinite(cycleSeconds)`
  → early return. Extract the shared predicate only if both call sites read
  cleanly with it — a duplicated one-liner is acceptable (A9 prefers a shared
  rule; weigh readability).

- [x] **2.2 Also guard `autoFarm.lastCheckedMs`** (same block): if not finite
  or negative, reset to `Date.now()` — a NaN marker must recover, not freeze
  the feature silently.

- [x] **2.3 Confirm both audit repros flip green.**
  `npx vitest run src/core/game/GameManager.autoFarmAdversarial.test.ts`.

- [x] **2.4 (optional, defense-in-depth) Add `perfectClearSeconds` value
  validation to `saveShapeValidation.ts`**: record must be a finite positive
  number per stage id, and the id should exist in `perfectClearStageIds`-shape
  rules already present. Only if the validator already has a numeric-record
  pattern to extend; otherwise note it as residual risk in the report rather
  than growing the validator here.

## Wave 3 — F3/F4 Low + dead-authority residue (R13 scope)

Order inside the wave is free; each item is independent.

### Tasks

- [x] **3.1 F3 — honest reward input for idle kills.** `BattleLootSystem.
  processDefeatedEnemies` reads `battle.player` only for the heal-on-kill
  target; talents/drops already read the session `this.player`. Introduce a
  narrow input contract (e.g.
  `processDefeatedEnemies(enemies: { entity: CombatEntity; rewardGranted: boolean }[], healTarget: CombatEntity | null, stage?)`
  — or keep the `Battle` shape but require `player: CombatEntity | null`), then
  have `GameManagerAutoFarmOps.rollAutoFarmCycleReward` pass `player: null`
  instead of a dead-enemy stand-in, and delete the `as unknown as Battle` cast.
  Update real-battle call sites to pass the live player entity. Expected
  behavior delta: with heal-on-kill talent, auto-farm stops emitting phantom
  vitals events for a dead enemy — confirm no test asserts those events.

- [x] **3.2 F4 — formation commit through a validating owner.** Add
  `gameManager.<ops>.setFormationLoadout(player, loadout)` (home:
  `GameManagerTurnBattleOps` or a small dedicated ops — follow existing ops
  naming) that validates: formation id exists in `TRAN_PHAP_FORMATIONS`, every
  `combatantId` is `'player'` or an owned companion `definitionId`, cells are
  inside the formation's `cellPattern`, no duplicate combatant. Return boolean.
  `TranPhapPanel.onConfirm` calls it and only bumps state on success. Add a
  `watch` on `player.formationLoadout` (or resync on panel open) so the draft
  cannot go stale against an external change. Tests: reject unknown combatant,
  reject out-of-pattern cell, dedupe, accept a legal loadout, stale-draft
  resync.

- [x] **3.3 Retire dead presentation residue** (each removal needs a
  consumer-absence grep recorded in the commit message):
  - `syncLegacyBattleState` dep + call sites (`CombatAnimationRuntime.ts:294,323`,
    `GameManagerTurnBattlePresentationOps.ts:73`) — remove the dep entirely.
  - `ui.isTribulationSceneActive` + `enterTribulationScene`/`exitTribulationScene`
    and the `tribulation_scene_exit` emit — remove if no standalone-test consumer
    remains (fallback reads in `useStageActive`/`GameRoot` may keep a minimal
    flag; keep only what the no-adapter fallback genuinely needs).
  - `ui.combatSceneDismissed`/`ui.combatOrigin` — same treatment if dead.
  - Fix stale comment `GameManagerTickOps.ts:65` ("live in Vue until R8.2").

## Wave 4 — Coverage gaps (prevents this class of escape)

- [x] **4.1 Tribulation e2e spec** (`tests/e2e/tribulation-flow.spec.ts`):
  boot → create character → open breakthrough flow → enter tribulation →
  fast-forward to outcome (existing debug hooks if any; otherwise a minimal,
  clearly-marked dev-only seam — scope carefully) → assert route returns home
  and home chrome is visible. This is the P13 wiring oracle F1 lacked.
- [x] **4.2 Repair `standing-slot-panel.spec.ts`** (pre-existing rot): the spec
  waits for a removed test-only "Hỗn Độn Trận" formation and a `__grant-test`
  button. Either restore a dev-gated test formation + grant hook, or rewrite
  the spec against the real formation with the most open cells and real
  companions via a save-seed helper. Choose whichever is smaller; the goal is
  a working drag-drop oracle, not the old fixture.
- [x] **4.3 i18n key parity guard**: test that every `t('...')`/template key
  used in `src/**` exists in both `vi` and `en` locale files (the e2e console
  showed `panels.stageSelect.*`, `panels.wheel.aria.group`,
  `onboarding.auth.eyebrow` missing in both). Fix the currently-missing keys
  in the same change.

## Ordering rationale

1. **Wave 1 first** — ship-blocker, one-argument repair, repro already in place.
   It also unblocks real playtesting of the breakthrough loop.
2. **Wave 2** — one-line guard alignment; freezes are worse than any Wave 3 item.
3. **Wave 3** — coherent small migrations (reward contract, formation commit,
   dead-code retirement) once the critical paths are safe; independent tasks,
   parallelizable across workers if desired.
4. **Wave 4** — coverage/tooling that prevents recurrence; e2e work is the
   heaviest and is deliberately last so fixes land first.

## Verification per wave

- Wave 1: `npx vitest run src/presentation/tribulationRouting.test.ts
  tests/architecture/tribulationOutcomeWiring.test.ts` + `npm run type-check`.
- Wave 2: `npx vitest run src/core/game/GameManager.autoFarmAdversarial.test.ts
  src/core/game/GameManager.autoFarmOffline.test.ts` + type-check.
- Wave 3: per-task focused scope + `npm run type-check`; `quick` mode overall.
- Wave 4: the new/repaired e2e specs via `npx playwright test <spec>` (dev port
  from playwright.config; don't assume one).

## Explicitly out of scope

- No `GameManager`/`CombatScene` rewrite; no rebalancing; no R11/R13 expansion
  beyond the residue items listed.
- No gameplay redesign: the tribulation outcome content, auto-farm cycle math,
  and formation semantics stay exactly as designed.
