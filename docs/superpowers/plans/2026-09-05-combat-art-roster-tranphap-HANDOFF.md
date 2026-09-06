# Handoff — Combat Art Pipeline + Companion Roster + Trận Pháp

**Date:** 2026-09-06
**Plan:** `docs/superpowers/plans/2026-09-05-combat-art-roster-tranphap.md` (23 tasks)
**Status:** **Part A complete (Tasks 1–9.9).** Parts B and C (Tasks 10–21) not started.
**Branch:** `feat/combat-art-roster-tranphap`, worktree `.agent-worktrees/combat-art-roster-tranphap`
**Base:** `da0ac99`
**Suite:** 413 files / 2651 tests green; `npm.cmd run type-check` clean.

> **Read this first:** work is paused on Parts B/C by user decision to fix a critical pre-existing bug — see "Why this is paused" below. That fix is happening on this same branch.

## How this was run

`superpowers:subagent-driven-development`: fresh implementer subagent per task → task reviewer (spec + quality) → fix loop → ledger entry. Ledger, task briefs, implementer reports, review diffs and screenshots live in:

`.superpowers/sdd/2026-09-05-combat-art-roster-tranphap/`

**That directory is git-ignored scratch.** If it's gone, this doc plus `git log` is the record.

### Keep the per-task review layer

Across 11 tasks it caught, none of which the implementers' own green test runs found:
- A **live shipped-feature bug**: bosses silently stopped spawning from cycle 2 onward when auto-repeat farming a boss stage.
- **Two tests that could not fail** — they passed identically with the feature deleted.
- A **visual regression that would have silently broken a later task**: `isBoss` hardcoded false meant later-wave bosses got normal HP bars, which would also have killed Task 9.5's boss-scale feature.
- A **projection bug that inverted the battlefield**: a narrow window plus a wide dock produced a negative cell size, rendering columns right-to-left.
- A boss without art rendering **smaller than a normal enemy** — the exact inverse of the feature's intent.

### Two operational lessons

1. **Implementer subagents stall** if they background long test runs and wait for notifications. Tell every dispatch: *run all commands synchronously in the foreground.* When one stalls, check `git status` (work is usually complete but uncommitted) and resume it with that instruction.
2. **The type gate in the plan is wrong.** The plan says `npx vue-tsc --noEmit`; that checks **nothing** — the root `tsconfig.json` is solution-style with `files: []`, so it walks zero files. It let two tasks ship type errors. **The real gate is `npm.cmd run type-check`** (`vue-tsc --build`). Every future dispatch must say so.

## Why this is paused

Task 9.9's Playwright verification found the game **cannot play a battle in a browser at all** — it freezes on the "Xuất Trận!" countdown forever, with zero console errors.

Root-caused and independently verified: **the app's tick loop is never started.** `App.vue` defines `startTickLoop()` (~line 345) but nothing calls it; the boot-success path (~418-425) sets `isBooted` and starts autosave only. Since `App.vue`'s `tick()` is the sole non-test caller of `GameManager.update()`, the **entire simulation** is frozen — combat, cultivation, idle progression, production. Introduced by commit `d6d9a1d` ("lifecycle idempotence", 2026-09-05), which extracted boot logic into `useAppLifecycle.ts` and dropped the call. **Present on master. Not caused by this branch** — proven by reproducing it on a clean master checkout.

**2651 unit tests were green while the game was unplayable**, because every test calls `gameManager.update()` directly and bypasses `App.vue` entirely. Closing that coverage gap is part of the fix.

Details: `.superpowers/sdd/.../freeze-rootcause.md` and `freeze-investigation.md`.

## What Part A shipped

1. Battlefield is two 6×6 side boxes (player rows 3-8/cols 0-5, enemy rows 3-8/cols 7-12, column 6 a neutral divider).
2. Enemies confined to the enemy box; **bosses spawn at its exact centre**.
3. **Boss stages contain exactly one enemy** — bosses always fight solo, enforced in code rather than by content convention.
4. Player positioned from formation data (`PartyFormationSlot`) instead of a hardcoded spot.
5. **The original bug fixed:** combat art renders live again, via a new `turn_battle_entity_snapshot` event replacing the dead legacy `positions` bridge.
6. Skill UI moved to a **right-edge dock**; the Phaser projection reserves space so the battlefield shrinks rather than being covered.
7. Combat art loads and plays through real **Phaser sprite-sheet animations** (idle/ready/cast/standby/death), currently 1-frame placeholders wrapping existing PNGs — real sheets become a content drop. Death waits for its animation before removal.
8. **Bosses render at 2× a regular enemy** (×4 source art).

**None of this is visually confirmed** — the freeze blocked every playtest. It is covered by unit tests only.

## Start here (after the freeze fix lands)

1. **Re-run Task 9.9's verification.** Its automated gates passed, but the visual half never ran. Screenshots and the report are in the scratch dir; only the frozen countdown was capturable. Redo the playtest: enemies spawning/updating/dying, the right dock, a centred solo boss at 2× size.
2. **Check the e2e suite.** 4/10 passed; 3 failures were this freeze, 3 looked like parallel-run mount-timing flake. Re-evaluate once unfrozen. Task 9 fixed a stale selector (`.combat-scene-overlay__build-hud` → `.combat-skill-dock-panel`) that had **never actually been executed** until 9.9.
3. **Then Task 10** (Part B, Companion Roster).

## Rulings made during execution

Decisions taken on the user's behalf — review and overturn any you disagree with.

1. **Batched Tasks 2 + 2.5** into one dispatch (the brief script bundles them; both concern boss spawn).
2. **Rewrote `EffectiveEnemyCount.ts`'s English header comment to the Vietnamese house style, overriding the plan's own code block** — the plan's Global Constraints outrank an illustrative snippet inside a task step.
3. **Pulled the `actionPlayback` flake into scope** rather than deferring — every remaining task gates on "suite green", so a ~27%-failure test makes that gate worthless. The implementer's first diagnosis was wrong; real cause was a genuine ~20% miss chance (`accuracyRating` 100 vs enemy `evasionRate` 25). Fixed by pinning `evasionRate: 0`, matching five existing test files.
4. **Ordered Task 3's test rewritten over the implementer's objection** — it passed identically with the feature deleted.
5. **Deferred Tasks 5/7/9/9.5's manual browser verification to Task 9.9**, since subagents can't drive a live canvas — but required Task 5 to *extract* its reconciliation logic into a pure, unit-tested module rather than accept "it's Phaser, untestable". (In the end 9.9 couldn't verify either, because of the freeze.)
6. **Fixed Task 5's `isBoss: false` hardcode at the source** (extended the event schema with `isBoss` + `name`) rather than documenting it — it was load-bearing for Task 9.5.
7. **Did not merge master mid-plan.** Master diverged 40 files / 1879 insertions including `GameManager.ts` and `CombatScene.ts`. Integrate at finish time.
8. **Narrowly reversed #7 to cherry-pick one commit** (`a06e402` → `5ff3fa0`): a `DebugDamage.test.ts` flake that failed only in full-suite runs. It touches two test files this branch never modifies, so the pick was conflict-free, and leaving it would have poisoned every remaining task's verification.
9. **Parked Task 9's double-texture-loading finding** rather than opening a fix round. Every combat entity now loads under two texture keys (plain image + 1-frame spritesheet), roughly doubling decoded combat-art memory. The reviewer verified the rationale is real — `MainScene.ts:178/237/244`, `combat-grid-view.ts:275`, `combat-player-visual.ts:44` genuinely need the plain keys, and all are outside the task's scope. **Follow-up owed:** once real multi-frame sheets land, retire the plain-image loads or migrate those three consumers to frame 0.

## Open items

### Needs a decision
- **BattleLogPanel overlap.** The dock fix (`29ba0fc`) resolved the TopBar overlap; the BattleLogPanel one is a *horizontal* collision the top-offset change can't address. Still open.
- **TurnOrderStrip** now shares a layout token with the dock, but may still paint over it on very narrow viewports (cosmetic; the strip is `pointer-events: none`).

### Deferred minors for the final whole-branch review
- `NEUTRAL_DIVIDER_COLUMN` (6) hardcoded rather than derived from `PLAYER_SIDE_REGION.columnMax + 1`.
- `EnemySpawnPlacement.test.ts` lost the old "RNG độc lập" call-count assertion; since the enemy region's row and column spans are both 6, a regression reusing one `random()` call for both axes would pass undetected.
- Pre-existing **mojibake** (double/triple-encoded UTF-8) in comments in `GameManager.ts` (~2444-2447, ~3152-3161) and `CombatScene.enemyScale.test.ts`. Deliberately untouched across several tasks; candidate for a dedicated encoding-cleanup pass.
- No end-to-end test of the `alive: false` dead-entity path through `GameManager`.
- Stale comment in `Player.ts:429` references a non-existent `HERO_HOME_X`.
- `registerCombatAnimations(_entityKey, ...)` takes an unused parameter.
- `CombatScene.ts` grew 232 lines in Task 9. Factored into 5 named private methods, but if more animation states arrive, extract them into `combat-animation-controller.ts`, mirroring the existing `combat-grid-view.ts` / `combat-entity-reconciliation.ts` split.

## Constraints for the remaining tasks

- **Tasks 3 → 19 share `buildTurnBattle()`.** Task 19 replaces Task 3's `const formation = DEFAULT_PARTY_FORMATION` placeholder with `resolvePartyFormation(playerPath)`. Don't let two passes edit it independently.
- **`PartyFormationSlot { combatantId: string; row: LaneIndex; column: number }`** — defined in Task 3, reused verbatim by Tasks 18/19. `combatantId` is `'player'` or a companion's `definitionId`, deliberately **not** a numeric index.
- **Task 5 owns its own known-id sets** (`knownTurnBattlePlayerIds`/`knownTurnBattleEnemyIds`) rather than scanning the shared `this.sprites` map — `reconcileEnemySprites()`'s removal loop scans the whole map and would let one side destroy the other's sprites. Task 9's death-deferral preserved this; anything further must too.
- **Save versions are sequential:** Task 11 → v57 (`companions`), Task 17 → v58 (`formationLoadout`). Task 11 must land first.
- **Unverified fixture shape:** Tasks 10/12/14/19's test fixtures guess `TurnSkillDefinition` as `{ id, cooldownTurns, damage: { kind, multiplier }, targeting: { shape } }`. Never checked against the real `game/src/core/battle/turn/TurnSkillAction.ts`. **Task 10 must read the real interface first** and carry the true shape into 12/14/19.
- **The plan flags its own guesses** needing a fresh read — e.g. Task 19's `this.turnBuffRegistry` field name. Treat the plan's code blocks as *shape*, not literal patches: `GameManager.ts` has drifted substantially from the plan's quoted snippets.
- **House comment style is enforced by review:** short English/technical lead-in, substantive explanation in Vietnamese. Several tasks were sent back over this.
