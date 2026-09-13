# Adversarial QA — M7 ARCH-002 stat refresh (quick mode)

Scope: `arch/m7-stat-refresh` worktree diff vs fork `81c30e04`.
Task-owned paths reviewed: the 12 production files in the diff
(`TurnBattleSystem.ts`, `TurnStatsRecompute.ts`, `GameManager.ts`,
`GameManagerTurnBattleOps.ts`, `GameManagerPersistentEffectOps.ts`,
`StageWaveSystem.ts`, `Player.ts`, `stores/player.ts`, `App.vue`,
`useBattleActions.ts`, `enemySpawnDebug.ts`, `__fixtures__/startAStage.ts`)
plus the migrated test callers. Excluded from review inputs: none — every
dirty path is task-owned.

## Risk map

`changed-risk-map.mjs` returned `deepAuditCandidate: true` ("critical state
boundary: time-and-offline", "cross-system change: 5 domains") and 7
`unmappedPaths`. Bounded by inspection rather than escalating:

- The time-and-offline hit is host-file adjacency (`App.vue` owns the tick);
  the actual edit appends `getActiveRuntimeModifiers` to an existing
  modifier write. No clock, offline accrual, save schema, or timestamp
  ownership changed.
- `pinia-phaser-sync`/`ui-input-lifecycle` hits: the App.vue change is a
  data argument to the existing `setExternalModifiers` call — no Vue/Phaser
  lifecycle or rendering contract moved.
- Unmapped paths route manually: `GameManagerTurnBattleOps`,
  `StageWaveSystem`, `GameManagerPersistentEffectOps`, `Player.ts` ->
  combat-and-tribulation + stats ownership; `useBattleActions` ->
  combat entry command path; `enemySpawnDebug` -> dev-only debug channel;
  `__fixtures__/startAStage.ts` -> test fixture.

## Hypotheses and evidence

1. **Double-apply via persistent pool in `participant.buffs`** — DISPROVEN.
   `toTurnBattleParticipant` (`TurnBattleAdapter.ts:49`) builds a fresh
   `new BuffPool()`; nothing seeds the persistent `deps.buffSystem` entries
   into participant pools, so `getLiveBattleModifiers()` is the sole
   channel for persistent-buff modifiers — applied exactly once.
2. **Static/live partition overlap** — DISPROVEN. `getBattleBaseModifiers`
   = technique tier + cultivation path + node levels + technique combat
   mods; `getLiveBattleModifiers` = persistent pool + scaled passives +
   timed/socket runtime. Disjoint sources; union equals the menu mirror
   (`getAggregatedModifiers` + `getActiveRuntimeModifiers` in App.vue).
3. **Missing live provider at some TurnBattleSystem construction** —
   DISPROVEN. All three `new TurnBattleSystem(...)` sites
   (`GameManagerTurnBattleOps.ts:247`, `:1080`, `:1167`) pass
   `this.liveStatModifiers`; the non-stage one also gained `BUFF_REGISTRY`
   (was `undefined` — silently disabled skill `appliesBuff` branches).
4. **Query purity regression in `peekNextActor`** — bounded.
   `refreshEffectiveStats` writes `entity.stats`/`participant.speed` —
   derived views only; the recompute is idempotent and the peek already
   wrote the speed cache before. No authoritative state mutates in a read.
5. **Post-seed stale window** — verified fixed:
   `startBattleWithPlayer` refreshes effective stats after
   `seedPassiveCarry`, so carried stacks are live during intro/countdown.
   `tickPacing` refreshes before the empty-field early return, covering
   spawn/telegraph windows.
6. **CC/charge freeze** — verified fixed: `declareActorAction` refreshes
   the actor before the alive/CC/charge gate; `applyActionImpact`
   refreshes after every pool mutation (hits, ailments, appliesBuff
   self/target, reactive triggers).

## Observed suite noise (classified under P12)

- `GameManager.perfectClear.feasibility.test.ts` multi-hit floors
  (1/5/9/10, marginal): **pre-existing**. Reproduced at fork commit
  `81c30e04` with all M7 changes stashed — all 4 multi-hit floors failed
  there identically (`git stash` baseline check). Round counts flap ±2
  between runs (crit/dodge RNG under parallel workers); the limits are
  simply not reachable for the 3-hit-kill scenario. Not task-caused;
  rebalancing the lock is out of M7 scope.
- `ChiHienQuan.integration.test.ts` duplicate-pull pity counter:
  **parallel-suite flake** — passes in isolated rerun; gacha pity has no
  dependency on the stat path. Not task-caused.

## Verdict

**PASS WITH EVIDENCE.** The invariant set is covered by
`GameManager.statRefresh.test.ts` (9 — +2 review-R1 regressions: live
maxHp moves the real heal ceiling; tribulation ghost snapshot cannot
leak passive stacks), `GameManager.phaGiapCarry.test.ts` (4), and
migrated entry-path tests; the two remaining full-suite failures are
pre-existing/flaky and documented above. No new Confirmed defects.
P14 live-browser check deferred per the isolated-worktree exception —
no rendering, animation, or layout behavior changed (stat numbers only);
recommend the deferred check run from the main checkout at branch finish.

## Review round 1 addendum

- `refreshParticipantStats` now reconciles `entity.maxHp` from
  `stats.maxHp` through `vitals.clampToMaxHp(entity, 'stat_refresh')`
  (new vitals reason; event fires only when the ceiling changed).
- `startTribulation` resets passive stacks before the ghost snapshot.
- Actor refresh symmetry in `TurnBattleSystem`: source actor refreshed
  after reaction-granted buffs in the reaction path and non-damaging
  branch; post-`removeAllById` refresh moved outside the registry gate.
- 9 stale-fixture files updated so declared vitals ceilings live in
  `stats`/`baseStats` (reconciliation now enforces them).
- BUFF_REGISTRY-in-direct-battles behavior change + retained debts
  recorded in the G5 report's "Review round 1" section.
- Focused re-verify: `npx vitest run src/core/battle src/core/game
  src/core/player src/stores` → 1029 passed / 4 failed, all 4 the
  pre-existing perfectClear multi-hit floors.
