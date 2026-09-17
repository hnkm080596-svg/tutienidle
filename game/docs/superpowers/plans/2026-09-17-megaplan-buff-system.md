# Buff System Reimagined — Implementation Megaplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

**Goal:** Rebuild the canonical buff authority as `core/buff2/` — a single battle-scoped `BuffInstance` store with real `instanceId`s, dynamic per-resolution `BuffPeriodic` math (replaces apply-time DoT snapshot), a `BuffModifier` layer (replaces `scaleBuffPotency` mutation), explicit lifecycle entry points (replace the catch-all `update()`), periodic requests (replace direct `applyDotDamage` calls), domain-event emission (`ElementalApplicationCommitted` among them), and `forbiddenActionTags`/`capabilities`/`element` first-class fields — then cut over EVERY consumer and delete the old pool-authority model.

**Architecture:** New package `game/src/core/buff2/` implementing the spec's two-layer model: `BuffDefinition` (immutable authored, effects contain NO magnitudes) + `BuffInstance` (mutable runtime, owns `instanceId`/`stacks`/`remaining`/`modifier` list). `BuffSystem` is the ONLY mutation authority; reads go through narrow query methods returning immutable `BuffInstanceSnapshot`s. Periodic execution emits `BuffPeriodicDamageRequest`/`BuffPeriodicHealRequest` — the scheduler's `DamageAuthority`/`HealAuthority` ports resolve them (no direct CombatSystem import inside buff2). Application authority (`ApplicationResolver`) owns the ailment roll: `baseChance + bonuses − resist`, `CombatRng`, stack cap, `addedStacks` derivation, reapply policy — Skill/Reaction never roll.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.0 — THE source of truth)
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.1 — `ApplyBuffRequest`/`ApplyBuffResult`, removal reasons, event payloads, §40–51 batch semantics)
- `game/docs/specs/2026-09-17-reaction-system-reimagined-spec.md` (consumed surface: `BuffInstanceSnapshot.instanceId`, `ConsumeStacksResult`, modifier `reapply:'max'`/`buff_lifetime`)
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (`TriggerBuffPeriodic`, `read_stacks` consumers)

**Sibling-plan dependency:** Expansion of the buff scope in `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M3–M4). **Hard prerequisite:** the contract megaplan's M1–M2 must have landed (`game/src/core/battle/contracts/**`, `core/battle/runtime/scheduler/**`). M0 verifies; if absent → BLOCKED — do not re-declare `ApplyBuffRequest`/`ApplyBuffResult`/`ConsumeStacksResult`/`CombatRng`/events locally (contract plan §Canonical-names owns them; buff2 fills the *implementations*).

## Global Constraints

- **One canonical authority.** This replaces `BuffSystem`+`BuffPool` in `core/buff/` — the codebase already retired `TurnBuffSystem`/`TurnBuffPool` impls (only their *test files* remain, importing `core/buff` — verify + rename in M5). No third store.
- **Per-entity pools → single battle store.** Today every `TurnBattleParticipant.buffs` is a private `BuffPool`; new `BuffSystem` owns ALL instances battle-wide keyed by `instanceId` (`buff.${battleSeq}.${n}`), queryable by holder/source/target. This is the deepest cut — M0's consumer census drives the adapter map.
- **Effects carry no magnitudes (spec §10,§22):** `dot` effect becomes `periodic` recipe (`baseCoefficient`, `dpsRatio`, `element`, `powerDomain`); the magnitude resolves AT EACH TICK from live source stats + modifiers — replaces `damagePerTurn`/`damagePerSecond` snapshot AND `calculateDamagePerTurn` (`BuffSystem.ts:196–220`).
- **No cross-authority mutation:** periodic damage routes as requests; reflect/reactive execution stays outside buff2 (buff2 resolves requests, scheduler executes); stat projection emits `StatModifier`s (same shape as `getActiveModifiers` today).
- **No RNG in buff2 except the application roll** — one `CombatRng` consumed by `ApplicationResolver`; periodic/procs keep their existing roll sites but receive rng via parameter (today: `rollOnHitEffects`/`rollReactiveTrigger` take `rng` params already — preserve).
- **Legacy observable behavior preserved unless spec changes it:** CC semantics, `uniquePerTarget`, `clearsCcOnApply`, `convertsToId`, `durationPolicy` incl. `fixed_holder_turns`, ailment-resist duration scaling, reflect/ward/proc windows. Full regressions are the existing `BuffSystem*.test.ts` corpus ported to buff2.
- **No ấn authoring** — fixture ids `test_*` for reaction-facing definitions; the real five are seal-batch scope.
- **P3:** quick per mission; **full mandatory for M4/M5** (cuts live `TurnBattleSystem` paths). **P4** quick per mission, deep at M4/M5. **P5** round per mission. **P7** commits need explicit authorization. **P13/P14** Playwright real battle at M4/M5.
- **Per-mission report:** changed / files / authority moved / adapters remaining / tests / build status / behavior changes / risks / next.

## Canonical names (locked across sibling plans)

**Consumes (contract plan owns):** `CombatRng`, `CombatOperationOrigin`, `CombatOperation` (ops targeting this system: `ApplyBuffOperation`, `AddBuffStacksOperation`, `RemoveBuffStacksOperation`, `ConsumeBuffStacksOperation`, `AddBuffModifierOperation`, `RemoveBuffModifierOperation`, `RefreshBuffDurationOperation`, `ExtendBuffDurationOperation`, `TriggerBuffPeriodicOperation`, `RemoveBuffOperation`), `ApplyBuffRequest`, `ApplyBuffResult`, `ConsumeStacksResult`, `BuffInstanceSelector` (discriminated union — contract v2), `BuffRemovalReason`, `ElementalApplicationCommitted`, `BuffApplicationFailedEvent`, `PendingCombatEvent` + `CombatEventSink`, `PeriodicResolution`/`BuffPeriodicDamageRequest`/`BuffPeriodicHealRequest` (contract `periodic.ts` — request types cross the authority boundary so they live in contracts, not buff2), `CombatAuthorityExecutionContext` (contract v4 — carries `{operationId, origin, events}`; BuffAuthority methods take it per-call — the ctor-injected emit was REMOVED because authorities mint `eventId`s from `ctx.operationId`), `BuffAuthority` port.

**Produces (everyone else imports):** `BuffDefinition` (new shape), `BuffInstance`, `BuffInstanceId` minting, `BuffInstanceSnapshot`, `BuffModifier`, `BuffModifierChannel`, `BuffModifierLifetime`, `BuffPeriodic`, `BuffRemovalReason` impl, `BuffQuery`/`BuffReadPort`, `ApplicationResolver`, `BuffLifecycle` (entry-point enum), `BuffEvent` union (`BuffApplied`, `BuffStacksChanged`, `BuffRemoved`, `BuffPeriodicResolved`, `BuffModifierAdded/Removed`, `ElementalApplicationCommitted` emission site), `BuffSystem` (buff2), `BuffRegistry` (buff2).

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R1 | There is NO separate turn-native impl to absorb — `TurnBuffSystem.ts`/`TurnBuffPool.ts` were retired; tests under `core/battle/turn/TurnBuff*.test.ts` already exercise `core/buff`. | Verified: `TurnBuffSystem.test.ts` imports `../../buff/BuffSystem`. buffs.md doc is stale. |
| R2 | `player.persistentTimedEffects` (Kiếp Thương etc.) stays on the existing `BuffSystem.updateTime` path → migrates to buff2's `onTimeElapsed` entry point; NOT battle-scoped instances. | Spec's lifecycle includes time elapsed; persistent pool is per-player not per-battle — buff2 exposes a standalone pool mode for it. |
| R-B1 | `BuffInstanceId` format `buff.${battleId}.${counter}` — minted by buff2, never by callers; battleId from scheduler `rootActionId` context or ctor param. | Reaction preconditions need stable ids across a settlement barrier; monotonic-per-battle suffices. |
| R-B2 | DoT under new model = `periodic` effect with `trigger:'holder_turn_end'` (matches today's `update()` tick site at `TurnBattleSystem.ts:1110`) AND `trigger:'time_elapsed'` for wall-clock path. Dynamic resolution replaces the apply-time snapshot; `scaleBuffPotency`-dependent content (Cong Minh amp) migrates to `AddBuffModifier {channel:'periodic_damage'|'potency', reapply:'max'}` — `potencyAmplified` flag dies. | Spec §22/§29–31; preserves Cong Minh semantics ("amplify once, strongest wins") as data. |
| R-B3 | Ailment application chance: `finalChance = clamp(baseChance + source.elementApplicationPercent − target.ailmentResistApplication?, 0..1)` — keep EXACTLY today's formula (`resolveAilmentApplicationChance` at `TurnBattleSystem.ts:2955` = chance + elementApplicationPercent only) until a spec amendment adds target-side application resist. Duration resist scaling stays where it is (duration computation, not application). | Spec §25 mentions target ailment resist lowering application — NOT current behavior; flag, don't silently add. |
| R-B4 | `instanceScope` becomes explicit: `'per_source'` (default, replaces implicit `(id,sourceId)` keying) | `uniquePerTarget` maps to `instanceScope:'per_target'`; 'all'-scope (shared across sources) supported but unused until authored. | spec §44 names the concept; today's `getFromSource` IS per_source. |
| R-B5 | `statModifier` effects stay emitted as `StatModifier[]` via a `getActiveModifiers(holderId)`-equivalent — consumer (`TurnBattleSystem.recomputeEffectiveStats`/`liveStatModifiers` closure `:470`) keeps its shape. | The ops-layer modifier closure contract is preserved; buff2 changes the source, not the projection. |
| R-B6 | `forbiddenActionTags` lives on `BuffDefinition` (spec §47 `capabilities` descriptor family) — additive field; consumed by reaction plan's `ActionValidator`. | Contract §6/§71. |

---

## Mission 0 — Inventory + prerequisite verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-buff-inventory.md`

- [ ] **Step 1 — Lock baseline:** `git rev-parse HEAD`.
- [ ] **Step 2 — Verify contract prerequisites (BLOCKING):** `contracts/operations.ts` buff op subset + `BuffInstanceSelector`/`ApplyBuffRequest`/`ApplyBuffResult`/`ConsumeStacksResult`; `contracts/results.ts`; `contracts/events.ts` `ElementalApplicationCommitted`/`BuffApplicationFailedEvent`; `contracts/rng.ts` `CombatRng`; `contracts/elemental.ts`; `contracts/context.ts` `CombatAuthorityExecutionContext`; `scheduler/CombatOperationExecutor.ts` + `BuffAuthority` port (all methods take `ctx`); `CombatScheduler.enqueueEvent`/`enqueueAuthored`. Missing → BLOCKED.
- [ ] **Step 3 — BuffPool/BufSystem consumer census (drives M4):**
  - **Pools:** every `new BuffPool()` site — `TurnBattleParticipant.buffs` field decl (`TurnBattleSystem.ts` participants; `TurnBattleAdapter.ts` build), allies' `buffPool`, `player.persistentTimedEffects` pool owner (find in `GameManager*.ts`/`PlayerData`), `pendingGaugeDeltaDefinition` path (`:483`).
  - **Reads:** `getActiveModifiers` consumers (`liveStatModifiers` closure `:470`, `recomputeEffectiveStats`), `getStacks`/`getFromSource`/`getAllById`/`hasAny` call sites (skill conditions, `applySkillAilments`, detonate `dot` scan at `detonateDoT` impl, `consumesAilmentId` reads, UI `buffState` snapshot in `action_executed` payload → `BattleFloatingStatusBar`/`battleHUDStore`), CC queries `isStunned/isFrozen/isRooted` (`declareActorAction` CC check ~`:960+`), `clearCcEffects` (Bá Thể), proc rollers `rollOnHitEffects`/`rollReactiveTrigger` call sites.
  - **Writes:** every `new BuffSystem(pool).apply(...)` (`:1824` appliesBuffs lane, `:2973` ailment lane, `convert()`, proc application, `grantsBuffsAtBuild`, external-ward grants, Kiem Tu combos, `BuffSystem.ts:168` internal reapply), `remove`/`removeAllById` (cleanse lanes, detonate, `consumesAilmentId`).
- [ ] **Step 4 — Data census:** every file under `game/src/data/buff/` — count defs per `stackMode`, defs using `convertsToId` (`kiep_thuong` chain), `uniquePerTarget` (taunt, son_nhac_ho_the), `clearsCcOnApply` (Bá Thể), `durationPolicy:'fixed_holder_turns'` (Thế Tu kit), `element:` field (current ailments — `bong`,`trung_doc`,`chay_mau`,`te_cong`,`hoai_tu`,`thach_hoa`), marker/reactiveProc/reactiveEconomy/theEconomy carriers (Thế Tu kit ~230 lines in `TheTuBuffs.ts`), `dotRecovery` (Độc Căn inside `trung_doc`), `gaugeDelta`. Output: per-file def-id table → migration mapping.
- [ ] **Step 5 — Effect-template usage matrix:** which of the 11 `BuffEffectTemplate` kinds are used by which def — buff2's `BuffPeriodic`/`marker`/etc. equivalents must cover ALL; no silent drops.
- [ ] **Step 6 — Write authority matrix + R1/R2/R-B1..R-B6 table** for sign-off.

**Exit criteria:** every consumer + every definition accounted; prereqs verified; stale-doc note recorded (`docs/systems/buffs.md` claims TurnBuffSystem exists).

---

## Mission 1 — buff2 types + store + queries (no behavior, pure model)

**Files:**
- Create: `game/src/core/buff2/BuffDefinition.ts` — new def shape
- Create: `game/src/core/buff2/BuffInstance.ts` — runtime instance + `BuffInstanceSnapshot`
- Create: `game/src/core/buff2/BuffModifier.ts` — modifier types
- Create: `game/src/core/buff2/BuffStore.ts` — battle-scoped instance store (the pool replacement)
- Create: `game/src/core/buff2/BuffQuery.ts` — `BuffReadPort`/`BuffQuery` read surfaces
- Create: `game/src/core/buff2/BuffRegistry.ts` — definition catalog + startup validation
- Create: `game/src/core/buff2/testing/BuffTestFixtures.ts` — fixture world builder (owns `test_*` ids — shared naming with reaction plan's fixtures module; this plan creates them, reaction plan imports)
- Test: `BuffStore.test.ts`, `BuffRegistry.test.ts`, `BuffQuery.test.ts`

**Interfaces — Produces (exact shapes):**

```ts
// BuffDefinition.ts — spec §22–24, §44–47; effects are RECIPES, no magnitudes
export type BuffKind = 'buff' | 'debuff' | 'ailment' | 'stance' | 'marker'
export type BuffInstanceScope = 'per_source' | 'per_target' | 'all'
export type BuffReapplyPolicy = 'stack' | 'refresh' | 'replace' | 'fail'
export interface BuffStackingRule { maxStacks: number; onApply: 'add' | 'refresh_only'; onReapply: BuffReapplyPolicy; overflow: 'discard' }
export type BuffLifetimeAnchor = 'holder_turns' | 'source_turns' | 'rounds' | 'battle' | 'permanent' | 'time_seconds'
export interface BuffLifetime { anchor: BuffLifetimeAnchor; duration: number; durationPolicy?: 'ailment_scaled' | 'fixed_holder_turns' }
export type BuffRemovalCondition = 'holder_death' | 'source_death' | 'battle_end' | 'cleanse' | 'manual' | 'converts' | 'counter_window_expired'
export interface BuffHooks { onApply?: string; onRemove?: string; onStackChange?: string; onExpire?: string } // script/event ids, not code
export interface BuffPeriodic {
  id: string
  trigger: 'holder_turn_end' | 'round_end' | 'time_elapsed'
  kind: 'damage' | 'heal'
  element?: ElementType | 'physical'
  dpsRatio?: number                    // power-domain recipes
  baseCoefficient?: number             // 'buff' power domain
  powerDomain: 'source_stats' | 'buff'
  scaling: 'per_stack' | 'flat'
  tags?: readonly string[]
  armorIgnorePercentByRealm?: boolean
}
export type BuffEffectKind =
  | { type: 'stat_modifier'; stat: StatType; percent?: number; flat?: number; domain?: StatDomain }
  | { type: 'periodic'; periodic: BuffPeriodic }
  | { type: 'cc'; ccEffect: 'stun' | 'freeze' | 'root' }
  | { type: 'action_restriction'; forbiddenActionTags: readonly string[] }   // Cấm Công — generic, contract §6
  | { type: 'marker'; markerId: string; flags?: Record<string, boolean | number> }  // absorbs marker/theEconomy/reactiveProc/reactiveEconomy as keyed payloads
  | { type: 'on_hit_proc'; chance: number; appliesBuffId: BuffDefinitionId }
  | { type: 'reactive_trigger'; trigger: ReactiveTriggerName; chance: number; appliesDefinitionId?: BuffDefinitionId; queuesFollowUp?: boolean; reflectsDamage?: { maxHpRatio: number; takenRatio: number } }
  | { type: 'gauge_delta'; percentOfMax: number }
  | { type: 'dot_recovery'; element?: ElementType | 'physical'; healPercent: number }
export interface BuffDefinition {
  id: BuffDefinitionId
  name: string
  polarity: 'buff' | 'debuff'
  kind: BuffKind
  element?: ElementType               // canonical element tag (today's `element` field)
  hidden?: boolean
  stacking: BuffStackingRule
  lifetime: BuffLifetime
  instanceScope: BuffInstanceScope
  removalConditions: readonly BuffRemovalCondition[]
  clearsCcOnApply?: boolean
  convertsToId?: BuffDefinitionId
  convertsAfterContinuousTurns?: number
  capabilities?: readonly string[]    // spec §47 descriptor channel (ungranted for now)
  effects: readonly BuffEffectKind[]
  hooks?: BuffHooks
}

// BuffInstance.ts
export interface BuffInstance {
  instanceId: BuffInstanceId
  definitionId: BuffDefinitionId
  sourceId: CombatEntityId
  targetId: CombatEntityId          // effect target; holder = targetId for debuffs, == sourceId for self-buffs
  holderId: CombatEntityId          // pool owner (today's pool key — preserves ARCH-009 misroute guard)
  stacks: number
  remaining: number                 // units per lifetime.anchor
  continuousTurns: number           // converts bookkeeping
  modifiers: readonly BuffModifier[]
  appliedAtSequence: number
}
export interface BuffInstanceSnapshot extends Readonly<BuffInstance> {}

// BuffModifier.ts — spec §29–31
export type BuffModifierChannel = 'potency' | 'periodic_damage' | 'next_periodic_damage' | 'duration' | 'application_chance'
export type BuffModifierOperation = 'add' | 'multiply' | 'set'
export type BuffModifierReapply = 'replace' | 'stack' | 'max' | 'min'
export type BuffModifierLifetime =
  | { type: 'buff_lifetime' } | { type: 'battle' } | { type: 'explicit' }
  | { type: 'uses'; remaining: number } | { type: 'holder_turns'; remaining: number }
  | { type: 'source_turns'; remaining: number } | { type: 'rounds'; remaining: number }
export interface BuffModifier {
  id: string; appliedBy?: CombatEntityId
  channel: BuffModifierChannel; operation: BuffModifierOperation; value: number
  reapply: BuffModifierReapply; priority: number
  lifetime: BuffModifierLifetime
}
```

```ts
// BuffStore.ts — replaces per-entity BuffPool
export class BuffStore {
  constructor(private readonly mintInstanceId: () => BuffInstanceId)
  add(instance: BuffInstance): void
  get(instanceId: BuffInstanceId): BuffInstance | undefined
  remove(instanceId: BuffInstanceId): BuffInstance | undefined          // returns removed (for events)
  forHolder(holderId: CombatEntityId): readonly BuffInstance[]
  forTarget(targetId: CombatEntityId): readonly BuffInstance[]
  fromSource(sourceId: CombatEntityId): readonly BuffInstance[]
  byDefinition(definitionId: BuffDefinitionId): readonly BuffInstance[]
  find(definitionId: BuffDefinitionId, sourceId: CombatEntityId, targetId: CombatEntityId): BuffInstance | undefined  // instanceScope key
  all(): readonly BuffInstance[]
}

// BuffQuery.ts — read-only views handed to Reaction/Skill/UI
export interface BuffReadPort {
  getInstance(sel: BuffInstanceSelector): BuffInstanceSnapshot | undefined
  getForTarget(targetId: CombatEntityId): readonly BuffInstanceSnapshot[]
  getForHolder(holderId: CombatEntityId): readonly BuffInstanceSnapshot[]
  getByDefinition(definitionId: BuffDefinitionId): readonly BuffInstanceSnapshot[]
  getStacks(definitionId: BuffDefinitionId, sourceId?: CombatEntityId, targetId?: CombatEntityId): number
  hasForbiddenTags(entityId: CombatEntityId): ReadonlySet<string>      // resolves effect 'action_restriction' via registry
}
```

- [ ] **Step 1 — Failing tests (store):** keying by `instanceId`; `forHolder`/`forTarget`/`fromSource`/`byDefinition` filters; `find` honors `per_source` scope; remove returns the instance (event needs stacks-at-removal).
- [ ] **Step 2 — Failing tests (registry):** duplicate id throws; `convertsToId`/`appliesBuffId`/`appliesDefinitionId`/`convertsTo` references all resolvable (startup validation); unknown `StatType`/`ElementType` rejected.
- [ ] **Step 3 — Failing tests (query):** snapshots are frozen copies (mutating a snapshot doesn't corrupt store); `getStacks` source-scoped vs aggregate matches legacy `BuffSystem.getStacks` dual semantics.
- [ ] **Step 4 — Implement** all files. **Migration mapping table** (in code comments + inventory doc): `stackMode:'stack'`→`stacking{onApply:'add',onReapply:'stack'}`; `'refresh'`→`{onApply:'refresh_only'}`; `'replace'`→`{onReapply:'replace'}`; `uniquePerTarget`→`instanceScope:'per_target'`+`onReapply:'replace'`; `duration`+`durationPolicy`→`lifetime{anchor:'holder_turns',durationPolicy}`; `convertsAfter*`→same; `cc`→`effect cc`; `dot`→`effect periodic{trigger:'holder_turn_end',kind:'damage',powerDomain:'source_stats'}`; `dotRecovery`→`dot_recovery`; markers/theEconomy/reactiveProc/reactiveEconomy→`marker{markerId, flags}` (markerId = `the_economy`|`reactive_proc:*`|`reactive_economy` — preserves today's duck-typed detection via `markerId` lookup, NOT flags).
- [ ] **Step 5 — Verify (P3 quick).**

**Exit criteria:** model compiles; store/query/registry proven; full legacy-field→new-field mapping written down — M4's data migration is mechanical from here.

---

## Mission 2 — Modifier engine + ApplicationResolver + BuffSystem.apply/remove/stacks

**Files:**
- Create: `game/src/core/buff2/BuffModifierEngine.ts` — apply/remove/reapply/expiry
- Create: `game/src/core/buff2/ApplicationResolver.ts` — chance/resist/rng/instance-resolution
- Create: `game/src/core/buff2/BuffSystem.ts` — mutation authority (apply/stacks/modifier/duration/remove/query)
- Create: `game/src/core/buff2/BuffEvents.ts` — `BuffEvent` union + payload shapes
- Test: `ApplicationResolver.test.ts`, `BuffModifierEngine.test.ts`, `BuffSystemApply.test.ts`, `BuffStacks.test.ts`

**Interfaces — Produces:**

```ts
// ApplicationResolver.ts — spec §25; sole owner of the application roll
export class ApplicationResolver {
  constructor(private readonly rng: CombatRng, private readonly caps?: { ailmentResistCap?: number })
  resolve(req: ApplyBuffRequest, ctx: {
    source: { stats: { elementApplicationPercent?: number; ailmentDurationPercent?: number } }
    target: { stats: { ailmentResistPercent?: number } }
    definition: BuffDefinition
  }): { success: boolean; duration: number; chance: number }
  // duration: ailment_scaled → base*(1-min(cap,resist))*(1+srcDur); fixed_holder_turns → base verbatim (R-B3 keeps today's formula)
}

// BuffSystem.ts — the mutation authority (spec §51 surface).
// Contract v4: NO ctor-injected emit — events are emitted through
// ctx.events with producer-minted eventIds (`evt.${ctx.operationId}.${type}.${ordinal}`)
// + `causationOperationId = ctx.operationId`. The scheduler stamps only combatSequence.
export class BuffSystem {
  constructor(
    private readonly store: BuffStore,
    private readonly registry: BuffRegistry,
    private readonly resolver: ApplicationResolver,
    private readonly stats: StatProviderPort,               // resolve entities for periodic math — narrow port
    private readonly readSeq: () => number,                 // appliedAtSequence — READ-ONLY view of scheduler's counter (reading ≠ allocating; scheduler stays sole allocator)
  )

  // === cross-authority surface (the BuffAuthority port impl — every method takes ctx) ===
  apply(req: ApplyBuffRequest, ctx: CombatAuthorityExecutionContext): ApplyBuffResult
  addStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): { stacksBefore: number; stacksAfter: number }
  removeStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): { stacksBefore: number; stacksAfter: number }
  consumeStacks(sel: BuffInstanceSelector, stacks: number | 'all', reason: 'consumed' | 'reaction', ctx: CombatAuthorityExecutionContext): ConsumeStacksResult
  addModifier(sel: BuffInstanceSelector, mod: BuffModifier, ctx: CombatAuthorityExecutionContext): void
  removeModifier(sel: BuffInstanceSelector, modifierId: string, ctx: CombatAuthorityExecutionContext): void
  refreshDuration(sel: BuffInstanceSelector, duration: number | undefined, ctx: CombatAuthorityExecutionContext): { durationBefore: number; durationAfter: number }
  extendDuration(sel: BuffInstanceSelector, turns: number, maxRemaining: number | undefined, ctx: CombatAuthorityExecutionContext): { durationBefore: number; durationAfter: number }
  remove(sel: BuffInstanceSelector, reason: BuffRemovalReason, ctx: CombatAuthorityExecutionContext): void

  // === lifecycle entry points (spec §53; replaces catch-all update()) ===
  // Lifecycle emissions have no executing op — ids mint from the root
  // transaction id (`evt.${lctx.rootActionId}.${type}.${ordinal}`); TurnBattleSystem
  // passes the status-phase root (`status.turn.N.*`) per R-C2.
  onHolderTurnEnd(holderId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onSourceTurnEnd(sourceId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onRoundEnd(lctx: BuffLifecycleContext): readonly PeriodicResolution[]
  onHolderDeath(holderId: CombatEntityId, lctx: BuffLifecycleContext): void
  onSourceDeath(sourceId: CombatEntityId, lctx: BuffLifecycleContext): void
  onBattleEnd(lctx: BuffLifecycleContext): void
  onTimeElapsed(holderId: CombatEntityId, seconds: number, lctx: BuffLifecycleContext): readonly PeriodicResolution[]  // persistent pool mode (R2)

  // === periodic ===
  resolvePeriodic(holderId: CombatEntityId, lctx: BuffLifecycleContext): readonly PeriodicResolution[]      // internal
  triggerPeriodic(sel: BuffInstanceSelector, periodicId: string | undefined, ctx: CombatAuthorityExecutionContext): readonly PeriodicResolution[]  // TriggerBuffPeriodic — no lifetime advance (contract §73)

  // === queries (BuffReadPort impl) ===
  getInstance(sel: BuffInstanceSelector): BuffInstanceSnapshot | undefined
  getForTarget / getForHolder / getByDefinition / getStacks / hasForbiddenTags
  getActiveModifiers(holderId: CombatEntityId): StatModifier[]   // R-B5 — same StatModifier shape as legacy
}

// BuffLifecycleContext.ts — root-transaction context for non-op emissions
export interface BuffLifecycleContext {
  rootActionId: string        // e.g. `status.turn.35.player` — minted by the turn-lifecycle owner
  events: CombatEventSink     // same sink lane as ctx.events
}
```

```ts
// BuffEvents.ts — every event post-commit; ElementalApplicationCommitted among them (spec §60).
// All members extend CombatEventBase: producer-minted `eventId` +
// `causationOperationId` (authority-ctx emissions) — scheduler stamps only
// `combatSequence`. These pending shapes are added to contracts/events.ts by
// THIS plan (closed union — edit the central file, contract v4).
export type BuffEvent =
  | { type: 'buff_applied'; instanceId; definitionId; sourceId; targetId; created: boolean }
  | { type: 'buff_stacks_changed'; instanceId; stacksBefore; stacksAfter; addedStacks }
  | { type: 'buff_removed'; instanceId; definitionId; sourceId; targetId; reason: BuffRemovalReason; stacksAtRemoval: number }
  | { type: 'buff_periodic_resolved'; instanceId; periodicId; kind: 'damage'|'heal'; amount: number }
  | { type: 'buff_modifier_added' | 'buff_modifier_removed'; instanceId; modifierId }
  | ElementalApplicationCommitted   // emitted ONLY by elemental-kind applies that added stacks (§20–21)
  | { type: 'buff_application_failed'; definitionId; sourceId; targetId; reason }
// (each & CombatEventBase — eventId/causationOperationId minted per emission site)
```

**Application flow (spec §25 + contract §16–21):**
```
apply(req, ctx):   // ctx = CombatAuthorityExecutionContext (v4)
  def = registry.get(req.definitionId)              // unknown → throw (structural, §50)
  {success, duration} = resolver.resolve(req, resolverCtx)  // ONE CombatRng roll
  if !success: ctx.events.emit(buff_application_failed{eventId:`evt.${ctx.operationId}.buff_application_failed.0`, causationOperationId:ctx.operationId, ...}); return {applied:false}   // §18 — no state touched
  resolve instance by instanceScope:
    per_source → find(defId, sourceId, targetId)
    per_target → any source's instance on target
    all        → shared instance
  apply stacking.onApply/onReapply:
    add      → stacks += req.stacks clamp maxStacks; addedStacks = after-before; overflow = discarded
    refresh_only → remaining = duration; addedStacks = 0
    replace  → remove old (reason 'replaced'), create new
    fail     → return {applied:false}
  clearsCcOnApply → strip holder's cc instances (reason 'cleansed')
  commit → ctx.events.emit buff_applied / buff_stacks_changed
           (eventId `evt.${ctx.operationId}.${type}.${i}`, causationOperationId = ctx.operationId)
  if def.kind === 'ailment' && element set && addedStacks > 0:
    ctx.events.emit ElementalApplicationCommitted (reactionEligibility from REQ, §14)
  return full ApplyBuffResult
```

**Modifier semantics (spec §30–32):**
- Application order per channel: `priority` asc → `multiply` before `add` within equal priority (locked order — record in tests).
- `reapply`: `replace` overwrites same-id; `stack` accumulates list entries; `max`/`min` keep extreme.
- Lifetime decrement happens ONLY in matching lifecycle entry point; `uses` decremented by the consumption site (periodic resolve for `next_periodic_damage`).
- `buff_lifetime` modifiers die with the instance (reaction amplifiers).

- [ ] **Step 1 — Failing tests (resolver):** chance = base + elementApplicationPercent (R-B3 — NO target-resist-at-application yet, matches today); `durationPolicy` both branches; `AILMENT_RESIST_CAP=0.75` preserved; roll boundary (`rng=chance` fails, `<` succeeds — preserve today's `<` semantics from `:2955`).
- [ ] **Step 2 — Failing tests (apply):** new instance vs reapply per `onReapply`; `addedStacks` exact at cap (5+2 → added 0, `overflowStacks` 2, duration refreshed — contract §21); `per_target` scope replaces others' instances; failed roll mutates nothing and emits only `buff_application_failed`; elemental + `addedStacks>0` → exactly one `ElementalApplicationCommitted` carrying request's `reactionEligibility`/`origin`; non-elemental or refresh-only → none.
- [ ] **Step 3 — Failing tests (stacks/modifiers):** `addStacks`/`removeStacks`/`consumeStacks` mutate WITHOUT emitting elemental event (contract §22 — structural recursion block); `consumeStacks('all','reaction')` → instance removed, result `{consumed, remaining:0, removed:true}`; modifier `reapply:'max'` keeps larger value; `priority` ordering; `next_periodic_damage` consumed once.
- [ ] **Step 4 — Implement.**
- [ ] **Step 5 — Verify (P3 quick).**

**Exit criteria:** `apply`/`consume`/`modifier` semantics proven on fixtures; event contract honored (elemental event iff `kind:'ailment'` + `addedStacks>0` + post-commit); zero RNG outside the resolver.

---

## Mission 3 — Periodic engine + lifecycle entry points + hooks

**Files:**
- Create: `game/src/core/buff2/BuffPeriodicResolver.ts` — dynamic magnitude math + requests
- Modify: `game/src/core/buff2/BuffSystem.ts` — lifecycle methods wired
- Create: `game/src/core/buff2/BuffPersistence.ts` — standalone per-entity pool mode for `persistentTimedEffects` (R2)
- Test: `BuffPeriodic.test.ts`, `BuffLifecycle.test.ts`, `BuffConversion.test.ts`, `BuffPersistence.test.ts`

```ts
// BuffPeriodicResolver.ts — spec §26–28; NO direct damage — requests only.
// SHAPES ARE CONTRACT-OWNED (contract megaplan v4 `periodic.ts`) — buff2 does
// NOT redefine them. Review r3 BLOCKER 3: the request carries damageProfile +
// coefficient + hit/miss/crit — NOT `rawPower`. Buff resolves lifecycle/stack
// semantics (stack scaling already folded into `coefficient`); DamageSystem
// resolves the combat formula. Scheduler converts each request 1:1 into a
// ResolvedCombatOperation (origin.kind 'buff_periodic').
export type { BuffPeriodicDamageRequest, BuffPeriodicHealRequest, PeriodicResolution } from '../../battle/contracts/periodic'
//   BuffPeriodicDamageRequest = {instanceId, periodicId, sourceId, targetId,
//     element?, damageProfile, coefficient, hitCount, canCrit, canMiss,
//     stackCount?, tags?}
//   BuffPeriodicHealRequest   = {instanceId, periodicId, sourceId, targetId,
//     amount, capFractionOfHealTargetMaxHp?}

// Dynamic coefficient (replaces BuffSystem.calculateDamagePerTurn + damagePerTurn snapshot):
resolvePeriodicDamage(def, instance, sourceStats, targetStatsSnapshot):
  coefficient = periodic.powerDomain === 'source_stats'
    ? elementalBaseCoefficient-equivalent via stats port (physical → might; element → per-element base)
    : periodic.baseCoefficient
  × (scaling === 'per_stack' ? instance.stacks : 1)
  × modifierFactor(instance.modifiers, 'periodic_damage')          // multiplicative chain
  × modifierFactor(instance.modifiers, 'potency')                  // ailmentPotencyPercent analog → moves to modifier channel
  then consume 'next_periodic_damage' uses
  // request.coefficient = the stack-scaled effective coefficient; DamageSystem's
  // damageProfile applies stats/scaling/mitigation/crit. BuffSystem stays free
  // of Armor/Resistance imports — mitigation is profile-owned.
```

**Lifecycle matrix (spec §53–56 — the regression-prone part):**

| Entry point | Decrements | Runs periodic | Converts check | Removes |
|---|---|---|---|---|
| `onHolderTurnEnd(h)` | `holder_turns` lifetimes on h's buffs | holder_turn_end triggers | continuousTurns++ then convertsToId | expired → reason 'expired' |
| `onSourceTurnEnd(s)` | `source_turns` | source_turn_end | — | expired |
| `onRoundEnd` | `rounds` | round_end | — | expired |
| `onHolderDeath(h)` | — | — | — | `holder_death` defs → reason 'death' |
| `onSourceDeath(s)` | — | — | — | `source_death` defs → 'source_death' |
| `onBattleEnd` | — | — | — | all → 'battle_end' |
| `onTimeElapsed(h,s)` | `time_seconds` on h | time_elapsed | continuous++ | expired |

`convertsToId` semantics ported verbatim from `BuffSystem.convert` (`:222–256`): remove source instance → apply conversion def **through the same apply()** (recursive call keeps resist/duration formula — it emitted as a fresh application; mark `reactionEligibility:'suppressed'` on conversions so a converting elemental ailment can't trigger reactions — flag as R-B7 provisional).

- [ ] **Step 1 — Failing tests (periodic):** 3-stack fixture DoT → request `coefficient` scales with stacks AND live source stats (mutate stats between ticks → second tick differs — the spec §27 dynamic-resolution requirement that the OLD system fails); emitted request carries `damageProfile`/`canCrit`/`canMiss`/`hitCount` (scheduler converts 1:1 to `deal_damage` — contract v4); `next_periodic_damage` modifier applies once then gone; `powerDomain:'buff'` uses `baseCoefficient`; source dead → spec says requests still emitted for `holder_death`-only removal defs (verify against spec §55 row — source death removes only if `source_death` listed).
- [ ] **Step 2 — Failing tests (lifecycle):** `onHolderTurnEnd` decrements only `holder_turns` anchors; expiry order (periodic BEFORE decrement-then-remove, matching today's order in `update()` `:346–390`); `convertsToId` at threshold fires once, new instance at stacks=1 with suppressed eligibility; `onHolderDeath` clears `holder_death` defs only; `onSourceDeath` clears `source_death` defs (spec's Trấn Ấn use-case).
- [ ] **Step 3 — Failing tests (persistence):** `BuffPersistence` standalone pool — `onTimeElapsed` ticks seconds, no combat deps, events still emitted for log.
- [ ] **Step 4 — Failing tests (hooks):** `onExpire`/`onRemove`/`onStackChange` hook ids surface on the emitted events (hook EXECUTION is out of scope — events carry the id for the ops layer to consume).
- [ ] **Step 5 — Implement + verify (P3 quick).**

**Exit criteria:** periodic is dynamic + request-based; all 7 lifecycle entry points proven; conversion + persistence ported; every mutation still evented.

---

## Mission 4 — Cutover part A: data migration + TurnBattleSystem reroute

**Files:**
- Modify: `game/src/data/buff/**` — migrate all ~7 def files to `BuffDefinition` (mechanical per M1 mapping); `BuffRegistry.ts` becomes buff2 registry
- Create: `game/src/core/buff2/adapters/LegacyBuffDefinitionAdapter.ts` — converts old `BuffDefinition` shape → new (so unmigrated content keeps working during transition; REMOVED in M5)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — participants stop owning `BuffPool`; single battle `BuffSystem` instance; `applySkillAilments` → `ApplyBuffRequest` through scheduler; buff tick at `:1110` → `onHolderTurnEnd`; CC check → `hasForbiddenTags`-style query / `hasActiveCc` port; `rollOnHitEffects`/`rollReactiveTrigger` rerouted
- Modify: `game/src/core/battle/turn/TurnBattleAdapter.ts` — construct buff2 `BuffSystem` + registry + rng + stats port at battle build
- Test: `TurnBattleSystem.buff2.test.ts` (port the relevant `TurnBuffSystem*.test.ts` assertions), `data/buff/*.test.ts` updated

**Reroute map (exact call-site changes):**

| Today | After |
|---|---|
| `actor.buffs: BuffPool` per participant | `battleBuffs: BuffSystem` single; participant keeps `entity.id` only |
| `new BuffSystem(actor.buffs).update(actor.entity, this.combat, registry, resolveSource, resolveSourceBuffs)` `:1110` | `const resolutions = buffs.onHolderTurnEnd(actor.id, lctx); scheduler.enqueueAuthored(periodicRequests→ops)` |
| `applySkillAilments` loop `new BuffSystem(target.buffs).apply(def,...)` per stack `:2973` | ONE `ApplyBuffOperation{stacks}` through executor → buff2 `apply` handles stack math; `initiatesReactions` becomes the request's `reactionEligibility:'eligible'` (legacy `TurnReactionManager` still called after — R3 bridge, marked for seal-batch removal) |
| `new BuffSystem(target.buffs).apply(def,...)` appliesBuffs lane `:1824` | same `ApplyBuffOperation` route, `reactionEligibility:'suppressed'` (appliesBuffs are not elemental applications today — verify per def `kind`) |
| `BuffSystem.isStunned/isFrozen/isRooted(targetId)` CC checks | `buffs.hasActiveCc(holderId, targetId, 'stun')` query — same ARCH-009 targetId guard ported |
| `getActiveModifiers()` per participant → `liveStatModifiers` | `buffs.getActiveModifiers(holderId)` — identical `StatModifier[]` output |
| `rollOnHitEffects`/`rollReactiveTrigger` | stay buff2 methods; rng param → `CombatRng`; follow-up/reflect return values unchanged |
| `BuffPool.clearCcEffects` (Bá Thể apply) | internal to buff2 `apply` via `clearsCcOnApply` |
| `scaleBuffPotency` (Cong Minh amp call sites — find in `TurnBattleSystem`/`GameManagerTurnBattleOps`) | `AddBuffModifierOperation{channel:'periodic_damage',reapply:'max',lifetime:'buff_lifetime'}` — deletes `potencyAmplified` |
| `consumesAilmentId`/detonate reads `getStacks`+`removeAllById` | `buffs.getStacks` / `ConsumeBuffStacksOperation` |

- [ ] **Step 1 — Adapter first:** `LegacyBuffDefinitionAdapter` converts ALL existing data files' defs at registry build — lets the cutover land BEFORE rewriting 900+ lines of data (keep diff reviewable).
- [ ] **Step 2 — Failing tests:** participant-scoped buff queries (source isolation: A's burn on T vs B's burn on T); ailment apply through scheduler emits real `ElementalApplicationCommitted`; legacy reaction manager still fires (bridge intact); periodic requests reach damage authority through the executor.
- [ ] **Step 3 — Migrate `data/buff/` files** file-by-file with a per-file test flip (each file's existing test updates to new shape — `buffs.test.ts`, `TheTuBuffs.test.ts`, `ZoneDotBuffs.test.ts`, `BuffRegistry.test.ts`, `buffs.registryConsistency.test.ts`).
- [ ] **Step 4 — Verify (P3 FULL)** + **P13/P14 Playwright** real battle: ailment applies, DoT ticks, buffs expire, CC blocks a turn. **P4 deep + P5 round.**

**Exit criteria:** no production `new BuffPool()` remains except inside `BuffPersistence` mode; all data migrated; full suite green; real battle verified.

---

## Mission 5 — Cutover part B: UI/persistence/ops-layer + deletion list

**Files:**
- Modify: `game/src/core/game/GameManager*.ts` — `persistentTimedEffects` → `BuffPersistence` pool; `kiep_thuong` wall-clock ticks → `onTimeElapsed`
- Modify: presentation snapshot — `action_executed` `buffState` payload source → `getForHolder` snapshots (keep payload shape identical — UI untouched if possible)
- Modify: `game/src/ui/**` (`BattleFloatingStatusBar`, `battleHUDStore`) ONLY if payload shape forces it
- Delete: `game/src/core/buff/BuffPool.ts`, `BuffSystem.ts`, `BuffTypes.ts` (old shapes), `Buff.ts`, `BuffDefinition.ts`, `BuffRegistry.ts`, `BuffNames.ts` (if supplanted), `LegacyBuffDefinitionAdapter.ts` (once all data migrated)
- Rename/move: `core/battle/turn/TurnBuff*.test.ts` → `core/buff2/` (they test the canonical system — R1)
- Update: `game/docs/systems/buffs.md` (rewrite to buff2), `roadmap.md`

- [ ] **Step 1 — Migrate remaining consumers** per M0 census (search for residual `import.*core/buff/` hits; every hit gets a mapped replacement — NO import left of the old package).
- [ ] **Step 2 — Delete list execution** + full suite.
- [ ] **Step 3 — Spec DoD sweep (§83–84):** each row → named test or "owned by sibling plan"; verify INV-B1–B9 equivalents all covered.
- [ ] **Step 4 — Docs + verify (P3 FULL) + P13/P14 + P4 deep + P5 round.**

**Exit criteria:** `core/buff/` package gone; buff2 is THE authority; DoD rows accounted; zero `Math.random`/direct-damage inside buff2; `git grep "core/buff/"` returns only doc references.

---

## Test matrix — spec/contract → named tests

| Source | Requirement | Test |
|---|---|---|
| §16–18 | failed app: no mutation, no event, no reaction | `BuffSystemApply.test.ts :: failed roll commits nothing` |
| §20–21 | elemental commit event iff addedStacks>0 | `:: cap refresh emits no elemental event` |
| §22 (contract) | AddStacks → no elemental event | `BuffStacks.test.ts :: stack mutation is silent` |
| §25 | application authority owns roll | `ApplicationResolver.test.ts :: sole rng consumer` |
| §26–28 | dynamic periodic per resolution | `BuffPeriodic.test.ts :: stat change between ticks changes damage` |
| §29–32 | modifier reapply/priority/lifetime | `BuffModifierEngine.test.ts` |
| §40–47 (contract) | consume-by-instanceId preconditions support | `BuffStacks.test.ts :: consume by instanceId` + snapshot fields |
| §53–56 | 7 lifecycle entry points | `BuffLifecycle.test.ts :: per-anchor decrement matrix` |
| §47/§71 | forbiddenActionTags stored on def | `BuffQuery.test.ts :: hasForbiddenTags` |
| ARCH-009 | cc targets buff.targetId not holder | ported `:: misrouted cc does not control holder` |
| Legacy | `uniquePerTarget`/`clearsCc`/`convertsTo`/`fixed_holder_turns` | `BuffSystemApply.test.ts` + `BuffConversion.test.ts` |
| Contract §102 | internal lifecycle needs no CombatOperation | `BuffLifecycle.test.ts :: expiry is internal` |

## Deferred to sibling plans / seal batch

- Real `reactionEligibility` producers beyond the `initiatesReactions` bridge; `ReactionSystem` wiring → reaction megaplan
- `TriggerBuffPeriodic`/`read_stacks` operation producers → skill megaplan
- Five real ấn defs + `doc_can` rename collision + legacy `bong` overlap ruling → seal batch
- `ActionValidator` consumption of `hasForbiddenTags` → reaction megaplan M4
- `capabilities` grant (Ngộ Đạo) → seal batch

## Open questions for coordinator

1. R-B3 — does the spec intend target-side ailment-application resist (`ailmentResistPercent` at application, not just duration)? Currently preserving duration-only behavior.
2. R-B7 — `convertsToId` re-application eligibility suppressed: confirm conversions never trigger reactions (today they CAN via legacy manager — the bridge keeps legacy firing, new engine sees suppressed).
3. `powerDomain:'buff'` `baseCoefficient` units — absolute damage per tick vs ratio of source stats? Assumed absolute; confirm at seal batch.
4. `marker{markerId}` for Thế Tu economy/proc payloads — preserves duck-typing but consolidates 4 effect kinds into one keyed shape; confirm no external code discriminates by `effect.type` string (census in M0 step 5 — if presentation reads `theEconomy` directly, keep the effect kind distinct).
