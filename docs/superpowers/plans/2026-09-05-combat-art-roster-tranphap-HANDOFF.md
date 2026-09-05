# Handoff — Combat Art Pipeline + Companion Roster + Trận Pháp

**Date:** 2026-09-06
**Plan:** `docs/superpowers/plans/2026-09-05-combat-art-roster-tranphap.md` (23 tasks)
**Status:** Tasks 1–5 complete and reviewed clean. Task 6 complete with fix applied but **re-review not run**. Tasks 7–21 not started.
**Branch:** `feat/combat-art-roster-tranphap`, worktree `.agent-worktrees/combat-art-roster-tranphap`
**Base:** `da0ac99`. Working tree clean, 14 commits.
**Suite at handoff:** 410 files / 2625 tests green, `vue-tsc --noEmit` clean.

## How this was being run

`superpowers:subagent-driven-development`: fresh implementer subagent per task → task reviewer (spec + quality) → fix loop if findings → ledger entry. Ledger, task briefs, implementer reports and review diffs live in:

`.superpowers/sdd/2026-09-05-combat-art-roster-tranphap/`

That directory is **git-ignored scratch**. If it's gone, this doc plus `git log` is the record.

**Keep the per-task review layer.** In six tasks it caught: a live shipped-feature bug, two tests that could not fail, a visual regression that would have silently broken a later task, and a projection bug that would invert the battlefield. None of these were caught by the implementers' own green test runs.

**Operational note:** implementer subagents stalled three times by backgrounding long test runs and waiting for notifications that never arrive. Tell every implementer explicitly: **run all commands synchronously in the foreground.** When one stalls, check `git status` — work is usually uncommitted but complete — and resume it with that instruction.

## Commits

```
6d6392f fix(combat-art): Task 6 fix round 1 — flat centerX, degenerate cellSizePx floor, stronger perspective width test
46a33e1 feat(combat-art): extend CombatInsets with right field for Task 7 skill dock
5feeeb3 fix(remediation): Task 5 fix round 1 — thread isBoss/name through turn_battle_entity_snapshot, guard dead-on-create
7bfba8d feat(combat-art): CombatScene renders live entity state from turn_battle_entity_snapshot instead of the frozen legacy positions snapshot
92d4c17 test(combat-art): cover all 3 fixed-step sub-branches for turn_battle_entity_snapshot
00dff17 feat(combat-art): emit turn_battle_entity_snapshot every fixed step, replacing the dead legacy positions bridge
3cbcd70 fix(remediation): party formation test now proves placement source; fix action-playback flake
6149b12 feat(combat-art): buildTurnBattle() places the player via PartyFormationSlot instead of a hardcoded placeholder x
7888262 docs(combat-art): EffectiveEnemyCount.ts header — house-style comment
bab6ff1 fix(combat-art): restartTurnBattleCycle() repeat-cycle boss spawn bug
e15ed17 feat(combat-art): boss stages are always solo — effectiveTotalEnemyCount() overrides content-data totalEnemyCount
d0b760e feat(combat-art): confine enemy spawn to ENEMY_SIDE_REGION, force boss to region center
4010515 fix(combat-art): translate BattlefieldRegions.ts comments to Vietnamese per codebase convention
2e1b09c feat(combat-art): add PLAYER_SIDE_REGION/ENEMY_SIDE_REGION battlefield split
```

## Task status

| Task | State |
|---|---|
| 1 — `BattlefieldRegions.ts` (two 6×6 side boxes) | ✅ complete, reviewed clean |
| 2 — enemy spawn confined to `ENEMY_SIDE_REGION`, boss centered | ✅ complete, reviewed clean |
| 2.5 — `effectiveTotalEnemyCount()`, boss always solo | ✅ complete, reviewed clean |
| 3 — `PartyFormationSlot`/`DEFAULT_PARTY_FORMATION` | ✅ complete, reviewed clean |
| 4 — `turn_battle_entity_snapshot` event | ✅ complete, reviewed clean |
| 5 — `CombatScene` consumes it, renders live | ✅ complete, reviewed clean |
| 6 — `rightInset` projection plumbing | ⚠️ **fix committed, re-review NOT run** — start here |
| 7–9.9 (Part A remainder) | ❌ not started |
| 10–15 (Part B, Companion Roster) | ❌ not started |
| 16–21 (Part C, Trận Pháp) | ❌ not started |

**The original user-reported bug — combat art not rendering — is fixed as of Task 5** (`7bfba8d`/`5feeeb3`). Everything after is the rest of the plan.

## Start here: finish Task 6's review loop

Task 6's fix (`6d6392f`) addressed three Important findings but **the scoped re-review was never dispatched**. Before starting Task 7, run it. The diff package is already generated at:

`.superpowers/sdd/2026-09-05-combat-art-roster-tranphap/review-46a33e1..6d6392f.diff`

Findings to verdict (from the Task 6 review):
1. **`FlatGridProjection.bounds().centerX`** reported the raw full-screen centre while `left`/`right` were `rightInset`-aware — inconsistent within one method. Perspective mode had it right. Fixed to derive from `gridLeft` + half the grid width; a test now pins it.
2. **Flat-mode `cellSizePx` could go negative.** `availableWidth` was floored at 0 but `(availableWidth - 24)` wasn't, so a narrow viewport plus a wide dock made the width term negative, win the `Math.min`, and **invert the grid** (columns rendering right-to-left). Perspective already guarded this with `Math.max(1, ...)`; flat now does too, with degenerate-case tests in both modes.
3. **The perspective test would pass under a half-correct fix** — it asserted only that a point shifted left at column 8, which the `centerX` shift alone produces even if `nearWidth` ignored the inset. Strengthened to compare the x-span between edge columns.

Use `superpowers:subagent-driven-development`'s `re-review-prompt.md`. If clean, ledger `Task 6: complete` and proceed to Task 7.

## Rulings made during execution

Decisions taken on the user's behalf — review and overturn any you disagree with.

1. **Batched Task 2 + 2.5 into one dispatch.** The brief script bundles them; both concern boss spawn behaviour. *Cost if wrong:* one review surface covers two commits.
2. **Rewrote `EffectiveEnemyCount.ts`'s English header comment to the Vietnamese house style, overriding the plan's own code block** — the offending text was copied verbatim from the plan's Task 2.5 Step 3. Ruled the plan's Global Constraints outrank an illustrative snippet inside a task step. *Cost:* a comment reads differently than drafted; zero behavioural risk.
3. **Pulled the `actionPlayback` flake into scope** instead of deferring it. All remaining tasks gate on "full suite green"; a test failing ~27% of runs makes that gate worthless. *Cost:* work outside Task 3's nominal scope. **Note:** the implementer's first diagnosis (unseeded `Math.random()` row placement) was wrong — real cause was a genuine ~20% miss chance (`accuracyRating` 100 vs default enemy `evasionRate` 25 → 0.8 hit chance). Fixed by pinning `evasionRate: 0`, matching five existing `CombatSystem.*.test.ts` files.
4. **Ordered Task 3's test rewritten over the implementer's objection.** They argued the vacuous test was worth keeping; overruled because the requirement was otherwise unverified and Task 19 rewrites the same path. *Cost:* low.
5. **Deferred Tasks 5/7/9's manual browser-verification steps to Task 9.9's playtest**, since subagents can't drive a live Phaser canvas — but required Task 5 to *extract* its reconciliation logic into a pure, unit-tested module rather than accept "it's Phaser, untestable". *Cost:* purely visual defects survive until 9.9. **This ruling still binds Tasks 7 and 9.**
6. **Fixed Task 5's `isBoss: false` hardcode at the source** (extended `TurnBattleEntityVisualState` with `isBoss` + `name`) rather than documenting it as a limitation. It was load-bearing: Task 9.5 makes boss sprites 2× by reading `health?.isBoss` at sprite-creation time, and later-wave enemies are created *first* through Task 5's path — so the feature would have silently failed for exactly its target. *Cost:* touched Task 4's committed schema in a later task's fix round.
7. **Did not merge master mid-plan.** Master moved from `da0ac99` → `4531715` → `a06e402` (concurrent opencode session; per the user it fixed the two `deadReferences.test.ts` baseline timeouts). Integrate at finish time via `superpowers:finishing-a-development-branch`. *Cost:* one larger merge at the end instead of incremental.

## Baseline history

Base `da0ac99` had 3 failures unrelated to this plan: 2 `deadReferences.test.ts` timeouts (fixed by the concurrent session on master) and 1 `GameManager.actionPlayback.test.ts` assertion (fixed here — see ruling 3). **All three are resolved.**

## Deferred minors for the final whole-branch review

- `NEUTRAL_DIVIDER_COLUMN` (6) hardcoded rather than derived from `PLAYER_SIDE_REGION.columnMax + 1`; nothing enforces the invariant if a bound changes. Matches the plan's literal spec.
- `EnemySpawnPlacement.test.ts` lost the old "RNG độc lập" call-count assertion (the plan prescribed the replacement tests verbatim). Since `ENEMY_SIDE_REGION`'s row and column spans are both 6, a regression reusing one `random()` call for both axes would pass undetected.
- `GameManager.ts` has pre-existing mojibake (double/triple-encoded UTF-8) in unrelated comments (~2444-2447, ~3152-3161). Possible separate cleanup.
- No end-to-end test of the `alive: false` dead-entity path through `GameManager` (covered at unit level only).
- Stale comment in `Player.ts:429` references a non-existent `HERO_HOME_X`.

## Notes for the remaining tasks

- **Tasks 3 → 19 share `buildTurnBattle()`.** Task 19 replaces Task 3's `const formation = DEFAULT_PARTY_FORMATION` placeholder with `resolvePartyFormation(playerPath)`. Don't let two passes edit that function independently.
- **`PartyFormationSlot { combatantId: string; row: LaneIndex; column: number }`** — defined in Task 3, reused verbatim by Tasks 18/19. `combatantId` is `'player'` or a companion's `definitionId`, deliberately **not** a numeric index.
- **Task 5 owns its own known-id sets** (`knownTurnBattlePlayerIds`/`knownTurnBattleEnemyIds`) rather than scanning the shared `this.sprites` map, deliberately — `reconcileEnemySprites()`'s removal loop scans the whole map and would let one side destroy the other's sprites. **Task 9 must preserve this** when it swaps immediate removal for a death animation that defers removal until the animation completes.
- **Save versions are sequential:** Task 11 → v57 (`companions`), Task 17 → v58 (`formationLoadout`). Task 11 must land first.
- **Unverified fixture shape:** Tasks 10/12/14/19's test fixtures guess `TurnSkillDefinition` as `{ id, cooldownTurns, damage: { kind, multiplier }, targeting: { shape } }`. This was never checked against the real `game/src/core/battle/turn/TurnSkillAction.ts`. Whoever does Task 10 should read the real interface first and carry the true shape into 12/14/19.
- **The plan flags its own guesses** needing a fresh read: Task 9's `EntitySprite` shape (whether it wraps something `.play()`-able), Task 19's `this.turnBuffRegistry` field name. Treat the plan's code blocks as shape, not literal patches — `GameManager.ts` has drifted substantially from the plan's quoted snippets.
- **House comment style is enforced by review:** short English/technical lead-in, substantive explanation in Vietnamese. Two tasks were sent back over this.
