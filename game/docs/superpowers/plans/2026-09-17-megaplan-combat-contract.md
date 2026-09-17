# Combat Systems Contract — Implementation Megaplan (Infrastructure Spine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

> **Review revision:** v2 — incorporates the code review at commit `3035031c`. Changes: settlement-barrier pseudocode rewritten (per-op drain, not drain-after-queue); `OperationBatch`/`ImmediateSettlement` primitives added (reaction batch is a first-class scheduler concept); circular `Scheduler↔Executor` constructor removed (executor is a pure router; authorities emit via `CombatEventSink`); `BuffInstanceSelector` is a discriminated union; `ResolvedCombatOperation` ties `type`↔`payload`; result taxonomy separates structural faults from combat outcomes; `rollChance` locks RNG-consumption parity with legacy `rng() < chance`; contracts split into pure types vs runtime impls; `CombatSequence`/`eventId` stamped by the scheduler on `PendingCombatEvent`; R9 replaced with `CombatSettlementFault`; `CurrentBuffAuthorityAdapter` dropped (buff2 is the first real `BuffAuthority`); `DamageAuthority` receives damage intent — never "nearest existing method"; M4 reroutes the cycle RNG at `GameManagerTurnBattleOps.mintCycleRng`, not `TurnBattleAdapter`; `CombatScheduler` is explicitly an intra-action scheduler subordinate to `TurnPipeline`; `fractionOfOperationResult` replaced by `DeferredOperation` materialized by the batch runner; richer result payloads for traceability.

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
type ResolvedCombatOperation = CombatOperation & {
  operationId: CombatOperationId
  sourceId: CombatEntityId
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

// contracts/results.ts — taxonomy LOCKED (contract §50–53):
//   'resolved'  = committed, typed payload attached
//   'skipped'   = normal runtime invalidation (dead target, stale state) — typed reason required
//   'failed'    = the op was well-formed but its precondition failed at resolve (e.g. application roll
//                 failed → {status:'resolved'|'skipped' per authority semantics} — see note below)
//   STRUCTURAL  = missing port / unknown definition / malformed op → NEVER a result.
//                 Dev+test: throw. This is broken engine wiring, not a combat outcome (§50).
interface CombatOperationResultBase {
  operationId: CombatOperationId
  status: 'resolved' | 'skipped' | 'failed'
  reason?: CombatOperationResultReason
}
type CombatOperationResultReason =
  | 'stale_reaction_snapshot' | 'invalid_target_state' | 'application_roll_failed'
  | 'insufficient_resource' | 'blocked_by_restriction'
// NOTE: an ApplyBuffOperation whose application roll fails returns
// {status:'resolved', result:{applied:false}} — the op itself executed fine; the
// BUFF result is the authority on success (contract §17). 'failed' is reserved
// for ops that could not complete at all (e.g. consume_resource with
// insufficient_resource is 'skipped', not 'failed' — kept explicit in M1 tests).

// contracts/events.ts — authorities emit PENDING events; scheduler stamps the envelope
interface PendingCombatEvent { type: string; [k: string]: unknown }   // no eventId/combatSequence — scheduler owns those
interface CombatEventBase { eventId: CombatEventId; combatSequence: number }
type CombatEvent = CombatEventBase & (
  | ElementalApplicationCommitted
  | BuffApplicationFailedEvent
  | SettlementOverflowEvent
  | CombatSettlementFaultEvent
)
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
/** A lazy op the batch runner materializes AFTER earlier results exist —
    covers `heal_from_damage` (Xuyen Tho) without the executor ever reading
    scheduler/result state. Evaluated at batch position, never before. */
interface DeferredOperation {
  kind: 'deferred'
  resolve(results: readonly CombatOperationResultBase[]): ResolvedCombatOperation
}

// contracts/sink.ts
interface CombatEventSink { emit(event: PendingCombatEvent): void }   // authorities receive this; scheduler owns drain

// scheduler/ (implementation lives in runtime/scheduler/)
class CombatScheduler {
  constructor(executor: CombatOperationExecutor, opts?: { maxImmediateDepth?: number })
  enqueueAuthored(ops: readonly ResolvedCombatOperation[]): void     // authored intent — barrier after EACH
  registerImmediateHandler(type: string, handler: (event: CombatEvent) => ImmediateSettlement | void): void
  emitImmediate(event: PendingCombatEvent): void                     // stamps eventId+combatSequence, dedups (CON-19)
  run(): CombatTrace                                                  // drains authored + immediate until quiescent
  // NO public allocateSequence() — sequence is allocated internally at stamp/commit time
}
class CombatOperationExecutor {
  constructor(ports: CombatAuthorityPorts)                            // NO scheduler param — pure router
  execute(op: ResolvedCombatOperation, sink: CombatEventSink): CombatOperationResultBase
}
interface CombatAuthorityPorts {
  buffs?: BuffAuthority; damage?: DamageAuthority; gauge?: GaugeAuthority
  resource?: ResourceAuthority; shield?: ShieldAuthority; heal?: HealAuthority
}
class CombatTrace { /* §85 tree */ }
class CombatSettlementFault extends Error { /* fatal battle state — see M5 */ }
const MAX_IMMEDIATE_SETTLEMENT_DEPTH = 64  // dev/test guard
```

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R-C1 | Contract layer location: `game/src/core/battle/contracts/` (types) + `game/src/core/battle/runtime/` (impls). | Review: "type-only contracts" wording was self-contradictory once RNG/registry factories landed — split makes the dependency constitution honest. |
| R-C2 | `operationId` minting: producer mints deterministic ids; scheduler ASSERTS uniqueness on enqueue (duplicate → structural fault throw). `rootActionId` owner = the action/cast entry point (TurnBattleSystem declare path). | §13 requires uniqueness; assertion makes the rule enforceable instead of advisory. |
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
export interface ApplyBuffOperation { type: 'apply_buff'; payload: ApplyBuffRequest }
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
    private readonly executor: CombatOperationExecutor,
    private readonly preconditions: PreconditionChecker,   // narrow read ports (buff instance lookup, alive check)
    private readonly sink: CombatEventSink,
  )
  /** Returns batch outcome; per-op settle handled BY THE CALLER (scheduler loop). */
  preflight(batch: CombatOperationBatch): boolean
  /** Materializes DeferredOperations lazily at their position using prior in-batch results. */
  operationsOf(batch: CombatOperationBatch): readonly ResolvedCombatOperation[]
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
      drainImmediateOnce()                      // one event → handler → may enqueue ops
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
          enter batch frame — batch ops run ordered, non-interleaved;
          after EACH batch op, immediate consequences settle before the next
          batch op (satisfies §43 batch non-interleave AND §55 per-op settle);
          external authored ops CANNOT interleave (frame holds authoredQueue)
        DeferredOperation entries materialize at their position from prior
          in-batch results (R-C7)
  depth++ per drain cycle; > maxImmediateDepth → CombatSettlementFault (R9-revised)

emitImmediate(pending): stamp {eventId: `evt.${battleSeq}`, combatSequence: allocateSeq()} → enqueue
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
- Create: `game/src/core/battle/runtime/scheduler/adapters/EntityResourceAdapter.ts` — `the`/`mp` over `CombatEntity`
- Create: `game/src/core/battle/runtime/scheduler/adapters/EntityShieldAdapter.ts` — `currentWard`
- Test: `adapters/*.test.ts`

**Damage adapter rule (review blocker):** `dealDamage(payload, origin)` dispatches on `damageProfile` + `origin.kind`:
- `origin.kind === 'buff_periodic'` → DoT channel (`applyDotDamage` — dotResistance/dotRecovery economy).
- `origin.kind === 'reaction'` → **reaction channel**: a new explicit path (e.g. `applyReactionDamage` or profile-routed) that applies ELEMENT resistance + `damageProfile` rules (`canCrit:false`) — NEVER `applyDotDamage` (that would consume `dotResistancePercent`, fire `dotRecovery`, and report reason `'dot'`).
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
- Test: `game/src/core/battle/turn/TurnBattleSystem.rngContract.test.ts` — seeded battle reproducibility end-to-end

- [ ] **Step 1 — Failing test (seeded determinism):** two battles, same build + `SeededCombatRng(42)` via `setBattleRngFactory` + same actions → identical outcomes. Proves the ONE-stream property is preserved.
- [ ] **Step 2 — Reroute** — no second RNG authority anywhere; `TurnBattleAdapter` mints NOTHING (review: it must not create a parallel stream).
- [ ] **Step 3 — Verify (P3 FULL)** + **P13/P14** Playwright real battle.
- [ ] **Step 4 — P4 quick + P5 round.**

**Exit criteria:** one `CombatRng` per cycle at the composition root; zero `Math.random` reachable from battle paths; suite green.

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

1. `combatSequence` allocation point: stamped by scheduler at `emitImmediate`/`execute` time (chosen) vs authored-declare time — confirm the chosen rule covers "failed/skipped op gets a sequence" (answer: yes — every executed op + every stamped event gets one; enqueued-but-never-executed ops get none).
2. `PreconditionChecker` port scope — currently `buff_participant` + `entity_alive`; add `resource_at_least`/`stacks_at_least` now or when a consumer needs it (YAGNI lean: add when needed)?
3. Reaction damage channel — M3 adds an explicit reaction path in `CombatSystem` (e.g. `applyReactionDamage`); confirm that's an acceptable contract extension vs routing through `applyModifiedDirectDamage` with a `reason:'reaction'` flag.
