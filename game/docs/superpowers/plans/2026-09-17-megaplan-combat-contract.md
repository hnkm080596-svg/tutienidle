# Combat Systems Contract — Implementation Megaplan (Infrastructure Spine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

> **Review revision:** v3 — incorporates code review round 2 (at `eb8587d2`). Round-2 fixes: producer-minted `eventId` + scheduler-stamped `combatSequence` (exactly-once now implementable — the v2 sink-minted ids made duplicate detection impossible); `DeferredOperation` is a declarative primitive materialized via `BatchResultContext` (typed `CombatOperationResult`, not `CombatOperationResultBase`, not arbitrary closures); `ResolvedCombatOperation` drops top-level `sourceId` (origin is the single canonical source; `ApplyBuffOperation` payload omits sourceId/origin — composed at dispatch); `CombatExecutionRecord` gives ops a sequence home in the trace; `rootActionId` widened to root-resolution-transaction (action/status/script/proc roots); reaction damage channel exists but formula stays DamageProfile-owned (infra doesn't author gameplay mitigation rules); shield adapter routes through vitals authority (`EntityVitalsSystem` owns ward); `'failed'` status reserved-no-emitter in v1; nested batch frames allowed (`batchFrameStack`); M4 pins scheduler construction at `GameManagerTurnBattleOps` (option A, dormant) + fixes the Math.random exit criterion wording. v2 (at `eb8587d2`) incorporated round 1: per-op settlement barrier, `ImmediateSettlement`/`CombatOperationBatch`, no scheduler↔executor cycle, RNG at composition root, reaction damage off the DoT channel, discriminated selectors, structural-vs-combat result split, RNG-consumption parity, contracts/runtime split, `CombatSettlementFault`, no legacy buff adapter, intent-level damage authority, intra-action scheduler scope, typed periodic requests, richer result payloads.

**Goal:** Build the shared combat runtime spine — `core/battle/contracts/` (pure types: operations/results/events/origin/selectors) + `core/battle/runtime/` (implementations: `CombatRng` impls, `ElementalStateRegistry` factory, `StaticCapabilityQuery`, `CombatEventSink`), `CombatScheduler` (sole `combatSequence` allocator + per-operation settlement barrier + exactly-once event dispatch + reaction batch frames), `CombatOperationExecutor` (pure router, zero scheduler knowledge) and authority port interfaces — that Buff System Reimagined, SkillDefinition, and ReactionSystem all plug into.

**Architecture:** Contracts are type-only modules under `contracts/` (no runtime deps → no cycles, contract §83). Runtime implementations live under `runtime/`. Scheduler owns ordering + sequence + event drain + batch frames; executor routes `ResolvedCombatOperation` → authority port → typed result; authorities emit `PendingCombatEvent` into a scheduler-owned `CombatEventSink`. `CombatScheduler` is strictly an **intra-action operation scheduler** — `TurnPipeline` remains the turn-lifecycle authority. Composition root (`GameManagerTurnBattleOps`) constructs the scheduler + the cycle `CombatRng`, NOT `TurnBattleSystem`/`TurnBattleAdapter`.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.1 — THE source of truth; supersedes conflicting points in the other specs)
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.0 — first real authority consumer)
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (v1.1 — operation producer)
- `game/docs/specs/2026-09-17-reaction-system-reimagined-spec.md` (v1.0 — event consumer)

**Sibling-plan dependency:** This megaplan is the code-level expansion of the Combat Contract scope inside `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M1–M2). It is the FOUNDATION — buff/skill/reaction megaplans assume every name in the Canonical-names section exists exactly as spelled.

## Global Constraints

- **No gameplay content changes.** This plan adds infrastructure + reroutes the existing cycle RNG through `CombatRng`. Zero behavior change in combat outcomes; same rolls in same order.
- **No ấn / Hỏa authoring:** no `hoa_an`/`han_tuc`/`doc_can`/`liet_thuong`/`tran_an`, no Hỏa skills, no `elemental_reaction_enabled` grant — seal-batch scope. Test fixtures only.
- **Determinism (contract §87):** same seed + same commands → identical operation order, event order, sequence trace, final state.
- **No cycles (contract §83):** `contracts/` imports nothing from `core/buff`, `core/skill`, `core/reaction`, `core/battle/turn`. `runtime/` may import contracts + `core/element/ElementType` (type-only).
- **Executor is a pure router:** it never reads scheduler state, never queries result history, never picks "the closest existing method" on an authority — the port interface defines intent-level inputs; the authority resolves them.
- **No path-specific primitives (CON-23):** no `ApplyHoaAn`, `TriggerDungKim`, `ApplyCamCong`, `DoNguDaoReaction` — operation vocabulary is generic (§5).
- **P3 verification:** `quick` = `npm run type-check` + `npx vitest run <scope>`; `full` adds `npm run build` + `npx vitest run` — mandatory for M4 (touches `GameManagerTurnBattleOps` battle-lifecycle wiring).
- **P4** adversarial QA (quick) per mission; **P5** three-lens review per mission; **P7** commits need explicit authorization.
- **P13/P14:** M4 touches battle lifecycle — drive a real battle via Playwright (`npm run dev`, actual port) before merge-ready.
- **Per-mission report:** changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None expected) / risks / next.

## Canonical names (locked across ALL sibling plans — spell identically)

**Produced by this plan (everyone else imports, never redefines):**

```ts
// contracts/ids.ts — branded string aliases (type-level only)
type CombatEntityId = string
type BuffDefinitionId = string
type BuffInstanceId = string
type ReactionId = string
type SkillId = string
type CombatOperationId = string
type CombatEventId = string

// contracts/origin.ts (contract §10)
type CombatOperationOriginKind = 'skill' | 'reaction' | 'buff_periodic' | 'proc' | 'scripted'
interface CombatOperationOrigin {
  kind: CombatOperationOriginKind
  originId: string
  sourceId: CombatEntityId
  rootActionId: string
  parentOperationId?: CombatOperationId
  causationEventId?: CombatEventId
  castId?: string
  subcastIndex?: number
  reactionId?: ReactionId
}

// contracts/operations.ts — the discriminated union IS the runtime contract.
// `type` is inseparable from `payload` (review: no {type:'heal', payload:damagePayload}).
// NO top-level sourceId — origin.sourceId is the single canonical source (review r2 HIGH 3:
// op.sourceId / op.origin.sourceId / payload.sourceId would be three mutable copies).
type ResolvedCombatOperation = CombatOperation & {
  operationId: CombatOperationId
  origin: CombatOperationOrigin
}
// (CombatOperation members each carry their own `type` + `payload` — see M1.)

// contracts/selectors.ts — discriminated union; NO optional soup
type BuffInstanceSelector =
  | { kind: 'instance'; instanceId: BuffInstanceId }
  | { kind: 'identity'; definitionId: BuffDefinitionId; sourceId: CombatEntityId; targetId: CombatEntityId }
  | { kind: 'holder_definition'; holderId: CombatEntityId; definitionId: BuffDefinitionId }
  // 'holder_definition' resolves the holder's instance of a def regardless of source
  // (used by consume-for-damage 'any' scope and per_target instanceScope defs)

// contracts/results.ts — taxonomy LOCKED (contract §50–53, review r2):
//   'resolved'  = committed, typed payload attached
//   'skipped'   = normal runtime invalidation (dead target, stale state, insufficient
//                 resource) — typed reason required
//   'failed'    = RESERVED — kept in the union per spec §52 but NO v1 producer may
//                 emit it (review r2: no concrete semantic exists yet; an application
//                 roll failure is `resolved`+`result.applied:false`, not 'failed').
//                 A producer emitting 'failed' fails tests — add a semantic first.
//   STRUCTURAL  = missing port / unknown definition / malformed op → NEVER a result.
//                 Dev+test: throw. Broken engine wiring is not a combat outcome (§50).
interface CombatOperationResultBase {
  operationId: CombatOperationId
  status: 'resolved' | 'skipped' | 'failed'   // 'failed' reserved — see above
  reason?: CombatOperationResultReason
}
type CombatOperationResultReason =
  | 'stale_reaction_snapshot' | 'invalid_target_state' | 'application_roll_failed'
  | 'insufficient_resource' | 'blocked_by_restriction'
// NOTE: an ApplyBuffOperation whose application roll fails returns
// {status:'resolved', result:{applied:false}} — the op executed fine; the BUFF
// result is the authority on success (contract §17). insufficient_resource →
// 'skipped' (target state invalidation), not 'failed'.

// contracts/events.ts — event identity vs sequence are SEPARATE authorities
// (review r2 BLOCKER 1): the PRODUCER mints a deterministic eventId (stable per
// logical occurrence — e.g. `evt.${origin.operationId}.${kind}`) BEFORE enqueue;
// the scheduler stamps only `combatSequence`. Dedup key = producer eventId, so a
// double-delivered event shares ONE id and `seenEventIds` actually dedups.
// Typing: no index signature — pending events are the concrete union minus the
// scheduler-stamped field (review r2 HIGH 1).
type PendingCombatEvent =
  | Omit<ElementalApplicationCommitted, 'combatSequence'>
  | Omit<BuffApplicationFailedEvent, 'combatSequence'>
  | Omit<SettlementOverflowEvent, 'combatSequence'>
  | Omit<CombatSettlementFaultEvent, 'combatSequence'>
interface CombatEventBase { eventId: CombatEventId; combatSequence: number }
type CombatEvent =
  | ElementalApplicationCommitted
  | BuffApplicationFailedEvent
  | SettlementOverflowEvent
  | CombatSettlementFaultEvent
interface ElementalApplicationCommitted extends CombatEventBase {
  type: 'elemental_application_committed'
  instanceId: BuffInstanceId; sourceId: CombatEntityId; targetId: CombatEntityId
  definitionId: BuffDefinitionId; element: ElementType
  stacksBefore: number; stacksAfter: number
  requestedStacks: number; addedStacks: number
  reactionEligibility: ReactionEligibility
  origin: CombatOperationOrigin
}
interface SettlementOverflowEvent extends CombatEventBase {
  type: 'settlement_overflow'; depth: number; lastEventId?: CombatEventId
}
interface CombatSettlementFaultEvent extends CombatEventBase {
  type: 'combat_settlement_fault'; reason: 'settlement_depth_exceeded'; traceDigest: string
}

// contracts/rng.ts — INTERFACE only here; impls live in runtime/rng/
interface CombatRng {
  roll(): number                      // one consumption, always — no early-return shortcuts
  rollChance(chance: number): boolean // consumes exactly ONE roll even at chance<=0 / >=1
                                      // (legacy parity: `rng() < chance` always consumed —
                                      // skipping the roll at 0/1 shifts the whole stream)
}

// contracts/capability.ts
interface CombatCapabilityQuery { has(entityId: CombatEntityId, capabilityId: string): boolean }
const ELEMENTAL_REACTION_CAPABILITY = 'elemental_reaction_enabled' as const

// contracts/elemental.ts — interface only; factory in runtime/elemental/
interface ElementalStateRegistry {
  getDefinitionId(element: ElementType): BuffDefinitionId
  getElement(definitionId: BuffDefinitionId): ElementType | null
}

// contracts/settlement.ts — what an immediate-event handler may return
type ImmediateSettlement =
  | { kind: 'operations'; operations: readonly ResolvedCombatOperation[] }
  | { kind: 'batch'; batch: CombatOperationBatch }
interface CombatOperationBatch {
  batchId: string
  origin: CombatOperationOrigin
  /** ALL preflighted before ANY op runs (contract §40–42). */
  preconditions: readonly CombatPrecondition[]
  /** Ordered, non-interleaved; per-op settle inside the frame (contract §43–44). */
  operations: readonly (ResolvedCombatOperation | DeferredOperation)[]
}
type CombatPrecondition =
  | { kind: 'buff_participant'; instanceId: BuffInstanceId; expectedSourceId: CombatEntityId; expectedTargetId: CombatEntityId; expectedStacks: number }
  | { kind: 'entity_alive'; entityId: CombatEntityId }
/** Review r2 BLOCKER 2 — declarative primitive, NOT an arbitrary closure.
    A closure could capture mutable combat state; a data primitive is
    materialized by the batch runner from the typed result store. Extensible —
    add members when a real consumer needs one (YAGNI). */
type DeferredOperation =
  | {
      kind: 'heal_from_damage_result'
      /** The prior in-batch damage op whose result this heal derives from. */
      resultOperationId: CombatOperationId
      targetId: CombatEntityId
      fraction: number
      capFractionOfTargetMaxHp?: number
      healTarget: 'source' | 'target'
      origin: CombatOperationOrigin
    }
/** Typed read-only access to prior in-batch results — the runner materializes
    DeferredOperations against THIS, never a raw array and never scheduler state. */
interface BatchResultContext {
  get(operationId: CombatOperationId): CombatOperationResult | undefined
}

// contracts/sink.ts — authorities call this; the scheduler-backed impl forwards
// to scheduler.enqueueEvent (stamps combatSequence, dedups by producer eventId)
interface CombatEventSink { emit(event: PendingCombatEvent): void }

// contracts/trace.ts — review r2 HIGH 2: op sequence lives on the RECORD, not the op
interface CombatExecutionRecord {
  combatSequence: number                  // stamped at execute time — sole allocator: scheduler
  operation: ResolvedCombatOperation
  result: CombatOperationResult
}
// NOTE: PendingCombatEvent is intentionally an OPEN union — sibling plans
// (reaction: ReactionResolvedEvent/ReactionSkippedEvent; buff: BuffApplied/
// BuffStacksChanged/...) register their pending shapes here as they land.

// scheduler/ (implementation lives in runtime/scheduler/)
class CombatScheduler {
  constructor(executor: CombatOperationExecutor, opts?: { maxImmediateDepth?: number })
  enqueueAuthored(ops: readonly ResolvedCombatOperation[]): void     // authored intent — barrier after EACH
  /** Asserts producer-minted operationIds are unique (R-C2 condition). */
  assertUniqueOperationIds(ops: readonly ResolvedCombatOperation[]): void
  registerImmediateHandler(type: string, handler: (event: CombatEvent) => ImmediateSettlement | void): void
  /** Producer already minted eventId; scheduler stamps combatSequence and dedups
      on eventId (CON-19). Duplicate delivery of the same eventId → stamped once. */
  enqueueEvent(pending: PendingCombatEvent): void
  run(): CombatTrace                                                  // drains authored + immediate until quiescent
  // NO public allocateSequence() — sequence is allocated internally at stamp/commit time
}
class CombatOperationExecutor {
  constructor(ports: CombatAuthorityPorts)                            // NO scheduler param — pure router
  /** Returns the FULL discriminated result — batch runners + traces need
      op-specific payloads (damage.hpDamage), not just the base (review r2). */
  execute(op: ResolvedCombatOperation, sink: CombatEventSink): CombatOperationResult
}
interface CombatAuthorityPorts {
  buffs?: BuffAuthority; damage?: DamageAuthority; gauge?: GaugeAuthority
  resource?: ResourceAuthority; shield?: ShieldAuthority; heal?: HealAuthority
}
class CombatTrace {
  records: readonly CombatExecutionRecord[]    // ops carry sequence HERE, not on the op
  recordExecution(record: CombatExecutionRecord): void
  recordEvent(event: CombatEvent): void        // events carry their own stamped sequence
  toString(): string                           // §85 tree format
}
class CombatSettlementFault extends Error { /* fatal battle state — see M5 */ }
const MAX_IMMEDIATE_SETTLEMENT_DEPTH = 64  // dev/test guard
```

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R-C1 | Contract layer location: `game/src/core/battle/contracts/` (types) + `game/src/core/battle/runtime/` (impls). | Review: "type-only contracts" wording was self-contradictory once RNG/registry factories landed — split makes the dependency constitution honest. |
| R-C2 | `operationId` minting: producer mints deterministic ids; scheduler ASSERTS uniqueness on enqueue (duplicate → structural fault throw). `rootActionId` = id of the ROOT combat resolution transaction — NOT restricted to skill casts (review r2 HIGH 4): `action.turn.N.*` for declared actions, `status.turn.N.*` for buff/status phase ticks, `script.*` for scripted beats, `proc.*` for proc-driven roots. Owner = whatever entry point drives the resolution (TurnBattleSystem declare, status phase, scripted runner). | §13 requires uniqueness; assertion enforces it. Non-action roots exist today (buff ticks run before the action's declare phase) — narrowing the owner to casts would force sibling plans to invent ids off-contract. |
| R-C3 | `CombatScheduler` per battle, constructed by `GameManagerTurnBattleOps` (the composition root) alongside `mintCycleRng`; handed INTO `TurnBattleSystem` as a ctor dep. | Review: per-battle scope approved, but construction belongs at lifecycle root — same place the cycle RNG already lives. |
| R-C4 | `EventBus` NOT reused for combat immediate events — scheduler owns its ordered queue (settlement ordering + exactly-once + quiescence exceed EventBus emit-snapshot semantics). | Approved in review. |
| R9-revised | Settlement-depth overflow → `CombatSettlementFault`: dev/test throw; production stops battle progression + emits `CombatSettlementFaultEvent` + trace dump. NEVER retroactively marks the committed originating op failed — its result already committed (contract §48). | Review rejected retro-fail: committed state can't be un-resolved. |
| R-C5 | `CombatScheduler` is strictly intra-action: it may NOT advance `CombatClock`, own `TurnToken`, decide turn end, drive presentation, or run boundary commands — `TurnPipeline` keeps all of that. | TurnPipeline already owns turn lifecycle; a second scheduler there = two authorities. |
| R-C6 | The cycle `CombatRng` is minted ONCE per battle cycle at `mintCycleRng` (`GameManagerTurnBattleOps.ts:835`) and shared with every consumer (CombatSystem via `setRandomSource`, TurnBattleSystem ctor, spawn placement, pool picks) — exactly the current `() => number` distribution, just typed. | Review: one battle = one random stream; adapter-level minting would split it. |
| R-C7 | `HealOperation.amount` is always concrete by executor time. Result-referencing heals (`heal_from_damage`) are emitted as `DeferredOperation` inside a `CombatOperationBatch` — the batch runner materializes them from prior in-batch results. Executor never resolves refs. | Review: executor must not read scheduler/result state; deferred-materialization keeps it a pure router. |

---

## Mission 0 — Inventory + seam verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-combat-contract-inventory.md`

- [ ] **Step 1 — Lock baseline:** `git rev-parse HEAD`.
- [ ] **Step 2 — Battle RNG graph census (NOT just call sites):** the cycle RNG is minted at `GameManagerTurnBattleOps.mintCycleRng()` (`:835`, gated by `isStageStarting` — stage launches pre-mint in `startStage`) and distributed to: `combatSystem.setRandomSource` (`:837`), `TurnBattleSystem` ctor (`:263`/`:993`), spawn placement + enemy pool/tag/hidden-beast closures, path-runtime rolls, stage-wave launch. Enumerate EVERY consumer + its `() => number` signature so the `CombatRng` adapter covers all of them with identical consumption order. Also census `Math.random` in `core/battle/turn/**`, `core/buff/**` for stray rolls bypassing the cycle RNG.
- [ ] **Step 3 — TurnPipeline boundary (BLOCKING design constraint):** read `TurnPipeline.ts` — document it as the turn-lifecycle authority (turn in-flight state, reaction-step depth, `beginTurnPipeline` entry points at `:477`/`:565`/`:1505`/`:1541`). Write into the inventory + M2 notes: `CombatScheduler` NEVER owns turn lifecycle — it orders domain mutations INSIDE one action's resolution. Name the overlap risk explicitly so implementers don't build a second turn scheduler.
- [ ] **Step 4 — Damage authority seam:** `CombatSystem` public surface — `applyDirectDamage` (`:147`), `applyModifiedDirectDamage` (`:163`, HIT-layer modifiers), `applyHealing` (`:168`), `applyDotDamage` (`:547`, DOT economy: `dotResistancePercent` only, `dotRecovery` triggers, reason `'dot'`, NO hit-layer modifiers — **reaction damage MUST NOT route here**), `VitalsChangeReason` incl. `'reaction'` (`EntityVitalsSystem.ts:5`). Record the intent parameters `DealDamageOperation.payload` needs so the DamageSystem adapter can pick the channel ITSELF (profile/origin/crit/miss/element) — executor never picks a method.
- [ ] **Step 5 — Gauge authority seam:** `ActionGauge.ts` — `GAUGE_MAX=1000`, `advanceGauge`, `isGaugeReady`, `consumeGaugeAfterAction`, `refundGauge` (positive-only). `PushGaugeOperation` needs signed `applyGaugeDelta` — additive API on the adapter (clamps 0..MAX both directions).
- [ ] **Step 6 — Buff authority seam (current engine — READ ONLY, no adapter):** `new BuffSystem(actor.buffs)` sites (`:1110`, `:1824`), `applySkillAilments` (`:2939–2984`). Record ONLY for the inventory — **no `CurrentBuffAuthorityAdapter` is built** (review: don't write adapters for the architecture being deleted; buff2 is the first real `BuffAuthority`).
- [ ] **Step 7 — Sequence/id conventions:** `rootActionId` minted at `declareActorAction` (`:894`) per declared action; `castId`/`subcastIndex` minted by the skill plan's resolver/executor. `CombatEntity.id: string`.
- [ ] **Step 8 — Write authority matrix** (type → producing file → consuming files) + R-C1..R-C7/R9-revised table for sign-off.

**Exit criteria:** baseline SHA; full RNG graph + TurnPipeline boundary documented; damage/gauge adapter signatures agreed in writing; all rulings recorded.

---

## Mission 1 — Contract types (pure) + runtime impls (rng/registry/capability)

**Files:**
- Create: `game/src/core/battle/contracts/ids.ts`, `origin.ts`, `selectors.ts`, `operations.ts`, `results.ts`, `events.ts`, `rng.ts`, `capability.ts`, `elemental.ts`, `settlement.ts`, `sink.ts`, `periodic.ts`
- Create: `game/src/core/battle/runtime/rng/SeededCombatRng.ts`, `FunctionCombatRng.ts`, `ScriptedCombatRng.ts`
- Create: `game/src/core/battle/runtime/capability/StaticCapabilityQuery.ts`
- Create: `game/src/core/battle/runtime/elemental/ElementalStateRegistryImpl.ts` (`createElementalStateRegistry` factory — validates all-5-mapped + distinct ids)
- Test: `game/src/core/battle/runtime/rng/rng.test.ts`, `game/src/core/battle/contracts/operations.test.ts`, `elemental.test.ts`

**Operation union (contract §5) — discriminated, `type` owns `payload`:**

```ts
export type CombatOperation =
  | DealDamageOperation | HealOperation
  | ApplyBuffOperation
  | AddBuffStacksOperation | RemoveBuffStacksOperation | ConsumeBuffStacksOperation
  | AddBuffModifierOperation | RemoveBuffModifierOperation
  | RefreshBuffDurationOperation | ExtendBuffDurationOperation
  | TriggerBuffPeriodicOperation | RemoveBuffOperation
  | PushGaugeOperation
  | GainResourceOperation | ConsumeResourceOperation
  | ApplyShieldOperation

// Each member is self-contained: `type` discriminates, `payload` is typed per member.
// ResolvedCombatOperation = CombatOperation & {operationId, sourceId, origin} — the
// intersection means `type:'heal'` can NEVER carry a damage payload.

export interface DealDamageOperation {
  type: 'deal_damage'
  payload: {
    targetId: CombatEntityId
    element?: ElementType | 'physical'
    /** Intent-level profile — DamageSystem resolves formula/mitigation/crit channel
        from profile+origin, never the executor. */
    damageProfile: string
    /** Authored coefficient — NOT final damage. DamageSystem still applies
        stats/scaling/profile/mitigation/crit. */
    coefficient: number
    hitCount: number
    canCrit: boolean
    canMiss: boolean
    periodicId?: string
    tags?: readonly string[]
  }
}
export interface HealOperation {
  type: 'heal'
  payload: { targetId: CombatEntityId; amount: number }   // always concrete (R-C7)
}
// Review r2 HIGH 3 — payload omits sourceId/origin: BOTH come from the op's
// origin envelope (single canonical source). The executor composes the full
// ApplyBuffRequest at dispatch: { ...payload, sourceId: op.origin.sourceId, origin: op.origin }.
// ApplyBuffRequest (the authority port input) keeps its §15 shape unchanged.
export type ApplyBuffRequestPayload = Omit<ApplyBuffRequest, 'sourceId' | 'origin'>
export interface ApplyBuffOperation { type: 'apply_buff'; payload: ApplyBuffRequestPayload }
export interface AddBuffStacksOperation    { type: 'add_buff_stacks';    payload: { selector: BuffInstanceSelector; stacks: number } }
export interface RemoveBuffStacksOperation { type: 'remove_buff_stacks'; payload: { selector: BuffInstanceSelector; stacks: number } }
export interface ConsumeBuffStacksOperation {
  type: 'consume_buff_stacks'
  payload: { selector: BuffInstanceSelector; stacks: number | 'all'; removalReason: 'consumed' | 'reaction' }
}
export interface AddBuffModifierOperation { type: 'add_buff_modifier'; payload: { selector: BuffInstanceSelector; modifier: BuffModifierPayload } }
export interface RemoveBuffModifierOperation { type: 'remove_buff_modifier'; payload: { selector: BuffInstanceSelector; modifierId: string } }
export interface RefreshBuffDurationOperation { type: 'refresh_buff_duration'; payload: { selector: BuffInstanceSelector; duration?: number } }
export interface ExtendBuffDurationOperation  { type: 'extend_buff_duration';  payload: { selector: BuffInstanceSelector; turns: number; maxRemaining?: number } }
export interface TriggerBuffPeriodicOperation { type: 'trigger_buff_periodic'; payload: { selector: BuffInstanceSelector; periodicId?: string } }
export interface RemoveBuffOperation          { type: 'remove_buff';           payload: { selector: BuffInstanceSelector; removalReason: BuffRemovalReason } }
export type BuffRemovalReason =
  | 'expired' | 'consumed' | 'cleansed' | 'reaction' | 'death' | 'source_death' | 'battle_end' | 'replaced' | 'scripted'
export interface PushGaugeOperation    { type: 'push_gauge';    payload: { targetId: CombatEntityId; fractionOfMax: number } }
export interface GainResourceOperation    { type: 'gain_resource';    payload: { targetId: CombatEntityId; resourceId: string; amount: number } }
export interface ConsumeResourceOperation { type: 'consume_resource'; payload: { targetId: CombatEntityId; resourceId: string; amount: number | 'all'; valueSource?: 'current' | 'cast_snapshot' } }
export interface ApplyShieldOperation  { type: 'apply_shield'; payload: { targetId: CombatEntityId; amount: number } }
```

**Result union — richer than `{status}` (review: trace must reconstruct mutations):**

```ts
export type CombatOperationResult =
  | { operationId; type: 'deal_damage'; status; reason?; damage?: { rawDamage: number; hpDamage: number; killed: boolean } }
  | { operationId; type: 'heal'; status; reason?; result?: HealResult }                // {requested, healed, after?}
  | { operationId; type: 'apply_buff'; status; reason?; result?: ApplyBuffResult }
  | { operationId; type: 'add_buff_stacks' | 'remove_buff_stacks'; status; reason?; result?: StacksResult }  // {stacksBefore, stacksAfter}
  | { operationId; type: 'consume_buff_stacks'; status; reason?; result?: ConsumeStacksResult }
  | { operationId; type: 'add_buff_modifier' | 'remove_buff_modifier'; status; reason?; result?: { modifierId: string; applied: boolean } }
  | { operationId; type: 'refresh_buff_duration' | 'extend_buff_duration'; status; reason?; result?: { durationBefore: number; durationAfter: number } }
  | { operationId; type: 'trigger_buff_periodic'; status; reason?; result?: { resolutionsEmitted: number } }
  | { operationId; type: 'remove_buff'; status; reason? }
  | { operationId; type: 'push_gauge'; status; reason?; result?: { before: number; requestedDelta: number; appliedDelta: number; after: number } }
  | { operationId; type: 'gain_resource' | 'consume_resource'; status; reason?; result?: { before: number; requested: number | 'all'; applied: number; after: number } }
  | { operationId; type: 'apply_shield'; status; reason?; result?: { applied: number; shieldAfter: number } }
```

`ApplyBuffResult`/`ConsumeStacksResult`/`BuffModifierPayload` shapes are pinned here so `results.ts` compiles; buff megaplan implements them verbatim.

- [ ] **Step 1 — Failing tests (`rng.test.ts`):**
  - `SeededCombatRng` same seed → identical 1000-roll sequence; different seed → different.
  - **`rollChance` consumes exactly one roll regardless of chance** — `rollChance(0)` then `roll()` vs `rollChance(1)` then `roll()` both consume identically (sequence parity test: interleave `rollChance(0)`/`rollChance(1)`/raw `roll()` calls and assert the roll stream is indistinguishable from pure `roll()` calls). This is THE regression guard for "skip the roll at 0/1" optimizations.
  - `rollChance` boundary: `rng() < chance` semantics — roll exactly at `chance` fails.
  - `ScriptedCombatRng` yields queued rolls in order, throws on exhaustion.
  - `FunctionCombatRng` wraps `() => number` lazily (`vi.spyOn(Math,'random')` still intercepts).
- [ ] **Step 2 — Failing tests (`operations.test.ts`):** union discrimination; selector union rejects `{}`/partial identity at compile level (type test via `ts-expect-error` assertions where feasible) + runtime guard function `assertValidSelector` for untrusted input; origin carries `rootActionId`/`causationEventId`/`parentOperationId`.
- [ ] **Step 3 — Failing tests (`elemental.test.ts`):** factory throws on missing element / duplicate buff id / extra key; `getElement` round-trips.
- [ ] **Step 4 — Implement.** `SeededCombatRng` = mulberry32; document the algorithm.
- [ ] **Step 5 — Verify (P3 quick).**

**Exit criteria:** contracts compile standalone; zero non-type imports into `contracts/`; RNG determinism + consumption parity proven.

---

## Mission 2 — CombatScheduler + CombatOperationExecutor + batch frames

**Files:**
- Create: `game/src/core/battle/runtime/scheduler/CombatAuthorityPorts.ts`
- Create: `game/src/core/battle/runtime/scheduler/CombatOperationExecutor.ts`
- Create: `game/src/core/battle/runtime/scheduler/CombatEventSink.ts` (queue impl + stamping)
- Create: `game/src/core/battle/runtime/scheduler/CombatScheduler.ts`
- Create: `game/src/core/battle/runtime/scheduler/CombatOperationBatchRunner.ts` — preflight + per-op settle inside the frame
- Create: `game/src/core/battle/runtime/scheduler/CombatTrace.ts`
- Test: `CombatScheduler.test.ts`, `CombatOperationExecutor.test.ts`, `CombatBatchRunner.test.ts`

**Interfaces — Produces:**

```ts
// CombatAuthorityPorts.ts — intent-level inputs; the AUTHORITY resolves formulas.
export interface BuffAuthority {
  apply(req: ApplyBuffRequest): ApplyBuffResult
  addStacks(sel: BuffInstanceSelector, stacks: number): StacksResult
  removeStacks(sel: BuffInstanceSelector, stacks: number): StacksResult
  consumeStacks(sel: BuffInstanceSelector, stacks: number | 'all', reason: 'consumed' | 'reaction'): ConsumeStacksResult
  addModifier(sel: BuffInstanceSelector, mod: BuffModifierPayload): { applied: boolean }
  removeModifier(sel: BuffInstanceSelector, modifierId: string): { removed: boolean }
  refreshDuration(sel: BuffInstanceSelector, duration?: number): { durationBefore: number; durationAfter: number }
  extendDuration(sel: BuffInstanceSelector, turns: number, maxRemaining?: number): { durationBefore: number; durationAfter: number }
  triggerPeriodic(sel: BuffInstanceSelector, periodicId?: string): readonly PeriodicResolution[]   // typed requests — review: never `unknown[]`
  remove(sel: BuffInstanceSelector, reason: BuffRemovalReason): void
}
// contracts/periodic.ts — typed periodic requests (review fix: the cross-authority
// port returns real types, not `unknown[]`). Buff2 produces them; the scheduler
// converts each request into a ResolvedCombatOperation (deal_damage/heal with
// origin.kind 'buff_periodic') and settles them like any other op.
export interface BuffPeriodicDamageRequest {
  instanceId: BuffInstanceId; periodicId: string
  sourceId: CombatEntityId; targetId: CombatEntityId
  element?: ElementType | 'physical'
  rawPower: number
  originKind: 'buff_periodic'
  tags?: readonly string[]
}
export interface BuffPeriodicHealRequest {
  instanceId: BuffInstanceId; periodicId: string
  sourceId: CombatEntityId; targetId: CombatEntityId
  amount: number
  originKind: 'buff_periodic'
}
export interface PeriodicResolution {
  requests: readonly (BuffPeriodicDamageRequest | BuffPeriodicHealRequest)[]
}
export interface DamageAuthority {
  /** Intent in, result out. DamageSystem picks the internal channel from
      damageProfile + origin.kind + canCrit/canMiss — NOT the executor and NOT
      a "closest existing method" guess. */
  dealDamage(op: DealDamageOperation['payload'], origin: CombatOperationOrigin): { rawDamage: number; hpDamage: number; killed: boolean }
}
export interface GaugeAuthority   { pushGauge(targetId: CombatEntityId, fractionOfMax: number): { before: number; requestedDelta: number; appliedDelta: number; after: number } }
export interface ResourceAuthority {
  gain(targetId, resourceId, amount): { before: number; requested: number; applied: number; after: number }
  consume(targetId, resourceId, amount | 'all'): { before: number; requested: number | 'all'; applied: number; after: number }
}
export interface ShieldAuthority  { applyShield(targetId, amount): { applied: number; shieldAfter: number } }
export interface HealAuthority    { heal(targetId, amount, origin): { requested: number; healed: number; after: number } }

// CombatOperationBatchRunner.ts — contract §40–51
export class CombatOperationBatchRunner {
  constructor(
    private readonly preconditions: PreconditionChecker,   // narrow read ports (buff instance lookup, alive check)
  )
  /** Preflight ALL preconditions before any op runs (§40–42 atomic stale-skip). */
  preflight(batch: CombatOperationBatch): boolean
  /** Review r2 BLOCKER 2 — NOT operationsOf(). Deferred entries CANNOT be resolved
      upfront; the runner materializes each at its position via BatchResultContext
      built from prior in-batch CombatOperationResults. The scheduler drives:
        for entry of batch.operations:
          op = entry.kind==='deferred' ? materialize(entry, resultsCtx) : entry
          result = executor.execute(op, sink)
          resultsCtx.record(op.operationId, result)
          settle immediate consequences before next entry (§43+§55)
    */
  materialize(deferred: DeferredOperation, results: BatchResultContext): ResolvedCombatOperation
}
```

**Scheduler semantics — CORRECTED (contract §55–56 + review):**

```
Scheduler state:
  authoredQueue: ResolvedCombatOperation[]      // authored intent — barrier after EACH op
  immediateQueue: StampedCombatEvent[]          // post-commit domain events
  seenEventIds: Set<CombatEventId>
  pendingImmediateOps: ResolvedCombatOperation[] // generated BY immediate settlement

run():
  while authoredQueue or pendingImmediateOps or immediateQueue non-empty:
    // ONE unit of work at a time; immediate settlement always drains before
    // the next AUTHORED op. Immediate-generated ops settle within the same
    // barrier (they are consequences, not authored intent).
    if immediateQueue non-empty:
      drainImmediateOnce()                      // one event → handler → settlement
      continue
    if pendingImmediateOps non-empty:
      op = shift → execute → events go to immediateQueue
      continue
    // both empty → take ONE authored op, execute, then loop back to drain
    // whatever it produced before the NEXT authored op runs.
    op = authoredQueue.shift()
    executor.execute(op, sink)
  // quiescent = all three empty

drainImmediateOnce():
  event = immediateQueue.shift()
  if seenEventIds.has(event.eventId) → skip (CON-19 exactly-once)
  seenEventIds.add(event.eventId)
  handler(event) → ImmediateSettlement:
    {kind:'operations'} → push to pendingImmediateOps (in order)
    {kind:'batch'}      → CombatOperationBatchRunner:
        preflight ALL preconditions (§40–42):
          any fail → emit ReactionSkippedEvent-equivalent; zero ops (atomic stale-skip)
        else:
          push batchFrameStack — batch ops run ordered, non-interleaved;
          after EACH batch op, immediate consequences settle before the next
          batch op (satisfies §43 batch non-interleave AND §55 per-op settle);
          external authored ops CANNOT interleave (frame holds authoredQueue);
          nested batches ARE allowed — an immediate event from a batch op may
          return another {kind:'batch'}; it runs to completion inside the parent
          frame before the parent's next op (batchFrameStack tracks nesting)
        DeferredOperation entries materialize at their position via
          materialize(entry, resultsCtx) — BatchResultContext reads the full
          discriminated CombatOperationResult union, never scheduler state (R-C7)
        pop batchFrameStack
  depth++ per settlement nesting (not just event-drain cycles — a nested batch
  counts); > maxImmediateDepth → CombatSettlementFault (R9-revised)

enqueueEvent(pending): pending.eventId (producer-minted) → dedup check → stamp {combatSequence: allocateSeq()} → enqueue
```

Key invariant (review fix): `pendingImmediateOps` and `immediateQueue` are checked BEFORE `authoredQueue` — so an authored op's consequences always settle before the next authored op. A batch's ops go through the same per-op settle inside the frame.

- [ ] **Step 1 — Failing tests (executor):** each op type → its port once, payload+origin intact; **missing port → throw (structural fault), NOT a typed `failed` result** (contract §50 — broken wiring is not a combat outcome); result payloads populated (`push_gauge` returns before/after).
- [ ] **Step 2 — Failing tests (scheduler — the corrected semantics):**
  - `authored A → emits event → handler returns ops X,Y → X,Y complete BEFORE authored B runs` (THE regression guard for the review blocker — old pseudocode ran B first).
  - chained immediate consequences (op → event → op → event) fully drain before next authored op.
  - exactly-once: duplicate `eventId` → handler fires once.
  - sequence ownership: events stamped by scheduler (authorities emit pending events with no envelope); ops' `combatSequence` allocation point locked (stamp at execute-time — record choice in doc).
  - batch frame: preflight fail → zero ops + skip event; preflight pass → ops run in order, per-op settle, authored ops can't interleave mid-batch.
  - deferred op: `DeferredOperation` materializes using prior in-batch results (fake damage result → heal amount derived).
  - depth guard → `CombatSettlementFault`.
- [ ] **Step 3 — Implement.**
- [ ] **Step 4 — Verify (P3 quick).**

**Exit criteria:** §55–59 + batch semantics proven with stub authorities; executor has zero scheduler knowledge; per-op settlement barrier is the tested invariant.

---

## Mission 3 — Current-engine authority adapters (damage/gauge/resource/shield only)

Real adapters so every port has a real consumer — EXCEPT buffs (buff2 lands as the first `BuffAuthority`; no transitional adapter for the doomed shape).

**Files:**
- Create: `game/src/core/battle/runtime/scheduler/adapters/CombatSystemDamageAdapter.ts`
- Create: `game/src/core/battle/runtime/scheduler/adapters/CombatSystemHealAdapter.ts`
- Create: `game/src/core/battle/runtime/scheduler/adapters/ActionGaugeAdapter.ts` — `applyGaugeDelta` (signed; clamps 0..`GAUGE_MAX`)
- Create: `game/src/core/battle/runtime/scheduler/adapters/EntityResourceAdapter.ts` — `currentThe` only (direct mutation matches existing practice); `mp`/`ward` deferred pending M0 census — `EntityVitalsSystem` owns ward mutation (spendWard clamps+emits at `EntityVitalsSystem.ts:75`)
- Create: `game/src/core/battle/runtime/scheduler/adapters/VitalsShieldAdapter.ts` — routes `apply_shield` through a vitals-level ward grant (`CombatSystem`/`EntityVitalsSystem` method — add `applyWard`/`grantWard` if absent; NEVER `entity.currentWard += x` — review r2 HIGH 6)
- Test: `adapters/*.test.ts`

**Damage adapter rule (review blocker):** `dealDamage(payload, origin)` dispatches on `damageProfile` + `origin.kind`:
- `origin.kind === 'buff_periodic'` → DoT channel (`applyDotDamage` — dotResistance/dotRecovery economy).
- `origin.kind === 'reaction'` → **reaction channel**: a new explicit path (e.g. `applyReactionDamage` or profile-routed) — NEVER `applyDotDamage` (that would consume `dotResistancePercent`, fire `dotRecovery`, and report reason `'dot'`). **The infrastructure layer does NOT pin the formula** (review r2 HIGH 5): which mitigation/resistance/final-damage layers apply is a `damageProfile` decision owned by DamageSystem/gameplay — the contract only guarantees the channel is distinct from DoT and honors `canCrit:false`.
- `origin.kind === 'skill'|'proc'` → hit channel (`applyModifiedDirectDamage` semantics).
The adapter is allowed to ADD a `CombatSystem` method for the reaction channel if none exists — record as a contract extension in the mission report.

- [ ] **Step 1 — Failing tests:** `{origin.kind:'reaction', canCrit:false}` → reaction channel (assert it does NOT consume `dotResistancePercent` / does NOT trigger `dotRecovery` / reports `reason:'reaction'`); gauge adapter signed-clamps negative pushback at 0 and caps at `GAUGE_MAX`; resource `consume('all')` reports `{before, requested:'all', applied, after}`.
- [ ] **Step 2 — Implement.**
- [ ] **Step 3 — Verify (P3 quick).**

**Exit criteria:** every port has ≥1 real adapter (buffs excepted by design); damage adapter proves the three origins land on three distinct channels.

---

## Mission 4 — Wire `CombatRng` at the composition root

**Files:**
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts` — `mintCycleRng()` (`:835`) mints a `CombatRng` (default `FunctionCombatRng` over the existing lazy `() => Math.random()`; `setBattleRngFactory` override path preserved — tests can inject `SeededCombatRng`); distribute to every consumer that currently receives the raw closure (`combatSystem.setRandomSource(() => rng.roll())`, `TurnBattleSystem` ctor, spawn closures)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — ctor param typed `CombatRng`; roll sites (`:1033`,`:1314`,`:2121`,`:2253`,`:2407`,`:2955` — re-verify) call `rng.roll()`/`rollChance()` — **identical consumption order**
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts` — **ALSO constructs the scheduler** (review r2 MEDIUM — option A chosen): `mintCycleRng` sibling — `new CombatOperationExecutor(ports)` + `new CombatScheduler(executor)` per battle, injected into `TurnBattleSystem` as ctor deps. Scheduler is CONSTRUCTED but dormant — no authored ops route through it until the buff/skill cutover lands. Ports wired: damage/gauge/resource/shield adapters; `buffs` port stays `undefined` until buff2.
- Test: `game/src/core/battle/turn/TurnBattleSystem.rngContract.test.ts` — seeded battle reproducibility end-to-end

- [ ] **Step 1 — Failing test (seeded determinism):** two battles, same build + `SeededCombatRng(42)` via `setBattleRngFactory` + same actions → identical outcomes. Proves the ONE-stream property is preserved.
- [ ] **Step 2 — Reroute** — no second RNG authority anywhere; `TurnBattleAdapter` mints NOTHING (review: it must not create a parallel stream).
- [ ] **Step 3 — Verify (P3 FULL)** + **P13/P14** Playwright real battle.
- [ ] **Step 4 — P4 quick + P5 round.**

**Exit criteria:** one `CombatRng` per cycle at the composition root; zero direct/unwrapped `Math.random` calls in the battle RNG graph outside the `FunctionCombatRng`/factory boundary (the lazy `() => Math.random()` inside it is the sanctioned spy seam — review r2 MEDIUM); scheduler+executor constructed and injected but dormant; suite green.

---

## Mission 5 — Hardening: settlement fault + trace + DoD sweep

**Files:**
- Create: `game/src/core/battle/runtime/scheduler/CombatSettlementFault.ts` + `CombatTraceExporter.ts` (§85 tree dump, dev only)
- Modify: `game/docs/systems/combat-overview.md`, `roadmap.md`
- Test: `CombatScheduler.test.ts` extension — fault emits `CombatSettlementFaultEvent` + halts, never retro-fails committed ops

- [ ] **Step 1 — Fault semantics test:** committed op → event chain overflows → fault thrown/emitted; the committed op's result stays `resolved` (R9-revised — the review's exact objection handled).
- [ ] **Step 2 — Contract DoD sweep:** spec §104 row-by-row → named test or "owned by sibling plan."
- [ ] **Step 3 — Docs + verify (P3 quick).**

**Exit criteria:** infra DoD rows accounted; trace reconstructs causation; sibling plans' "consumes" satisfied.

---

## Spec coverage map (§ → mission)

| Contract § | Content | Mission |
|---|---|---|
| §3–5, §14–15 | authored vs runtime ops, union, eligibility, ApplyBuffRequest | M1 |
| §10–13 | origin, causal chain, combatSequence, op ids | M1 + M2 (stamp rules) |
| §17–21, §52–54 | results, failed application, event payload/timing | M1 + M3 |
| §24 | capability query | M1 |
| §36–49 | snapshot, preconditions, batch, no-rollback | M2 batch runner; reaction plan consumes |
| §55–59 | settlement, quiescence, depth guard, exactly-once, causation | M2 (corrected semantics) |
| §60–62 | sequential multicast, death handoff | skill plan consumes |
| §66–69 | damage origins distinct | M3 damage adapter (three channels) |
| §70–72 | gauge contract, Cấm Công | M3 gauge adapter; validator in reaction plan |
| §83–84 | dependency direction, contract layer | M1 split (contracts/ vs runtime/) |
| §85–88 | trace, no hidden mutation, determinism, RNG | M2/M4/M5 |
| §91–102 | contract tests | infra rows M5; cross-system rows in siblings |

## Deferred / owned by sibling plans

- `BuffAuthority` real impl, `ApplyBuffResult` production, `ElementalApplicationCommitted` emission → **buff megaplan**
- `SkillResolver`/`ResolvedSkillPlan`/executor emission → **skill megaplan**
- `ReactionSystem`/`ReactionBatchRunner` (consumes `CombatOperationBatch`/`DeferredOperation` for `heal_from_damage`)/`ElementalStateRegistry` binding → **reaction megaplan**
- All ấn definitions + capability grant + legacy reaction retirement → **seal batch**

## Open questions for coordinator

1. RESOLVED (review r2): `combatSequence` stamped by scheduler at `enqueueEvent` (events) / execute time (ops — lives on `CombatExecutionRecord` in the trace, NOT on the op). Every executed op + every stamped event gets one; enqueued-but-never-executed ops get none.
2. `PreconditionChecker` port scope — currently `buff_participant` + `entity_alive`; add `resource_at_least`/`stacks_at_least` now or when a consumer needs it (YAGNI lean: add when needed)?
3. RESOLVED (review r2): explicit reaction damage channel accepted (e.g. `applyReactionDamage`), but the infrastructure plan does NOT pin mitigation/resistance rules — `damageProfile` owns the formula.
