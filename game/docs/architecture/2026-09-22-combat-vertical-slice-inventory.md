# Combat Vertical-Slice Inventory (P3-M0)

Baseline: branch `p1-canonical-path-authority`, post-P1+P2. Date: 2026-09-22.

Maintained map for the P3 mission (`docs/superpowers/plans/2026-09-22-production-combat-vertical-slice.md`).
The maintained channel map for the build itself lives in
`2026-09-21-build-composition-inventory.md`; this doc owns the LOOP
(lifecycle, teardown, evidence) dimension.

## Spec flow — the 14 steps

`docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P3:

Select Build → Enter Stage → Battle Initialization → Spawn →
Skills/Actions → Damage/Vitals → Buff/Debuff → Seal → Reaction →
Companion → Death → Victory/Defeat → Reward Settlement → Replay/Return

| # | Step | Owner (current) | Canonical? | Per-battle state created (leak surface) | Evidence |
|---|---|---|---|---|---|
| 1 | Select Build | `CultivationPathSystem.applyPathChoice` (ritual, atomic pair) | canonical (P1) | none (pre-battle) | `cultivation-path-ritual.spec.ts` 7/7 |
| 2 | Enter Stage | `StageWaveSystem` lease -> `startStage` -> `beginBattleCycleCommitted` | canonical | stage lease, `activeStageForTurnBattle`, `playerDataForTurnBattle`, `turnBattleStartedAtMs` | `stageLease.test.ts` (14) |
| 3 | Battle Initialization | `resolveCombatBuild` -> `buildTurnBattle` -> `mintCycleScheduler` -> `new TurnBattleSystem` | canonical (P2) | `activeBuild`, `battleBuffRegistry`, `turnRuntime`, `combatScheduler`, elemental registries, `battleGeneration++` | `CombatBuild.test.ts` (25) |
| 4 | Spawn | enemy/wave assembly in ops (`stageWaves.pickEnemyForTurnSpawn`, `enemyManager`) | retained ops seam | spawned `CombatEntity`s + presentation sprites | `battleCycle`/`bossRepeatCycle` despawn asserts |
| 5 | Skills/Actions | `TurnBattleSystem` + `combatScheduler` authored-op lane | canonical | scheduler queue, pending steps, `turnToken` | `TurnBattleSystem.*` suites |
| 6 | Damage/Vitals | `CombatSystem` (vitals) via scheduler adapters | canonical | vitals events, ward pool | damage/vitals suites |
| 7 | Buff/Debuff | `battleBuffRegistry` + `buffs` runtime (per-cycle mint) | canonical | buff instances on entities | buff suites |
| 8 | Seal | canonical elemental seals via `apply_buff` ops -> `ElementalStateRegistry` boards | canonical | seal buff instances + board state | `ngoDaoReaction` |
| 9 | Reaction | `ReactionSystem`/`ReactionDispatcher` + journal drain (`reactionEventCursor`, `reactionVfxBattle`) | canonical | journal cursor per battle | `ngoDaoReaction`/`reactionReproof` |
| 10 | Companion | `build.companions` (fresh entities, formation coords, kit clones) | canonical (P2) | companion entities/buffs per cycle | `CombatBuild` tests |
| 11 | Death | survive-lethal session + engine death handling | canonical | `combatSystem.setSurviveLethalSession`, `surviveLethalGuard` | `battleCycle` suites |
| 12 | Victory/Defeat | `settleCombatOutcome` -> terminal + `combatClock.stop()` + battle_end | canonical | terminal `turnBattle` retained BY DESIGN for result reads (`isTurnBattleInProgress` is the gate) | `battleCycle`/`stageLease` |
| 13 | Reward Settlement | `rewardOps.grantBattleRewardIfNeeded` + perfect-clear + loot receiver | canonical | once-guards reset per cycle (policy section 2) | reward suites |
| 14 | Replay/Return | `restartTurnBattleCycle` / defeat-panel refight; exit-confirm -> `abandonBattle` | canonical | full teardown path | `repeatStage`/`stageRestart`/`bossRepeatCycle`, `CombatExitConfirmModal` tests |

## Terminal-path enumeration (M1 audit matrix)

Every path that ends or replaces a battle — and the teardown it must run:

| Path | Entry | Teardown contract | Proof |
|---|---|---|---|
| Victory terminal | engine `state='victory'` -> `settleCombatOutcome` | clock stop; battle retained for result; rewards once | battleCycle |
| Natural defeat | engine `state='defeat'` -> `settleCombatOutcome` | same terminal semantics; distinct entry path from abandon | battleCycle |
| Abandon | `abandonBattle()` -> forced `state='defeat'` | session end, stage lease release, enemy clear, survive session off, clock stop, entry-state clear | stageLease |
| Auto-repeat | victory + `turnBattleRepeatContinuously` -> `restartTurnBattleCycle` | previous terminal; fresh cycle mint in place | repeatStage/bossRepeatCycle |
| Live replacement | `beginBattleCycle` over a live battle | outgoing published `defeat` pre-commit; then normal entry | stageLease |
| Failed cycle | throw post-commit -> `discardFailedCycle` | drop half-built battle (no phantom battle_end), session end, lease release, enemy clear, survive off, entry-state clear, clock stop | stageLease (14/14) |
| Stage restart | `restartTurnBattleCycle` mid-policy | same as repeat | stageRestart |

## Per-cycle mint map (what MUST be fresh each cycle)

`mintCycleScheduler` (ops:1072) mints per cycle: `battleBuffRegistry`
(sealed after kit-clone registration), elemental state registry,
`combatScheduler`, `turnRuntime` (buffs/procs/scheduler/gaugeHandler),
reaction dispatcher subscription (bound to the per-cycle buffs emitter —
dies with it). `turnBattleSystem` is re-minted per cycle at ops:1690.
`battleGeneration` bumps per cycle (:1584).

Retained-across-battles BY DESIGN: the terminal `turnBattle` (result
reads), `pathRuntimeOverride` (devtools seam), long-lived services
(`presentationOps`, `enemyManager`, `rewardOps` — their per-cycle state
is reset, the services are not).

Reset per cycle via `clearCycleEntryState` / `discardFailedCycle`:
pending steps, pipeline, `turnToken`, `presentationOps.runtime`,
`boundaryQueue`, `activeBuild`; plus on discard/terminal: session end,
`stageWaves.stopRepeat`, `enemyManager.clear`, `setSurviveLethalSession(null)`,
`combatClock.stop`, `activeStageForTurnBattle`, `turnBattleRepeatContinuously`,
`playerDataForTurnBattle`, `turnBattleStartedAtMs`, `statusVfxSnapshot`,
`reactionEventCursor`, `reactionVfxBattle`.

## Gap report (M0 Step 3)

Coverage gaps (feed M1/M3, not defects):

- **G1 — no cross-cycle instance-freshness assertion.** Suites prove
  behavioral teardown per path; none asserts the SECOND cycle's
  registries are different instances / free of battle-1 transients.
  M1 Step 1 adds the matrix.
- **G2 — listener accumulation unproven.** Per-cycle subscriptions die
  with the minted runtime; no test asserts no accumulation on
  longer-lived surfaces across N battles. M1 Step 2 adds the audit.
- **G3 — no deterministic production seal->reaction run.** Engine tests
  inject seals via `applyBuffToPlayer`/`applyBuildBuffs` (real op lane)
  but no test drives a REAL stage encounter to a reaction. M3 Step 2
  adds the seeded run.
- **G4 — no E2E full-loop spec.** Existing specs cover create->combat->
  result and HUD; none drives ritual->stage->victory->reward->refight->
  exit->return as one scenario. M3 Step 1/3 add it.

Confirmed defects at census time: **none**. Suspected/none.

One defect surfaced later via the M3 E2E reproduction (Playwright
hit-test log — canvas intercepting clicks on `.combat-exit-confirm`):
`CombatExitConfirmModal`'s overlay sat inside `pointer-events:none`
`.combat-scene-overlay` without re-enabling, so its buttons were dead in
production. jsdom unit tests can't hit-test, so it shipped unnoticed.
Repaired with `pointer-events:auto` (same pattern as
`CombatResultModal`).

## Audit outcome (M1/M3, 2026-09-22)

All four coverage gaps are now closed by tests; the audit confirmed zero
leaks — M2 (conditional repairs) is vacuous.

- **G1 closed** — `GameManager.battleTeardown.test.ts` (10 tests): victory /
  natural-defeat / abandon / live-replacement / repeat-restart /
  failed-cycle matrix, each asserting the next cycle mints a fresh
  TurnBattleSystem + combatScheduler (op queue + reaction journal live on
  it), clock counters restart at zero on synchronous mints, transient
  battle-1 seal sentinels never reach battle-2 targets, and the entry
  aura re-grants as a NEW instanceId (embeds the per-cycle battleId).
  Survive-lethal coverage: a real lethal consumes the `bat_tu_the`
  charge (1 -> 0 -> defeat), the next cycle re-derives 1, and a talent
  swap before battle 3 mints 0 — proving activeBuild re-resolution and
  no survive-session bleed; the failed-cycle path leaves the guard
  untouched.
- **G2 closed** — same file: `battle_end` emits exactly once per ended
  battle across N cycles; a stale battle-1 runtime emits nothing after
  teardown; and the cycle-scoped double-fire oracle proves fresh
  journal/boards/dispatcher — battle-2's manual doc_can+tran_an pair
  emits exactly one `reaction_resolved` (bus + cycle-2 trace), never a
  re-emission or double-fire of battle-1's.
- **G3 closed** — `GameManager.verticalSlice.test.ts` (2 tests): real
  `mortal_dong_1` stage under `SeededCombatRng(20260922)` with the real
  ngo_dao ritual build -> victory at combat step 279; all five canonical
  seals observed on enemies; 9 `reaction_resolved` events across 5
  distinct ids (`xuyen_tho` x3, `tuc_viem` x2, `nhuan_moc`, `duong_viem`,
  `tu_thuy`) — distinct-id set pinned; `completedStageIds` settlement
  asserted; seed 777 replayed to identical terminal state.
- **G4 closed** — `tests/e2e/combat-vertical-slice.spec.ts` (2 tests):
  ritual -> stage -> aura -> victory -> `completedStageIds` -> refight
  (fresh TurnBattle instance vs the exact winning terminal object,
  counters + roundsElapsed reset, aura re-granted) -> exit-confirm ->
  abandon -> home; plus the abandon loop: exit-confirm -> abandon ->
  straight home under the curtain (the defeat panel is the
  natural-defeat surface, not the abandon surface) -> re-enter ->
  natural terminal -> result panel -> return.
