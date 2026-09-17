# Combat Systems Contract — Implementation Megaplan (Infrastructure Spine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

**Goal:** Build the shared combat runtime spine — `core/battle/contracts/` (operations/results/events/origin/`CombatRng`), `CombatScheduler` (sole `combatSequence` allocator + settlement barrier + exactly-once event dispatch), `CombatOperationExecutor` (pure router) and authority port interfaces — that Buff System Reimagined, SkillDefinition, and ReactionSystem all plug into.

**Architecture:** Contracts are type-only modules (no runtime deps → no cycles, contract §83). Scheduler owns ordering + sequence + event drain; executor routes `ResolvedCombatOperation` → authority port → typed result; authorities are port *interfaces* here — real adapters for the CURRENT engine (`CombatSystem` vitals, `ActionGauge`, `BuffSystem`) land inside this plan so every port has a real consumer, while the buff2 engine ports itself in its own megaplan.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.1 — THE source of truth; supersedes conflicting points in the other specs)
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.0 — first real authority consumer)
- `game/docs/specs/2026-09-17-skill-definition-system-spec.md` (v1.1 — operation producer)
- `game/docs/specs/2026-09-17-reaction-system-reimagined-spec.md` (v1.0 — event consumer)

**Sibling-plan dependency:** This megaplan is the code-level expansion of the Combat Contract scope inside `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M1–M2). It is the FOUNDATION — buff/skill/reaction megaplans assume every name in the Canonical-names section exists exactly as spelled.

## Global Constraints

- **No gameplay content changes.** This plan adds infrastructure + routes existing `TurnBattleSystem.rng` through `CombatRng`. Zero behavior change in combat outcomes; same seeded rolls in same order.
- **No ấn / Hỏa authoring:** no `hoa_an`/`han_tuc`/`doc_can`/`liet_thuong`/`tran_an`, no Hỏa skills, no `elemental_reaction_enabled` grant — all deferred to the seal batch. Test fixtures only.
- **Determinism (contract §87):** same seed + same commands → identical operation order, event order, sequence trace, final state.
- **No cycles (contract §83):** `contracts/` imports nothing from `core/buff`, `core/skill`, `core/reaction`, `core/battle/turn`. Entities/types it needs (`CombatEntityId`, `ElementType`, `BuffDefinitionId`) are imported as `type` only or redeclared as branded strings.
- **No path-specific primitives (CON-23):** no `ApplyHoaAn`, `TriggerDungKim`, `ApplyCamCong`, `DoNguDaoReaction` — operation vocabulary is generic (§5).
- **P3 verification:** `quick` (default) = `npm run type-check` + `npx vitest run <scope>` from `game/`. `full` adds `npm run build` + `npx vitest run` — mandatory for M4 (TurnBattleSystem rng reroute).
- **P4** adversarial QA (quick) per mission; **P5** three-lens review per mission; **P7** commit steps describe granularity only — explicit user authorization required per commit.
- **P13/P14:** M4 touches `TurnBattleSystem` — drive a real battle via Playwright (`npm run dev`, actual port) before merge-ready.
- **Per-mission report:** changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None expected) / risks / next.

## Canonical names (locked across ALL sibling plans — spell identically)

**Produced by this plan (everyone else imports, never redefines):**

```ts
// contracts/ids.ts
type CombatEntityId = string
type BuffDefinitionId = string
type BuffInstanceId = string
type ReactionId = string
type SkillId = string
type SkillEffectId = string
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

// contracts/operations.ts (contract §4–5)
type ReactionEligibility = 'eligible' | 'suppressed'
interface ResolvedCombatOperation {
  operationId: CombatOperationId
  type: CombatOperationType
  sourceId: CombatEntityId
  origin: CombatOperationOrigin
  payload: ResolvedOperationPayload
}

// contracts/results.ts (§52–53)
type CombatOperationStatus = 'resolved' | 'failed' | 'skipped'
type CombatOperationResultReason =
  | 'stale_reaction_snapshot' | 'invalid_target_state' | 'application_failed'
  | 'insufficient_resource' | 'definition_missing' | 'blocked_by_restriction'
interface CombatOperationResultBase {
  operationId: CombatOperationId
  status: CombatOperationStatus
  reason?: CombatOperationResultReason
}

// contracts/rng.ts (§88)
interface CombatRng { roll(): number; rollChance(chance: number): boolean }
class SeededCombatRng implements CombatRng          // deterministic PRNG
class FunctionCombatRng implements CombatRng        // adapts existing () => number
class ScriptedCombatRng implements CombatRng        // test: queue of rolls

// contracts/events.ts (§20, §45)
interface CombatEventBase { eventId: CombatEventId; combatSequence: number }
interface ElementalApplicationCommitted extends CombatEventBase {
  type: 'elemental_application_committed'
  instanceId: BuffInstanceId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  definitionId: BuffDefinitionId
  element: ElementType
  stacksBefore: number; stacksAfter: number
  requestedStacks: number; addedStacks: number
  reactionEligibility: ReactionEligibility
  origin: CombatOperationOrigin
}

// contracts/capability.ts (§24)
interface CombatCapabilityQuery { has(entityId: CombatEntityId, capabilityId: string): boolean }
const ELEMENTAL_REACTION_CAPABILITY = 'elemental_reaction_enabled' as const

// contracts/elemental.ts (§19)
interface ElementalStateRegistry {
  getDefinitionId(element: ElementType): BuffDefinitionId
  getElement(definitionId: BuffDefinitionId): ElementType | null
}

// scheduler/ (§2 authority map)
class CombatScheduler {
  allocateSequence(): number
  enqueueOperation(op: ResolvedCombatOperation): void
  runUntilQuiescent(): CombatTrace
  emitImmediate(event: CombatEvent): void
}
class CombatOperationExecutor { execute(op: ResolvedCombatOperation): CombatOperationResultBase }
interface CombatAuthorityPorts {
  buffs?: BuffAuthority; damage?: DamageAuthority; gauge?: GaugeAuthority
  resource?: ResourceAuthority; shield?: ShieldAuthority; heal?: HealAuthority
}
class CombatTrace { /* §85 tree */ }
const MAX_IMMEDIATE_SETTLEMENT_DEPTH = 64  // §57 guard
```

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R9 | Settlement-depth overflow in production: emit `settlement_overflow` error event + force-stop the drain + mark the originating operation `failed`/`settlement_depth_exceeded`. Dev/test: throw. | Contract §57 forbids silent truncation but doesn't name production behavior; this is the least-destructive explicit choice. |
| R-C1 | Contract layer location: `game/src/core/battle/contracts/` | Spec §84 says folder not locked; `core/battle/` keeps it inside the combat boundary and out of `turn/` (contracts are engine-agnostic). |
| R-C2 | `operationId` minting: producer mints deterministic ids (`op.${rootActionId}.${n}`); scheduler NEVER mints ids (reaction plan R-F compatible — `rx.${eventId}.${reactionId}.${i}` stays legal). | §13 requires uniqueness in the trace; producer-minting lets ReactionSystem emit ids without scheduler round-trips. |
| R-C3 | `CombatScheduler` is created per-battle (constructed by `TurnBattleSystem` at battle init in M4); no global singleton. | combatSequence is battle-scoped; singleton would leak across battles. |
| R-C4 | EventBus (`core/events/EventBus.ts`) is NOT reused for combat immediate events — the scheduler owns its own ordered immediate queue because settlement ordering + exactly-once + quiescence are tighter than EventBus semantics (emit-snapshot dispatch, no dedup). | EventBus handlers run at emit-time with snapshot semantics — incompatible with post-commit queued dispatch. Documented in M0. |

---

## Mission 0 — Inventory + seam verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-combat-contract-inventory.md`

- [ ] **Step 1 — Lock baseline:** `git rev-parse HEAD` into the inventory doc.
- [ ] **Step 2 — RNG call-site census:** every `this.rng(` / `this.rng()` / `Math.random` in `game/src/core/battle/turn/**` and `game/src/core/buff/**`. Verified starting set (baseline 2026-09-17): `TurnBattleSystem.ts:479` (ctor default), `:1033` (rollReactiveTrigger), `:1314`, `:2121`, `:2253` (composite picks / multicast), `:2407`, `:2955` (ailment roll); `BuffSystem.ts:485`, `:510` (default params — already rng-closures). Record every consumer that must keep identical roll ORDER after the M4 reroute.
- [ ] **Step 3 — Damage authority seam:** `CombatSystem` public surface used by combat ops — `applyDirectDamage` (`CombatSystem.ts:147`), `applyModifiedDirectDamage` (`:163`), `applyHealing` (`:168`), `applyDotDamage` (`:547`), `VitalsChangeReason` incl. existing `'reaction'` (`EntityVitalsSystem.ts:5`). Record which parameters map to `DealDamageOperation` payload fields.
- [ ] **Step 4 — Gauge authority seam:** `ActionGauge.ts` — `GAUGE_MAX = 1000`, `advanceGauge`, `isGaugeReady`, `consumeGaugeAfterAction`, `refundGauge` (positive-only clamp 0..MAX). **Gap:** no negative pushback — `PushGaugeOperation` needs a `pushGauge(actor, delta)` port; adapter adds `applyGaugeDelta` wrapping the same clamp. Record as contract-extension needed by reaction megaplan conflict #6.
- [ ] **Step 5 — Buff authority seam (current engine):** `new BuffSystem(actor.buffs)` sites (`TurnBattleSystem.ts:1110`, `:1824`), `applySkillAilments` (`:2939–2984` — per-stack loop `new BuffSystem(target.buffs).apply(...)`, `resolveAilmentApplicationChance`, `reactionManager?.checkAndTrigger` at `:2978`). Record how `addedStacks`/`stacksBefore/After` would be derived today (BuffSystem.apply returns void — needs result surface; this is buff megaplan's job, but the contract must carry the fields).
- [ ] **Step 6 — Event infrastructure:** `EventBus.ts` — emit handler snapshot semantics (`:44`), error swallowing. Decide + record: scheduler-owned immediate queue vs EventBus (R-C4).
- [ ] **Step 7 — Sequence/id conventions:** how `TurnDeclaredAction`/`TurnQueuedExecution` identify actions today; where `rootActionId` should mint (per declared action). `CombatEntity.id: string` (`CombatEntity.ts:11`+).
- [ ] **Step 8 — Write authority matrix:** every contract type → producing file → consuming files (current + planned).

**Exit criteria:** baseline SHA recorded; every canonical name mapped to a real producing file; damage/gauge/buff adapter signatures agreed in writing; R-C1..R-C4 + R9 recorded.

---

## Mission 1 — Contract types + RNG (pure, zero deps)

**Files:**
- Create: `game/src/core/battle/contracts/ids.ts` — branded id aliases
- Create: `game/src/core/battle/contracts/origin.ts` — `CombatOperationOrigin`, `CombatOperationOriginKind`
- Create: `game/src/core/battle/contracts/operations.ts` — `CombatOperation` union + payloads
- Create: `game/src/core/battle/contracts/results.ts` — result base + discriminated per-op results
- Create: `game/src/core/battle/contracts/events.ts` — `CombatEvent` union (start: `ElementalApplicationCommitted`, `BuffApplicationFailedEvent`, `SettlementOverflowEvent`)
- Create: `game/src/core/battle/contracts/rng.ts` — `CombatRng`, `SeededCombatRng`, `FunctionCombatRng`, `ScriptedCombatRng`
- Create: `game/src/core/battle/contracts/capability.ts` — `CombatCapabilityQuery`, `ELEMENTAL_REACTION_CAPABILITY`, `StaticCapabilityQuery` (map-backed)
- Create: `game/src/core/battle/contracts/elemental.ts` — `ElementalStateRegistry` interface + `createElementalStateRegistry` factory (validates all-5-mapped + distinct ids)
- Test: `game/src/core/battle/contracts/rng.test.ts`, `operations.test.ts`, `elemental.test.ts`

**Interfaces — Produces:** everything in the Canonical-names table.

**Operation union (contract §5) — exact payloads:**

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

// Every payload is selector-resolved: either {instanceId} or {definitionId,sourceId,targetId}
export interface BuffInstanceSelector {
  instanceId?: BuffInstanceId
  definitionId?: BuffDefinitionId
  targetId?: CombatEntityId
  sourceId?: CombatEntityId
}

export interface DealDamageOperation {
  type: 'deal_damage'
  payload: {
    targetId: CombatEntityId
    element?: ElementType | 'physical'
    damageProfile: string          // e.g. 'phap_tu_spell' | 'reaction_damage' | 'ailment_tick'
    coefficient: number            // resolved — executor never computes
    hitCount: number
    canCrit: boolean
    canMiss: boolean
    periodicId?: string            // set when origin.kind === 'buff_periodic'
    tags?: readonly string[]
  }
}
export interface HealOperation {
  type: 'heal'
  payload: {
    targetId: CombatEntityId
    amount?: number
    /** Xuyên Thổ pattern (reaction plan open q1): heal = fraction × result of a prior op in the same batch. */
    fractionOfOperationResult?: { operationId: CombatOperationId; fraction: number; capFractionOfTargetMaxHp: number }
  }
}
export interface ApplyBuffOperation {
  type: 'apply_buff'
  payload: ApplyBuffRequest        // spec §15: {definitionId, sourceId, targetId, stacks, baseChance, durationOverride?, reactionEligibility, origin}
}
export interface AddBuffStacksOperation    { type: 'add_buff_stacks';    payload: { selector: BuffInstanceSelector; stacks: number } }
export interface RemoveBuffStacksOperation { type: 'remove_buff_stacks'; payload: { selector: BuffInstanceSelector; stacks: number } }
export interface ConsumeBuffStacksOperation {
  type: 'consume_buff_stacks'
  payload: { selector: BuffInstanceSelector; stacks: number | 'all'; removalReason: 'consumed' | 'reaction' }
}
export interface AddBuffModifierOperation {
  type: 'add_buff_modifier'
  payload: { selector: BuffInstanceSelector; modifier: {
    id: string; appliedBy?: CombatEntityId
    channel: 'potency' | 'periodic_damage' | 'next_periodic_damage' | 'duration' | 'application_chance'
    operation: 'add' | 'multiply' | 'set'
    value: number
    reapply: 'replace' | 'stack' | 'max' | 'min'
    priority: number
    lifetime:
      | { type: 'buff_lifetime' } | { type: 'battle' } | { type: 'explicit' }
      | { type: 'uses'; remaining: number }
      | { type: 'holder_turns'; remaining: number }
      | { type: 'source_turns'; remaining: number }
      | { type: 'rounds'; remaining: number }
  } }
}
export interface RemoveBuffModifierOperation { type: 'remove_buff_modifier'; payload: { selector: BuffInstanceSelector; modifierId: string } }
export interface RefreshBuffDurationOperation { type: 'refresh_buff_duration'; payload: { selector: BuffInstanceSelector; duration?: number } }
export interface ExtendBuffDurationOperation  { type: 'extend_buff_duration';  payload: { selector: BuffInstanceSelector; turns: number; maxRemaining?: number } }
export interface TriggerBuffPeriodicOperation { type: 'trigger_buff_periodic'; payload: { selector: BuffInstanceSelector; periodicId?: string } }
export interface RemoveBuffOperation          { type: 'remove_buff';           payload: { selector: BuffInstanceSelector; removalReason: BuffRemovalReason } }
export type BuffRemovalReason =
  | 'expired' | 'consumed' | 'cleansed' | 'reaction' | 'death' | 'source_death' | 'battle_end' | 'replaced' | 'scripted'
export interface PushGaugeOperation    { type: 'push_gauge';    payload: { targetId: CombatEntityId; fractionOfMax: number } } // negative = pushback (needs applyGaugeDelta port — M0 step 4)
export interface GainResourceOperation    { type: 'gain_resource';    payload: { targetId: CombatEntityId; resourceId: string; amount: number } }
export interface ConsumeResourceOperation { type: 'consume_resource'; payload: { targetId: CombatEntityId; resourceId: string; amount: number | 'all'; valueSource?: 'current' | 'cast_snapshot' } }
export interface ApplyShieldOperation  { type: 'apply_shield'; payload: { targetId: CombatEntityId; amount: number } }
```

**Result union (contract §52–53):**

```ts
export type CombatOperationResult =
  | { operationId: CombatOperationId; type: 'deal_damage'; status; reason?; damage?: { rawDamage: number; hpDamage: number; killed: boolean } }
  | { operationId: CombatOperationId; type: 'heal'; status; reason?; healed?: number }
  | { operationId: CombatOperationId; type: 'apply_buff'; status; reason?; result?: ApplyBuffResult }
  | { operationId: CombatOperationId; type: 'add_buff_stacks' | 'remove_buff_stacks'; status; reason?; stacksBefore?: number; stacksAfter?: number }
  | { operationId: CombatOperationId; type: 'consume_buff_stacks'; status; reason?; result?: ConsumeStacksResult }
  | { operationId: CombatOperationId; type: 'add_buff_modifier' | 'remove_buff_modifier' | 'refresh_buff_duration' | 'extend_buff_duration' | 'trigger_buff_periodic' | 'remove_buff' | 'push_gauge' | 'gain_resource' | 'consume_resource' | 'apply_shield'; status; reason? }
```

`ApplyBuffResult`/`ConsumeStacksResult` are OWNED by the buff megaplan but their SHAPE is pinned here so results.ts compiles:

```ts
// contracts/buffResults.ts — forward-declared contract (buff plan implements verbatim)
export interface ApplyBuffResult {
  applied: boolean
  instanceId?: BuffInstanceId
  created?: boolean
  stacksBefore?: number; stacksAfter?: number
  requestedStacks?: number; addedStacks?: number; overflowStacks?: number
  durationBefore?: number; durationAfter?: number
}
export interface ConsumeStacksResult { consumed: number; remaining: number; removed: boolean }
```

- [ ] **Step 1 — Failing tests (`rng.test.ts`):**
  - `SeededCombatRng` same seed → identical 1000-roll sequence; different seed → different.
  - `rollChance(0)` → always false over 1000 rolls; `rollChance(1)` → always true; `rollChance(0.5)` deterministic under seed.
  - `ScriptedCombatRng` yields queued rolls in order, throws on exhaustion (test-only safety).
  - `FunctionCombatRng` wraps `() => number` lazily (spy on Math.random still intercepts — preserves `TurnBattleSystem` test seam at `:479`).
- [ ] **Step 2 — Failing tests (`operations.test.ts`):** union discrimination by `type`; `origin` carries `rootActionId`/`causationEventId`/`parentOperationId`; `ReactionEligibility` literal values.
- [ ] **Step 3 — Failing tests (`elemental.test.ts`):** registry factory throws on missing element, duplicate buff id, extra key; `getElement` round-trips.
- [ ] **Step 4 — Implement** all contract files. `SeededCombatRng` = mulberry32 (32-bit → [0,1)); document algorithm choice.
- [ ] **Step 5 — Verify (P3 quick):** `npm run type-check` + `npx vitest run src/core/battle/contracts`.

**Exit criteria:** all contract types compile standalone; zero imports outside `contracts/` + `core/element/ElementType.ts` (type-only); RNG deterministic under seed.

---

## Mission 2 — CombatScheduler + CombatOperationExecutor + ports

**Files:**
- Create: `game/src/core/battle/scheduler/CombatAuthorityPorts.ts` — port interfaces
- Create: `game/src/core/battle/scheduler/CombatOperationExecutor.ts`
- Create: `game/src/core/battle/scheduler/CombatScheduler.ts`
- Create: `game/src/core/battle/scheduler/CombatTrace.ts`
- Test: `game/src/core/battle/scheduler/CombatScheduler.test.ts`, `CombatOperationExecutor.test.ts`

**Interfaces — Produces:**

```ts
// CombatAuthorityPorts.ts — narrow, synchronous, battle-scoped. Real adapters in M3/M4.
export interface BuffAuthority {
  apply(req: ApplyBuffRequest): ApplyBuffResult
  addStacks(sel: BuffInstanceSelector, stacks: number): { stacksBefore: number; stacksAfter: number }
  removeStacks(sel: BuffInstanceSelector, stacks: number): { stacksBefore: number; stacksAfter: number }
  consumeStacks(sel: BuffInstanceSelector, stacks: number | 'all', reason: 'consumed' | 'reaction'): ConsumeStacksResult
  addModifier(sel: BuffInstanceSelector, mod: AddBuffModifierOperation['payload']['modifier']): void
  removeModifier(sel: BuffInstanceSelector, modifierId: string): void
  refreshDuration(sel: BuffInstanceSelector, duration?: number): { durationBefore?: number; durationAfter?: number }
  extendDuration(sel: BuffInstanceSelector, turns: number, maxRemaining?: number): { durationBefore?: number; durationAfter?: number }
  triggerPeriodic(sel: BuffInstanceSelector, periodicId?: string): readonly unknown[] // PeriodicResolution[] — buff plan owns type
  remove(sel: BuffInstanceSelector, reason: BuffRemovalReason): void
}
export interface DamageAuthority {
  dealDamage(op: DealDamageOperation['payload'], origin: CombatOperationOrigin): { rawDamage: number; hpDamage: number; killed: boolean }
}
export interface GaugeAuthority   { pushGauge(targetId: CombatEntityId, fractionOfMax: number): void }
export interface ResourceAuthority {
  gain(targetId: CombatEntityId, resourceId: string, amount: number): void
  consume(targetId: CombatEntityId, resourceId: string, amount: number | 'all'): { consumed: number }
}
export interface ShieldAuthority  { applyShield(targetId: CombatEntityId, amount: number): void }
export interface HealAuthority    { heal(targetId: CombatEntityId, amount: number, origin: CombatOperationOrigin): { healed: number } }

// CombatScheduler.ts
export interface ImmediateEventHandler { (event: CombatEvent): readonly ResolvedCombatOperation[] | void }
export class CombatScheduler {
  constructor(private readonly executor: CombatOperationExecutor, private readonly opts?: { maxImmediateDepth?: number })
  allocateSequence(): number                          // CON-20 sole allocator
  registerImmediateHandler(type: CombatEvent['type'], handler: ImmediateEventHandler): void
  emitImmediate(event: CombatEvent): void             // enqueue; dedup by eventId (CON-19)
  enqueueOperation(op: ResolvedCombatOperation): void
  runUntilQuiescent(): CombatTrace                    // §55 barrier loop
}
export class CombatOperationExecutor {
  constructor(private readonly ports: CombatAuthorityPorts, private readonly scheduler: CombatScheduler)
  execute(op: ResolvedCombatOperation): CombatOperationResult
}
export class CombatTrace {
  recordOperation(op: ResolvedCombatOperation): void
  recordResult(result: CombatOperationResult): void
  recordEvent(event: CombatEvent): void
  toString(): string                                  // §85 tree format
}
```

**Settlement semantics (contract §55–56):**

```
runUntilQuiescent():
  while opQueue non-empty OR immediateEventQueue non-empty:
    while opQueue: op = shift → executor.execute(op) → record result → authority may emitImmediate(event)
    while immediateEventQueue non-empty AND depth < maxImmediateDepth:
      event = shift; if seenEventIds.has(event.eventId) continue
      seenEventIds.add(event.eventId)
      for handler of handlers[event.type]: newOps = handler(event) → enqueueOperation(each)
      (newOps drain back into the op loop — quiescence = both queues empty)
    depth++ per immediate-drain cycle; overflow → R9 policy
```

- [ ] **Step 1 — Failing tests (executor):** each op type routes to its port exactly once with payload+origin intact; missing port → `{status:'failed', reason:'definition_missing'}`-style typed failure (no throw); result union carries per-op payload.
- [ ] **Step 2 — Failing tests (scheduler):**
  - `combatSequence` increments monotonically; only scheduler allocates (no public setter).
  - settlement: op → emits event → handler returns 2 ops → those run BEFORE the next queued authored op (contract §94 semantics).
  - quiescence: chained events (event → op → event → op) all drain before return.
  - exactly-once: `emitImmediate` twice with same `eventId` → handler fires once.
  - depth guard: self-feeding handler exceeds `maxImmediateDepth` → dev-mode throw / scripted result `failed`+`settlement_overflow` event under production flag.
  - trace: `toString()` renders §85 tree (rootAction → op → result → event → follow-ups).
- [ ] **Step 3 — Implement** ports, executor (switch on `op.type` → port call → wrap result), scheduler, trace.
- [ ] **Step 4 — Verify (P3 quick).**

**Exit criteria:** contract §55–59 mechanics proven with stub authorities; no production code touched yet.

---

## Mission 3 — Current-engine authority adapters (real consumers)

Ports need real adapters NOW (no-unused-primitives rule) — these adapt the EXISTING engine so the contract layer is exercised by real combat paths, while buff2 swaps the `BuffAuthority` impl later.

**Files:**
- Create: `game/src/core/battle/scheduler/adapters/CombatSystemDamageAdapter.ts` — `DamageAuthority` over `CombatSystem` (`applyModifiedDirectDamage` for crit-bearing, `applyDotDamage`-style channel for `canMiss:false`/`origin:'buff_periodic'|'reaction'`)
- Create: `game/src/core/battle/scheduler/adapters/CombatSystemHealAdapter.ts` — `HealAuthority` over `CombatSystem.applyHealing`
- Create: `game/src/core/battle/scheduler/adapters/ActionGaugeAdapter.ts` — `GaugeAuthority`: adds `applyGaugeDelta(entity, delta)` (signed; existing `refundGauge` is positive-only — M0 step 4 gap)
- Create: `game/src/core/battle/scheduler/adapters/EntityResourceAdapter.ts` — `ResourceAuthority` over `CombatEntity.currentThe`/`currentMp` (the/mp today; generic `resourceId` map)
- Create: `game/src/core/battle/scheduler/adapters/CurrentBuffAuthorityAdapter.ts` — `BuffAuthority` over per-target `new BuffSystem(pool)` — **transitional**; notes mark each method for buff2 replacement (e.g. `apply` must synthesize `ApplyBuffResult` from before/after pool reads until buff2 returns real results)
- Test: `game/src/core/battle/scheduler/adapters/*.test.ts`

- [ ] **Step 1 — Failing tests:** damage adapter maps `{damageProfile:'reaction_damage', canCrit:false}` → `applyDotDamage`-channel call with `reason:'reaction'`; gauge adapter clamps negative pushback at 0; resource adapter `consume('all')` returns actual consumed; buff adapter `apply` yields `stacksBefore`/`stacksAfter` deltas.
- [ ] **Step 2 — Implement adapters.**
- [ ] **Step 3 — Verify (P3 quick).**

**Exit criteria:** every port has ≥1 real adapter + test; adapters are the ONLY files importing legacy engine internals from `scheduler/`.

---

## Mission 4 — Wire `CombatRng` into TurnBattleSystem + determinism suite

**Files:**
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — ctor takes `CombatRng` (or keeps `rng: () => number` and wraps via `FunctionCombatRng`); every `this.rng()` roll site routes through `combatRng.rollChance(x)`/`roll()` — **same call order, same semantics** (pure reroute)
- Modify: `game/src/core/game/TurnBattleAdapter.ts` (or whoever constructs TurnBattleSystem) — construct `SeededCombatRng` when a battle seed exists, else `FunctionCombatRng(Math.random)`
- Test: `game/src/core/battle/turn/TurnBattleSystem.rngContract.test.ts` — seeded battle reproducibility
- Docs: `game/docs/systems/combat-overview.md` — add contract-layer section

- [ ] **Step 1 — Failing test (seeded determinism):** two battles, same participant build + `SeededCombatRng(42)` + same scripted actions → identical ailment-application outcomes and multicast rolls. (Baseline: rolls already route through the injected closure — this test proves the CONTRACT type preserves that.)
- [ ] **Step 2 — Reroute rng sites** enumerated in M0 step 2 (`:1033,:1314,:1824,:2121,:2253,:2407,:2955` — re-verify at implementation; line numbers drift).
- [ ] **Step 3 — Verify (P3 full)** — full vitest must stay green; **P13/P14** Playwright real battle (ailment applies, multicast fires) before merge-ready.
- [ ] **Step 4 — P4 quick + P5 review round.**

**Exit criteria:** zero `Math.random` reachable from turn-engine combat paths; seeded battles reproducible; no behavior change.

---

## Mission 5 — Contract hardening: trace exporter + doc + DoD sweep

**Files:**
- Create: `game/src/core/battle/scheduler/CombatTraceExporter.ts` — §85 tree dump (dev only)
- Modify: `game/docs/systems/combat-overview.md`, `game/docs/roadmap.md` — record the new spine + deferred items
- Test: extend `CombatScheduler.test.ts` — contract §91–93, §97 infra-side cases (application-failure emits nothing elemental, AddStacks emits no elemental event, duplicate eventId)

- [ ] **Step 1 — Trace exporter + format test.**
- [ ] **Step 2 — Contract DoD sweep:** walk spec §104 row-by-row; each infra-ownable row maps to a named test or an explicit "owned by sibling plan" note.
- [ ] **Step 3 — Docs + verify (P3 quick).**

**Exit criteria:** spec §104 infra rows all accounted; sibling megaplans' "consumes" lists satisfied by real files.

---

## Spec coverage map (§ → mission)

| Contract § | Content | Mission |
|---|---|---|
| §3–5, §14–15 | authored vs runtime ops, union, eligibility, ApplyBuffRequest | M1 |
| §10–13 | origin, causal chain, combatSequence, op ids | M1 (types) + M2 (scheduler alloc) |
| §17–21, §52–54 | results, failed application, event payload/timing | M1 + M3 adapters |
| §24 | capability query | M1 interface; impl in reaction plan |
| §31–33 | fixed-point bias, tie priority | reaction plan (not here) |
| §36–49 | snapshot, preconditions, batch, no-rollback | reaction plan; scheduler barrier supports it here (M2) |
| §55–59 | settlement, quiescence, depth guard, exactly-once, causation | M2 |
| §60–62 | sequential multicast, death handoff | M4 note + skill plan |
| §66–69 | damage origins distinct | M3 damage adapter + results typing |
| §70–72 | gauge contract, Cấm Công contract | M3 gauge adapter; validator in reaction plan |
| §83–84 | dependency direction, contract layer | M1 structure |
| §85–88 | trace, hidden mutation ban, determinism, RNG | M2/M4/M5 |
| §91–102 | contract tests | infra rows M5; cross-system rows in sibling plans |

## Deferred / owned by sibling plans

- `BuffSystem` engine internals, `ApplyBuffResult` production impl, `ElementalApplicationCommitted` emission → **buff megaplan**
- `SkillResolver`/`ResolvedSkillPlan`/executor emission → **skill megaplan**
- `ReactionSystem`/`ReactionBatchRunner`/`ElementalStateRegistry` production mapping → **reaction megaplan** (done: `2026-09-17-megaplan-reaction-system.md`)
- All ấn definitions + capability grant + legacy reaction retirement → **seal batch**

## Open questions for coordinator

1. R-C2 — who mints `operationId` (producer deterministic vs scheduler-stamp)? Chosen: producer. Sibling reaction plan assumed compatible either way.
2. `applyGaugeDelta` signed-delta addition to `ActionGauge` — additive API, needs a note since `refundGauge` is positive-only today.
3. `fractionOfOperationResult` on `HealOperation` — included here so reaction plan's Xuyên Thổ works; confirm damage result carries `rawDamage`/`hpDamage` (it does).
