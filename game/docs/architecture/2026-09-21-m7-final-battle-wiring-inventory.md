# M7.0 — Final Battle Wiring: current-state inventory

Baseline: `4f00f642658a89d180dbc4be69bfb0486379e5d5` (master, post Skill-Definition findings closure).
Method: read-only code audit on this worktree; commit messages were NOT trusted — every claim below cites files/lines.
Date convention: `2026-09-21`.

## 1. Skill — one production ACTIVE pipeline

M1–M5 merged: `src/core/skilldef/` carries `SkillDefinition.ts`, `SkillDefinitionRegistry.ts`, `SkillResolver.ts`, `ResolvedSkillPlan.ts`, `SkillExecutor.ts`, `LegacySkillAdapter.ts`, `SkillCastCommitPort.ts`, `SkillProgressionState.ts`, `SkillCombatRuntimeState.ts`, `SkillExecutionHooks.ts`, `SkillQueryPorts.ts`, `CastSnapshot.ts`, `ScalarExpression.ts`, `AuthoredOperation.ts` + coverage/testkit tests.

**Production cast path (traced):**

1. `TurnBattleSystem.resolveActorTurn` → `declareActorAction` → `applyActionImpact` (`TurnBattleSystem.ts:3472-3479, 1919`).
2. `applyActionImpact` → `tryPlanCast` (`TurnBattleSystem.ts:697-712`) — non-charge casts; charge-init commits route at `2057-2073`; charge-resolve routes at `1952-1968`.
3. `planPipeline` getter (`574-592`) lazily builds `TurnSkillPlanRuntime` with `rng: this.rng`, `runtime.buffs`, `runtime.scheduler`, registry lookups, `skillPlanOrchestration()` hooks.
4. `TurnSkillPlanRuntime.routeCast` (`TurnSkillPlanRuntime.ts:194-290`): `catalogFor` → `adaptTurnSkillDefinition` (`LegacySkillAdapter.ts`) → `SkillDefinitionRegistry` rebuild (`420-449`) → `resolver.resolve(input)` → `executor.execute(plan, input)`; executor built per cast via `buildExecutor` (389-410) with `SkillCastCommitPort` → `commitShell`.
5. `SkillExecutor` emits `ResolvedCombatOperation`s through `CombatScheduler.enqueueAuthored` + `run()`.
6. `CombatOperationExecutor` dispatches to `CombatAuthorityPorts` adapters (`GameManagerTurnBattleOps.ts:1081-1116`).
7. Authorities: `CombatSystemDamageAdapter`→`combat.resolveActionHit`/`applyDirectDamage`; `CombatSystemHealAdapter`→`applyHealing`; `ActionGaugeAdapter`→`pushGauge`; `EntityResourceAdapter`→`consumeResourceFor`/vitals ward/`currentThe`; `VitalsShieldAdapter`→`vitals.grantWard`; `buffs` port→`BuffSystem`.
8. Consequence replay via `SkillExecutionHooks` (`TurnSkillPlanRuntime.buildHooks`) → orchestration callbacks: `grantHitOutcomeIncome`, `grantBasicLandedIncome`, `runLandedHitProcs`, `resolveTakenWindow`, `resolveEvadeWindow`, `grantExternalWard`, `refreshStats`, `sweepBuffDeaths` (`TurnBattleSystem.ts:594-688`).

**Unsupported casts:** `routeCast` returns `null` when `catalog.unsupported.length > 0` (`TurnSkillPlanRuntime.ts:210-211`); `applyActionImpact` calls `reportUnroutedCast(..., declined=true)` (`TurnBattleSystem.ts:2119-2123`) — loud once-per-cast report, cast resolves no-op. Insufficient-resource casts still route and settle `blocked` (R-S9 precheck). No production fallback to legacy.

**Engine-unit lane:** `runtime === undefined` is the only remaining legacy path — `tryPlanCast` returns null at `704`, `engineUnitLane` branches at `2120, 2144, 2177, 2217, 2250` run `resolveDeclaredHit`/`commitCast`/`applyDeclaredBuff`. Reachable only when `TurnBattleSystem` is constructed without a `TurnCombatRuntime`: the bootstrap engine at `GameManagerTurnBattleOps.ts:296-311` (replaced by the cycle engine at `1533` before any combat step) and engine-unit tests. Documented test-only configuration.

**Repeat/multicast:** TBS-driven `battle.queuedExecutions` lane — `declareQueuedExecution` (2744) re-declares; each execution routes through `applyActionImpact` → `tryPlanCast` with `commitsCast=false` (`executionCommitsCast` distinguishes follow-ups). Multicast roll at `2888` uses `this.rng.rollChance`. Dynamic extras (`dynamicBasic.onCastResolved`) route via `applyExtraImpact` → `routeExtraCast` (2674-2690), verbatim non-committing plans.

## 2. Buff — single authority

- `BuffSystem` (buff2) constructed per battle in `mintCycleScheduler` (`GameManagerTurnBattleOps.ts:1054-1079`) with battle-scoped `BuffStore` (deterministic `buff.battle.<gen>.<n>` ids), battle-local `BuffRegistry` (`1030-1043`, `LIVE_BUFFS` + kit-clone defs, sealed), `ApplicationResolver(this.combatRng)`, stats/alive/snapshot queries, `ElementalStateRegistry` (`1046-1052`, five canonical an ids).
- No `src/core/buff/` directory; `BuffPool` appears only in comments (e.g. `GameManagerTurnBattleOps.ts:1587`, `BuffStore.ts:1`).
- `BuffPersistence.ts` = `GameManager.buffPool` — the out-of-battle persistent lane (own `BuffSystem` instance, `persistent.*` op ids, `++this.seq` synthetic sequence at `115,142,153`). Not battle-reachable; see finding F-C.
- Buff lifecycle runs as scheduler root transactions: `TurnBattleSystem.lifecycleRoot`/`createLifecycleSink` (`789-792`), `runBuffLifecycle` (798-806), `sweepBuffDeaths`→`BuffSystem.onEntityDeath` (814-821) at every quiescent point.

## 3. Reaction — core exists, production inert

- `src/core/reaction/` carries `ReactionSystem`, `ReactionDispatcher`, `ReactionTriggerGate`, `ReactionBoard`, `ReactionResolution`, `ReactionBatchRunner`, `ElementalStateRegistry`, `ReactionRegistry`, `ReactionTrace` + fixtures/tests.
- `TurnReactionManager`, `canInitiateWuxingReactions`, `SkillToTurnSkillConverter`: zero production hits — docs/comments/test names only (verified by sweep; `elements-reactions.md` still describes the retired manager — stale-doc note for M7.5).
- `BuffSystem` emits `elemental_application_committed` (`BuffSystem.ts:309`) — no production handler: `mintCycleScheduler` registers only `periodic_operation_settled` and `buff_applied` immediate handlers (`1144-1152`). `ReactionDispatcher`/`ReactionSystem`/`StaticCapabilityQuery` have no production construction.
- `elemental_reaction_enabled` (`contracts/capability.ts:11`, `reaction/ReactionTypes.ts:64`): no production grant site; granted only in tests/fixtures.

## 4. Scheduler — production composition root

`GameManagerTurnBattleOps.mintCycleScheduler` (called at `1532` before each `TurnBattleSystem` mint) constructs: `BuffRegistry` → `BuffSystem` → `CombatOperationExecutor` (ports: damage/heal/gauge/resource/shield/buffs) → `CombatScheduler` (preconditions: isAlive/getBuffInstance) → `CombatProcSystem` (rng + scheduler) → immediate handlers → `TurnCombatRuntime {buffs, procs, scheduler, gaugeHandler}`.

- `CombatScheduler` = sole `combatSequence` allocator: `nextSequence`/`allocateSeq` (`CombatScheduler.ts:126,421,767`); trace records executions/faults/batchSkips/skippedResults (`432,584,590,637`).
- `CombatAuthorityPorts` (`runtime/scheduler/CombatAuthorityPorts.ts`): optional-per-domain; unwired op → `CombatSettlementFault`, never silent.
- `CombatTrace` lives inside the scheduler (`scheduler.trace`, `348`); `CombatTraceExporter` = dev-only export facade — **zero production callers**, exercised only by its test. Acceptable as a dev surface; M7.4 verifies exposure.

## 5. Authority matrix (battle-reachable mutations)

| Mutation | Canonical owner | Production caller | Op/path | Legal exceptions |
|---|---|---|---|---|
| HP damage | `EntityVitalsSystem` via `CombatSystem` (`resolveActionHit`, `applyDirectDamage`) | `CombatSystemDamageAdapter` | `deal_damage` ops via scheduler | engine-unit `resolveDeclaredHit` direct call (test-only); `TribulationDirector` ghost restore (own domain) |
| Healing | `CombatSystem.applyHealing` | `CombatSystemHealAdapter` | `heal` ops | engine-unit leech (`TurnBattleSystem.ts:2369`) |
| Native ward | `EntityVitalsSystem.spendWard/grantWard` | `VitalsShieldAdapter`, `EntityResourceAdapter` ('ward' resource) | `grant_ward`, `consume_resource`/`gain_resource` | engine-unit `consumeWardForDamage` (`2433`) |
| externalWard | contract: TBS grant writes (source-tagged REPLACE), `CombatSystem` absorb-decrement (`425-430`), `reconcileExternalWard` expiry at refresh seam (`959`) | `grantExternalWard` hook (`679`), `applyDeclaredBuff` (`2602`), `resolveInterceptWindow` (`3258`) | `apply_buff.externalWardGrant` metadata (plan lane); direct writes adjacent to emitted ops | finding F-B |
| Buff apply/remove/stacks/duration | `BuffSystem` | `buffs` port | `apply_buff`/`add_buff_stacks`/`remove_buff_stacks`/`consume_buff_stacks`/`cleanse` ops; lifecycle via `createLifecycleSink` | entry applies `applyBuildBuffs` (composition root); `BuffPersistence` out-of-battle lane |
| Resource spend/gain (mana/the) | `EntityResourceAdapter` bindings: `consumeResourceFor` (mana), vitals (ward), direct `currentThe` | `resource` port | `consume_resource`/`gain_resource` ops | engine-unit `commitCast`/`grantTheFromCast`/`consumesAllThe` writes (`2927-2951`); `TheEconomy`/`Player.ts` init/economy lanes |
| Gauge | `ActionGauge` module + `GaugeDeltaHandler` staging | `ActionGaugeAdapter` | `push_gauge` ops | TBS turn-loop `advanceGauge` (`1256`), wave-reset `actionGauge = 0` (`1215`), `TurnOrderPreview` clone |
| Cooldown/charge | TBS cast-commit (`commitShell`/`commitCast`) + `tickCooldowns` | `commitShell` via `SkillCastCommitPort`; `tickCooldowns` at `1697` | slot writes inside commit port | slot state is participant/TBS-owned by contract |
| Reaction payoff | `ReactionSystem` (fixture only) | — | `consume_buff_stacks`/`apply_buff` payoff ops via `ReactionBatchRunner`→scheduler | production inert (no dispatcher) |
| Death lifecycle | `CombatSystem.killIfDead` (`alive=false` at `704`); `BuffSystem.onEntityDeath` | damage/heal adapter settle → `sweepBuffDeaths` | inside authority settle + quiescent sweep | `participant.alive` projection sync (`1245,1309`); `GameManagerAutoFarmOps:343` (out-of-battle resolution) |
| Stat refresh | `recomputeEffectiveStats` | `refreshParticipantStats`/`refreshEffectiveStats` | reads `BuffSystem.getStatModifiers` + `liveStatModifiers`, writes `entity.stats`/`entity.maxHp`/`participant.speed` | — |
| Proc/on-hit grants | `CombatProcSystem` | TBS hooks (`runLandedHitProcs`, `resolveReactiveProcs`, ally window) | emits ops via `scheduler.enqueueAuthored`+`run()` (never direct state) | — |

## 6. Composition map

| Component | Constructed at | Lifetime | Prod/test | Injected deps |
|---|---|---|---|---|
| `TurnBattleSystem` | `GameManagerTurnBattleOps:1533` (cycle engine); `:296` (bootstrap, `runtime=undefined`) | per battle cycle / bootstrap | prod (+ engine-unit tests) | `combatSystem`, maxTurns, `battleBuffRegistry`, stageSpawnFactory?, `TurnCombatRuntime`, `onSkillCast`, `liveStatModifiers`, `combatRng` |
| `TurnSkillPlanRuntime` | `TBS.planPipeline` lazy getter (`576-592`) | per TBS | prod | `rng`(=`this.rng`), `buffs`, `scheduler`, `isBuffDefinitionId`, `buffDefinition`, `orchestration` |
| `SkillResolver` | `TurnSkillPlanRuntime:188` + rebuilt per catalog (`432`) | per registry rebuild | prod | registry, `CombatRng` |
| `SkillExecutor` | `TurnSkillPlanRuntime.buildExecutor` per cast (`401-409`) | per cast | prod | scheduler, resolver, registry, `SkillQueryPorts`, `SkillCastCommitPort`, `CombatRng`, `SkillExecutionHooks` |
| `CombatScheduler` | `mintCycleScheduler:1118` | per battle cycle | prod | `CombatOperationExecutor`, preconditions |
| `CombatOperationExecutor` | `mintCycleScheduler:1081` | per battle cycle | prod | `CombatAuthorityPorts` (damage/heal/gauge/resource/shield/buffs) |
| `DamageAuthority` | `CombatSystemDamageAdapter:1082` | per battle cycle | prod | `combatSystem`, `resolveEntity`, `resolveSourceGrants`, `rng`=`combatRng` (required, no fallback) |
| `BuffSystem` | `mintCycleScheduler:1054`; `BuffPersistence:81` (persistent lane) | per battle / app | prod | `BuffStore`, `BuffRegistry`, `ApplicationResolver(rng)`, stat/alive/snapshot queries, `ElementalStateRegistry` |
| `GaugeAuthority` | `ActionGaugeAdapter:1091`; `GaugeDeltaHandler:1134` | per battle cycle | prod | `resolveParticipant`/`resolveEntity`; `BuffRegistry` |
| `ResourceAuthority` | `EntityResourceAdapter:1092` | per battle cycle | prod | `resolveEntity`, mana/ward bindings |
| `CombatTrace` | inside `CombatScheduler` | per battle cycle | prod | — |
| `CombatTraceExporter` | facade over a trace | per export | **test/dev only — no prod caller** | `CombatTrace` |
| `ActionValidator` | `Buff2ActionValidator` at `TBS:494-503` | per TBS | prod | `buffs.getForTarget` feed |
| `ReactionSystem`/`ReactionDispatcher` | `reaction/testing/ReactionTestFixtures` only | per fixture | **test-only — production inert** | registry/board/gate/scheduler |
| `combatRng` | `GameManagerTurnBattleOps:936` (`FunctionCombatRng(Math.random)` unseeded default) → seeded at `1243` via `createBattleRng` | per battle cycle | prod | `deps.createBattleRng` seed |
| `CombatProcSystem` | `mintCycleScheduler:1135` | per battle cycle | prod | `buffs`, `combatRng`, `scheduler`, `resolveEntity` |

## 7. Findings carried into M7.1 (candidates, severity TBD)

- **F-A — hidden rng default on canonical path.** `TurnBattleSystem` constructor param `private readonly rng: CombatRng = new FunctionCombatRng(() => Math.random())` (`486`) — the same `Math.random` fallback class just removed from `CombatSystemDamageAdapter`. Production always injects `combatRng` (`1541`), but the fallback sits on the canonical battle path (engine-unit tests rely on it).
- **F-B — externalWard writer contract.** Three grant write sites (`679` plan-hook, `2602` applyDeclaredBuff, `3258` intercept) + absorb decrement (`CombatSystem:425-430`) + reconcile clear. One documented contract (source-tagged REPLACE, existence-bound marker), but two sites write directly instead of riding the `apply_buff.externalWardGrant` op-metadata consequence — close or explicitly justify.
- **F-C — second `combatSequence` allocator.** `BuffPersistence` mints `++this.seq` into `CombatAuthorityExecutionContext.combatSequence` (`115,142,153`) — out-of-battle lane; needs explicit exception classification (never mixes with a battle's sequence space) or a renamed/non-sequence ctx value.
- **F-D — dead helpers on both lanes.** `applySkillAilments` (`3537`) and `applyDetonate` (`3600`) guard on `runtime === undefined` but every caller is inside an `engineUnitLane` branch → unreachable in both configurations. `resolveDeclaredHit`'s `this.runtime !== undefined` block (`2437-2484`: procs/ailments/detonate) likewise unreachable. Legacy-lane residue for the deletion sweep.
- **F-E — applyDeclaredBuff engine-unit fault.** No runtime guard; engine-unit callers (`2275`, `2716`) reaching it with a valid def would throw via the `scheduler` getter. Live production caller is only the provider `resolveBuff` callback (`2297`). Latent engine-unit defect, loud not silent.
- **F-F — engine-unit consume crash.** `resolveDeclaredHit`'s consume-for-damage block (`2387-2435`) is NOT runtime-gated and reads `this.buffs` → an engine-unit cast with `consumesAilmentId`/`consumesWardForDamage` faults. Latent test-config defect; records as a known boundary.

No second gameplay authority found for any battle-reachable mutation beyond the F-B grant-site spread (same owner, three seams). No production scheduler bypass found: every op-emitting seam funnels `emitAndSettle`/`enqueueAuthored`+`run()`; lifecycle goes through `createLifecycleSink`.
