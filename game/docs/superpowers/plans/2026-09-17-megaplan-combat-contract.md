# Combat Systems Contract — Implementation Megaplan (Infrastructure Spine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

> **Review revision:** v7.1 — buff-plan review amendment (2026-09-17): adds `SetBuffStacksOperation`/`SetBuffDurationOperation`/`CleanseBuffOperation` + `BuffCleanseQuery`/`CleanseResult` + matching result members and `BuffAuthority` port methods (Buff Final Spec §36/§38/§42/§67 parity — every mutator reachable via ops per §8); `CombatAuthorityExecutionContext.combatSequence` (the op's own execution-start allocation — read channel, scheduler stays sole allocator); `createLifecycleSink` returns `{sink, sequence}` (the root transaction's allocated sequence); `BuffPeriodicDamageRequest.snapshot?` (spec §25 snapshot-scaling carrier). Purely additive — no v7 semantics changed.
>
> v7 — incorporates code review round 6 (at `239a60bc`). Round-6 fix: an op's `combatSequence` is allocated at **execution-START** — before `executor.execute()` — so a cause's sequence always precedes its effects' (an authority emitting mid-execute can no longer get a lower sequence than the op that emitted it). Semantics locked: `combatSequence` = chronological creation/execution-start order ONLY; the causal tree is built from `causationOperationId`/`causationEventId`/`rootActionId`/`parentOperationId` — `CombatTrace.toString()` renders the tree from causation fields, never by sorting on sequence (depth-first settlement order ≠ numeric order: `A=1,E1=2,E2=3,X=4` settles as `A→E1→X→E2`). v6 (`239a60bc`): round 5 — event queues are **per-execution frames**, not one global FIFO — an op's emissions drain inside ITS barrier before siblings AND before outer queued events (true depth-first consequence trees: `E1→X→E3→Z→Y→E2`, never `E1→X→E2→E3`; batch frames get the same isolation); `PeriodicRequestsCommitted` drops the fabricated `origin` (a lifecycle root isn't a `CombatOperation` — the event carries `holderId`+`rootActionId`; the built-in handler mints each request's OWN `origin{kind:'buff_periodic', originId: instanceId:periodicId, sourceId: req.sourceId, causationEventId}`); group-atomic id reservation everywhere — `enqueueAuthored`, handler-returned op lists, and batches all validate+reserve ALL ids before their first member executes (a produced group never commits op 1 then discovers a bad id in op 2); batch structural validation now runs BEFORE runtime preflight (a malformed graph is a structural fault independent of combat state — a dead target can't hide a duplicate id); `createLifecycleSink(rootActionId)` is a public scheduler API and event ordinals are scheduler-owned per scope (`eventOrdinalByScope`) so two sinks for one scope never collide; `workThisBarrier` resets per ROOT unit (authored op OR root-queue event — lifecycle roots get a fresh budget too); handler-emitted events settle AFTER the handler's returned settlement (locked ordering); `registerImmediateHandler` is one-handler-per-type (duplicate → structural fault); M3 exit criterion + R9 wording fixed (profiles not origins; "settlement guard violation" covers both guards). v5 (`57475205`): round 4. v4 (`aead334b`): round 3. v3 (`5c17f2a3`): round 2. v2 (`eb8587d2`): round 1.

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
  | 'insufficient_resource' | 'blocked_by_restriction' | 'dependency_not_resolved'
// NOTE: an ApplyBuffOperation whose application roll fails returns
// {status:'resolved', result:{applied:false}} — the op executed fine; the BUFF
// result is the authority on success (contract §17). insufficient_resource →
// 'skipped' (target state invalidation), not 'failed'.

// contracts/events.ts — event identity vs sequence vs causality are SEPARATE
// authorities (review r2/r3/r4). Producers emit ENVELOPE-FREE payloads
// (`CombatEventPayload` — no eventId/causation/combatSequence at all);
// the scoped CombatEventSink mints `eventId` = `evt.${scopeId}.${counter++}`
// + the causation id (review r4 MEDIUM 3 — no per-authority ordinal
// bookkeeping). The scheduler stamps only `combatSequence` at enqueueEvent and
// dedups on the producer eventId there — the SINGLE dedup point (r4 HIGH 1).
// Causality: `causationOperationId` (authority-emitted) or `causationEventId`
// (handler-emitted) gives the trace an explicit edge — never parse eventIds.
// CLOSED unions (review r3 MEDIUM): TS type aliases cannot be declaration-
// merged — sibling plans add members by EDITING this file, not by augmenting.
type CombatEventPayload =                        // what authorities/handlers emit
  | Omit<ElementalApplicationCommitted, 'eventId'|'causationOperationId'|'causationEventId'|'combatSequence'>
  | Omit<BuffApplicationFailedEvent, 'eventId'|'causationOperationId'|'causationEventId'|'combatSequence'>
  | Omit<PeriodicRequestsCommitted, 'eventId'|'causationOperationId'|'causationEventId'|'combatSequence'>
type PendingCombatEvent =                        // what the sink hands the scheduler
  | Omit<ElementalApplicationCommitted, 'combatSequence'>
  | Omit<BuffApplicationFailedEvent, 'combatSequence'>
  | Omit<PeriodicRequestsCommitted, 'combatSequence'>
  // NOT CombatSettlementFaultEvent — faults are OUT-OF-BAND diagnostics
  // (review r3 HIGH 6): a halted scheduler cannot drain its own fault event.
  // Faults go to trace.recordFault + diagnosticSink, never the gameplay queue.
interface CombatEventBase {
  eventId: CombatEventId                       // sink-minted `evt.${scopeId}.${n}` (see sink.ts)
  causationOperationId?: CombatOperationId     // set by an op-scoped sink
  causationEventId?: CombatEventId             // set by an event-scoped sink
  combatSequence: number                       // scheduler-stamped — sole allocator
}
type CombatEvent =
  | ElementalApplicationCommitted
  | BuffApplicationFailedEvent
  | PeriodicRequestsCommitted
  | CombatSettlementFaultEvent                 // stamped for trace, diagnostic lane only
interface ElementalApplicationCommitted extends CombatEventBase {
  type: 'elemental_application_committed'
  instanceId: BuffInstanceId; sourceId: CombatEntityId; targetId: CombatEntityId
  definitionId: BuffDefinitionId; element: ElementType
  stacksBefore: number; stacksAfter: number
  requestedStacks: number; addedStacks: number
  reactionEligibility: ReactionEligibility
  origin: CombatOperationOrigin
}
// Periodic bridge (review r4 BLOCKER 2 + r5 BLOCKER 2): BuffAuthority.
// triggerPeriodic commits its use/modifier semantics, then emits THIS event
// via ctx.events carrying the typed requests. The scheduler's built-in handler
// converts each request 1:1 into deal_damage/heal ops (`periodic.${eventId}.${i}`
// ids) settled in the same barrier. The SAME event is emitted by buff lifecycle
// ticks via lctx.events — one lane for op-triggered AND lifecycle periodic
// resolution. Executor stays a pure router (it never sees the requests).
// NO `origin: CombatOperationOrigin` on the event (r5 BLOCKER 2): a lifecycle
// tick is not an operation and one event can carry requests from MANY
// different sourceIds — provenance lives on each request. The built-in handler
// mints each emitted op's origin itself:
//   {kind:'buff_periodic', originId:`${req.instanceId}:${req.periodicId}`,
//    sourceId:req.sourceId, rootActionId:event.rootActionId,
//    causationEventId:event.eventId}
interface PeriodicRequestsCommitted extends CombatEventBase {
  type: 'periodic_requests_committed'
  holderId: CombatEntityId
  rootActionId: string               // ctx.origin.rootActionId (op) or lctx.rootActionId (lifecycle)
  requests: readonly (BuffPeriodicDamageRequest | BuffPeriodicHealRequest)[]
}
interface CombatSettlementFaultEvent extends CombatEventBase {
  type: 'combat_settlement_fault'
  reason: 'settlement_depth_exceeded' | 'settlement_work_budget_exceeded'  // r4 MEDIUM 2
  traceDigest: string
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
/** Review r2/r3/r4 — declarative primitive, NOT an arbitrary closure.
    A closure could capture mutable combat state; a data primitive is
    materialized by the batch runner from the typed result store. Extensible —
    add members when a real consumer needs one (YAGNI).
    `operationId` is PRE-MINTED by the producer (R-C2 applies to deferred ops —
    the batch runner must NOT mint ids); materialization preserves it.
    `resultOperationId` constraints (r4 BLOCKER 3/HIGH 2): must reference an
    EARLIER entry in the SAME batch whose resolved type is `deal_damage` —
    enforced by static batch validation BEFORE any mutation. At materialize
    time, a referenced result that is not `resolved` yields
    {status:'skipped', reason:'dependency_not_resolved'} — never a silent 0. */
type DeferredOperation =
  | {
      kind: 'heal_from_damage_result'
      /** Producer-minted id of the ResolvedCombatOperation this becomes. */
      operationId: CombatOperationId
      /** An earlier in-batch `deal_damage` op whose result this heal derives from. */
      resultOperationId: CombatOperationId
      healTarget: 'source' | 'target'
      fraction: number
      origin: CombatOperationOrigin
    }
/** Typed read-only access to prior in-batch results — the runner materializes
    DeferredOperations against THIS, never a raw array and never scheduler state. */
interface BatchResultContext {
  get(operationId: CombatOperationId): CombatOperationResult | undefined
}

// contracts/sink.ts — SCOPED sink (review r4 MEDIUM 3): producers emit
// envelope-free `CombatEventPayload`; the sink implementation is created
// per-scope by the scheduler and mints `eventId` (`evt.${scopeId}.${counter++}`)
// + the causation id itself (op scope → causationOperationId, event scope →
// causationEventId, lifecycle scope → no causation). Forwards the built
// PendingCombatEvent to scheduler.enqueueEvent (single dedup + stamp point).
interface CombatEventSink { emit(event: CombatEventPayload): void }

// contracts/context.ts — review r3 BLOCKER 1: the executor hands each authority
// call this context; ctx.events is an OP-SCOPED sink so the authority never
// does id bookkeeping — it just emits {type, ...fields}.
interface CombatAuthorityExecutionContext {
  operationId: CombatOperationId       // the op currently executing
  origin: CombatOperationOrigin
  events: CombatEventSink              // scoped to this op — mints evt.${operationId}.${n}
  /** v7.1 (buff-plan review amendment) — the executing op's OWN combatSequence,
      allocated at execution-START before this ctx is built (r6). Read channel
      for authorities stamping internal state (BuffInstance.createdSequence /
      lastAppliedSequence). Allocation stays with the scheduler — the ctx is
      never an allocator. */
  combatSequence: number
}

// contracts/trace.ts — review r2 HIGH 2: op sequence lives on the RECORD, not the op
interface CombatExecutionRecord {
  combatSequence: number                  // allocated at EXECUTION-START — before
                                          // executor.execute() — so an op's sequence
                                          // always precedes the events it emits
                                          // (r6 BLOCKER). Sole allocator: scheduler
  operation: ResolvedCombatOperation
  result: CombatOperationResult
}
// PendingCombatEvent is a CLOSED union — sibling plans add members by editing
// contracts/events.ts in their own missions (reaction adds
// ReactionResolvedEvent/ReactionSkippedEvent; buff adds BuffApplied/
// BuffStacksChanged/...).

// scheduler/ (implementation lives in runtime/scheduler/)
class CombatScheduler {
  constructor(executor: CombatOperationExecutor, opts?: {
    maxSettlementNestingDepth?: number      // recursive frame guard (default 64)
    maxImmediateWorkPerBarrier?: number     // flat-chain budget PER ROOT (default 1024)
  })
  /** Validates + reserves ALL ids in the group ATOMICALLY before enqueue
      (r5 BLOCKER 3) — a produced group never commits its first op then
      discovers a bad id in a later sibling. Duplicate/malformed → structural
      fault throw, zero enqueued. */
  enqueueAuthored(ops: readonly ResolvedCombatOperation[]): void     // authored intent — barrier after EACH
  /** Review r3 HIGH — uniqueness is GLOBAL, not authored-only. Called
      per-GROUP atomically: enqueueAuthored, handler-returned op lists, and
      batches (after structural validation) all reserve before their first
      member executes. Duplicate → structural fault. BatchResultContext.get()
      keys on these ids, so a collision is a correctness bug, not a nicety. */
  reserveOperationId(id: CombatOperationId): void
  /** ONE handler per event type — duplicate registration → structural fault
      (r5 MEDIUM 3; multiple observers → orchestrating handler or secondary
      events, never a silent overwrite). The sink param is EVENT-SCOPED. */
  registerImmediateHandler(type: string, handler: (event: CombatEvent, sink: CombatEventSink) => ImmediateSettlement | void): void
  /** Called by scoped sinks (they mint eventId + causation id); THE dedup point
      — stamps combatSequence only for never-seen eventIds (CON-19). Duplicate
      delivery of the same eventId → stamped once, dropped here. The target
      queue is the emitting scope's frame, not a global FIFO (r5 BLOCKER 1). */
  enqueueEvent(pending: PendingCombatEvent): void
  /** PUBLIC lifecycle sink factory (r5 HIGH 2) — TurnBattleSystem calls this
      to build BuffLifecycleContext.events. Event ordinals are scheduler-owned
      per scopeId (`eventOrdinalByScope`), so two sinks for the same
      rootActionId NEVER mint the same eventId. Op/event sinks are internal. */
  /** v7.1 — returns the sink AND the root transaction's own combatSequence,
      allocated once at creation (R-C2 roots are real transactions;
      `status.turn.N.*` needs a truthful sequence for lifecycle-created state
      e.g. convertsToId — without it authorities would read scheduler
      internals). Sole allocator stays the scheduler. */
  createLifecycleSink(rootActionId: string): { sink: CombatEventSink; sequence: number }
  run(): CombatTrace                                                  // drains authored + root events until quiescent
  // NO public allocateSequence() — sequence is allocated internally at stamp/commit time
}
class CombatOperationExecutor {
  constructor(ports: CombatAuthorityPorts)                            // NO scheduler param — pure router
  /** Routes op → port. Builds CombatAuthorityExecutionContext
      ({operationId: op.operationId, origin: op.origin, events: sink}) and
      passes it as the ctx arg on every authority call (review r3 BLOCKER 1).
      The `sink` is an OP-SCOPED sink the scheduler creates per execution —
      it mints `evt.${op.operationId}.${n}` + `causationOperationId` itself;
      authorities emit envelope-free payloads (review r4 MEDIUM 3).
      Returns the FULL discriminated result — batch runners + traces need
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
  /** §85 tree format — the CAUSAL tree is built from causation fields
      (rootActionId / parentOperationId / causationOperationId /
      causationEventId), NOT by sorting on combatSequence (r6): sequence is
      chronological creation/execution-start order — depth-first settlement
      makes numeric order ≠ tree order (A=1,E1=2,E2=3,X=4 settles A→E1→X→E2). */
  toString(): string
}
class CombatSettlementFault extends Error { /* fatal battle state — see M5 */ }
// Dual guard (review r3 HIGH 5): nesting depth catches recursive batch frames;
// the per-barrier work budget catches FLAT infinite chains (op→event→op→event…
// never nests deeper but never quiesces). Either exceeded → CombatSettlementFault.
const MAX_SETTLEMENT_NESTING_DEPTH = 64
const MAX_IMMEDIATE_WORK_PER_BARRIER = 1024
```

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R-C1 | Contract layer location: `game/src/core/battle/contracts/` (types) + `game/src/core/battle/runtime/` (impls). | Review: "type-only contracts" wording was self-contradictory once RNG/registry factories landed — split makes the dependency constitution honest. |
| R-C2 | `operationId` minting: producer mints deterministic ids; scheduler ASSERTS uniqueness on enqueue (duplicate → structural fault throw). `rootActionId` = id of the ROOT combat resolution transaction — NOT restricted to skill casts (review r2 HIGH 4): `action.turn.N.*` for declared actions, `status.turn.N.*` for buff/status phase ticks, `script.*` for scripted beats, `proc.*` for proc-driven roots. Owner = whatever entry point drives the resolution (TurnBattleSystem declare, status phase, scripted runner). | §13 requires uniqueness; assertion enforces it. Non-action roots exist today (buff ticks run before the action's declare phase) — narrowing the owner to casts would force sibling plans to invent ids off-contract. |
| R-C3 | `CombatScheduler` per battle, constructed by `GameManagerTurnBattleOps` (the composition root) alongside `mintCycleRng`; handed INTO `TurnBattleSystem` as a ctor dep. | Review: per-battle scope approved, but construction belongs at lifecycle root — same place the cycle RNG already lives. |
| R-C4 | `EventBus` NOT reused for combat immediate events — scheduler owns its ordered queue (settlement ordering + exactly-once + quiescence exceed EventBus emit-snapshot semantics). | Approved in review. |
| R9-revised | Settlement guard violation — nesting depth OR per-root work budget exceeded (r5 MEDIUM 2) → `CombatSettlementFault`: dev/test throw; production stops battle progression + emits `CombatSettlementFaultEvent` (out-of-band diagnostic, never a queued gameplay event) + trace dump. NEVER retroactively marks the committed originating op failed — its result already committed (contract §48). | Review rejected retro-fail: committed state can't be un-resolved. |
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
- [ ] **Step 7 — Root-transaction id census (review r3 MEDIUM — NOT action-only):** `rootActionId` is the id of a ROOT combat resolution transaction (R-C2: action/status/script/proc roots all exist). Census EVERY root entry point — `declareActorAction` (`:894`) mints `action.turn.N.*` for declared actions (the ACTION-root impl, not the global owner); status/buff tick phases mint `status.turn.N.*`; scripted beats `script.*`; proc-driven roots `proc.*`. `castId`/`subcastIndex` minted by the skill plan's resolver/executor. `CombatEntity.id: string`.
- [ ] **Step 8 — Write authority matrix** (type → producing file → consuming files) + R-C1..R-C7/R9-revised table for sign-off.

**Exit criteria:** baseline SHA; full RNG graph + TurnPipeline boundary documented; damage/gauge adapter signatures agreed in writing; all rulings recorded.

---

## Mission 1 — Contract types (pure) + runtime impls (rng/registry/capability)

**Files:**
- Create: `game/src/core/battle/contracts/ids.ts`, `origin.ts`, `selectors.ts`, `operations.ts`, `results.ts`, `events.ts`, `rng.ts`, `capability.ts`, `elemental.ts`, `settlement.ts`, `sink.ts`, `context.ts`, `periodic.ts`
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
  | SetBuffStacksOperation | SetBuffDurationOperation | CleanseBuffOperation
  | TriggerBuffPeriodicOperation | RemoveBuffOperation
  | PushGaugeOperation
  | GainResourceOperation | ConsumeResourceOperation
  | ApplyShieldOperation

// Each member is self-contained: `type` discriminates, `payload` is typed per member.
// ResolvedCombatOperation = CombatOperation & {operationId, origin} — the
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
  // review r4 HIGH 3: no capFractionOfHealTargetMaxHp — the only consumer
  // (Xuyên Thổ) caps the heal RATIO at resolution time, not maxHp at execute
  // time (spec: heal = 5%×D of damage dealt, cap 25% = the ratio's own cap).
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
/** v7.1 (buff-plan review amendment) — spec §36/§38/§42/§67 parity: every
    BuffAuthority mutator is reachable via an op (contract §8 external
    mutation rule). Producers arrive with their consumers. */
export interface SetBuffStacksOperation       { type: 'set_buff_stacks';       payload: { selector: BuffInstanceSelector; stacks: number } }
export interface SetBuffDurationOperation     { type: 'set_buff_duration';     payload: { selector: BuffInstanceSelector; duration: number } }
export interface BuffCleanseQuery {
  kind?: 'buff' | 'debuff' | 'ailment' | 'marker'
  tags?: readonly string[]
  element?: ElementType
  definitionId?: BuffDefinitionId
}
export interface CleanseBuffOperation         { type: 'cleanse_buff';          payload: { targetId: CombatEntityId; query: BuffCleanseQuery } }
export interface CleanseResult { cleansed: BuffInstanceId[]; skipped: BuffInstanceId[] }  // skipped = matched but dispellable:false
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
  | { operationId; type: 'refresh_buff_duration' | 'extend_buff_duration' | 'set_buff_duration'; status; reason?; result?: { durationBefore: number; durationAfter: number } }
  | { operationId; type: 'set_buff_stacks'; status; reason?; result?: StacksResult }
  | { operationId; type: 'cleanse_buff'; status; reason?; result?: CleanseResult }
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
// EVERY method takes ctx (review r3 BLOCKER 1): authorities mint eventIds +
// causationOperationId from ctx.operationId and emit via ctx.events.
export interface BuffAuthority {
  apply(req: ApplyBuffRequest, ctx: CombatAuthorityExecutionContext): ApplyBuffResult
  addStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): StacksResult
  removeStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): StacksResult
  consumeStacks(sel: BuffInstanceSelector, stacks: number | 'all', reason: 'consumed' | 'reaction', ctx: CombatAuthorityExecutionContext): ConsumeStacksResult
  addModifier(sel: BuffInstanceSelector, mod: BuffModifierPayload, ctx: CombatAuthorityExecutionContext): { applied: boolean }
  removeModifier(sel: BuffInstanceSelector, modifierId: string, ctx: CombatAuthorityExecutionContext): { removed: boolean }
  refreshDuration(sel: BuffInstanceSelector, duration: number | undefined, ctx: CombatAuthorityExecutionContext): { durationBefore: number; durationAfter: number }
  extendDuration(sel: BuffInstanceSelector, turns: number, maxRemaining: number | undefined, ctx: CombatAuthorityExecutionContext): { durationBefore: number; durationAfter: number }
  /** Commits periodic use/modifier semantics, then emits
      `PeriodicRequestsCommitted` (carrying the typed requests) via ctx.events —
      the scheduler's built-in handler converts them to ops (review r4
      BLOCKER 2). The return value feeds result.resolutionsEmitted only. */
  triggerPeriodic(sel: BuffInstanceSelector, periodicId: string | undefined, ctx: CombatAuthorityExecutionContext): readonly PeriodicResolution[]
  remove(sel: BuffInstanceSelector, reason: BuffRemovalReason, ctx: CombatAuthorityExecutionContext): void
  /** v7.1 — spec §36/§38/§42/§67 required-API parity. cleanse removes every
      dispellable instance on targetId matching query (reason 'cleansed'). */
  setStacks(sel: BuffInstanceSelector, stacks: number, ctx: CombatAuthorityExecutionContext): StacksResult
  setRemainingDuration(sel: BuffInstanceSelector, duration: number, ctx: CombatAuthorityExecutionContext): { durationBefore: number; durationAfter: number }
  cleanse(targetId: CombatEntityId, query: BuffCleanseQuery, ctx: CombatAuthorityExecutionContext): CleanseResult
}
// contracts/periodic.ts — typed periodic requests (review r3 BLOCKER 3:
// canonicalized to the Buff Final Spec shape — damageProfile + coefficient +
// crit/miss, NOT `rawPower`. Buff resolves lifecycle/stack semantics (stack
// scaling already folded into `coefficient`; `stackCount` rides along only if
// the profile needs it); DamageSystem resolves the combat formula. The
// scheduler converts each request 1:1 into a ResolvedCombatOperation
// (deal_damage/heal, origin.kind 'buff_periodic', origin minted by the
// scheduler from the buff instance) and settles them like any other op.
export interface BuffPeriodicDamageRequest {
  instanceId: BuffInstanceId; periodicId: string
  sourceId: CombatEntityId; targetId: CombatEntityId
  element?: ElementType | 'physical'
  damageProfile: string
  coefficient: number          // stack-scaled effective coefficient — NOT raw damage
  hitCount: number
  canCrit: boolean
  canMiss: boolean
  stackCount?: number          // metadata for profiles that scale on stacks
  tags?: readonly string[]
  /** v7.1 — present iff the periodic def's scaling==='snapshot': the source's
      offensive context captured at apply (Buff Final Spec §25). DamageSystem
      resolves against THIS instead of live source stats when present;
      target mitigation still resolves live at tick. */
  snapshot?: Readonly<Record<string, number>>
}
export interface BuffPeriodicHealRequest {
  instanceId: BuffInstanceId; periodicId: string
  sourceId: CombatEntityId; targetId: CombatEntityId
  amount: number
}
export interface PeriodicResolution {
  requests: readonly (BuffPeriodicDamageRequest | BuffPeriodicHealRequest)[]
}
export interface DamageAuthority {
  /** Intent in, result out. DamageSystem picks the internal channel from
      damageProfile + origin.kind + canCrit/canMiss — NOT the executor and NOT
      a "closest existing method" guess. */
  dealDamage(op: DealDamageOperation['payload'], ctx: CombatAuthorityExecutionContext): { rawDamage: number; hpDamage: number; killed: boolean }
}
export interface GaugeAuthority   { pushGauge(targetId: CombatEntityId, fractionOfMax: number, ctx: CombatAuthorityExecutionContext): { before: number; requestedDelta: number; appliedDelta: number; after: number } }
export interface ResourceAuthority {
  gain(targetId: CombatEntityId, resourceId: string, amount: number, ctx: CombatAuthorityExecutionContext): { before: number; requested: number; applied: number; after: number }
  consume(targetId: CombatEntityId, resourceId: string, amount: number | 'all', ctx: CombatAuthorityExecutionContext): { before: number; requested: number | 'all'; applied: number; after: number }
}
export interface ShieldAuthority  { applyShield(targetId: CombatEntityId, amount: number, ctx: CombatAuthorityExecutionContext): { applied: number; shieldAfter: number } }
export interface HealAuthority    { heal(payload: HealOperation['payload'], ctx: CombatAuthorityExecutionContext): { requested: number; healed: number; after: number } }

// CombatOperationBatchRunner.ts — contract §40–51
export class CombatOperationBatchRunner {
  constructor(
    private readonly preconditions: PreconditionChecker,   // narrow read ports (buff instance lookup, alive check)
  )
  /** Preflight ALL preconditions before any op runs (§40–42 atomic stale-skip). */
  preflight(batch: CombatOperationBatch): boolean
  /** Review r2/r3/r4 — NOT operationsOf(). Deferred entries CANNOT be
      resolved upfront; the runner materializes each at its position via
      BatchResultContext built from prior in-batch CombatOperationResults.
      Materialization PRESERVES deferred.operationId (producer-minted, R-C2).
      The scheduler drives (r5 HIGH 1 — structural BEFORE runtime: a malformed
      command graph is a fault independent of combat state):
        validateBatchStructure(batch)   // r4 BLOCKER 3 — BEFORE any mutation:
          all op/deferred ids unique in-batch AND unreserved globally;
          every deferred resultOperationId → an EARLIER 'deal_damage' entry;
          malformed payloads → CombatSettlementFault (broken command graph)
        reserveOperationId for ALL batch ids ATOMICALLY — a bad id can never
          fault mid-batch after earlier ops already committed
        preflight ALL runtime preconditions (§40–42) — stale → atomic skip
        for entry of batch.operations:
          if deferred:
            prior = resultsCtx.get(entry.resultOperationId)
            prior.status !== 'resolved'
              → record {status:'skipped', reason:'dependency_not_resolved'}
                for entry.operationId; continue                     // r4 HIGH 2
            op = materialize(entry, resultsCtx)
          else op = entry
          result = executor.execute(op, opSink(op))
          resultsCtx.record(op.operationId, result)
          settle immediate consequences before next entry (§43+§55)
    */
  materialize(deferred: DeferredOperation, results: BatchResultContext): ResolvedCombatOperation
}
```

**Scheduler semantics — CORRECTED (contract §55–56 + review):**

```
Scheduler state:
  authoredQueue: ResolvedCombatOperation[]       // authored intent — barrier after EACH op
  rootEventQueue: StampedCombatEvent[]           // events with no parent op (lifecycle/script/proc roots)
  acceptedEventIds: Set<CombatEventId>           // THE dedup point — enqueue only (r4 HIGH 1)
  seenOperationIds: Set<CombatOperationId>       // GLOBAL op-id uniqueness (r3 HIGH)
  eventOrdinalByScope: Map<string, number>       // scope-id → next event ordinal (r5 HIGH 2:
                                                 // shared by ALL sinks of one scope)
  settlementNestingDepth: number                 // recursive guard (event trees, batch frames)
  workThisBarrier: number                        // per-ROOT work budget (r5 HIGH 3)
  state: 'running' | 'faulted'                   // faulted = halt, no more drain
  // EVENT QUEUES ARE PER-EXECUTION, not a single global FIFO (r5 BLOCKER 1):
  // each op execution owns a frame-local event list; those events drain
  // INSIDE that op's barrier — before the op's siblings and before any
  // outer-queued event. Consequence trees are strictly depth-first.

run():
  while authoredQueue or rootEventQueue non-empty:
    if state === 'faulted' → break
    workThisBarrier = 0                            // fresh budget per ROOT unit
    if rootEventQueue non-empty:
      settleEvent(rootEventQueue.shift(), rootEventQueue)   // lifecycle/script root
      continue
    op = authoredQueue.shift()                     // ids already reserved at enqueue
    executeOpWithBarrier(op)
  // quiescent = both empty

executeOpWithBarrier(op):                          // every op — authored, generated,
  opSequence = allocateSeq()                        //   batch, deferred — gets its own
  frameEvents: StampedCombatEvent[] = []           //   frame + its own barrier.
  // r6 BLOCKER — sequence BEFORE execute: an authority emits via opSink DURING
  // execute; allocating here guarantees seq(op) < seq(every event it emits).
  // Allocating after execute inverts causality (E1 stamped 100, its parent
  // op 101) and breaks the canonical total order.
  result = executor.execute(op, opSink(op, frameEvents))
  recordExecution({combatSequence: opSequence, op, result})
  workThisBarrier++; if > maxImmediateWorkPerBarrier → FAULT
  drainEvents(frameEvents)                          // §55: ALL of op's consequences
                                                    // settle before its siblings
drainEvents(frameQueue):
  while frameQueue non-empty and not faulted:
    settleEvent(frameQueue.shift(), frameQueue)

settleEvent(event, frameQueue):
  if ++settlementNestingDepth > maxSettlementNestingDepth → FAULT
  if ++workThisBarrier > maxImmediateWorkPerBarrier → FAULT
  emitted: StampedCombatEvent[] = []
  settlement = handler(event, eventSink(event, emitted))   // handler may emit AND return
  if {kind:'operations'}:
    // r5 BLOCKER 3 — validate + reserve the WHOLE produced group atomically
    // before its first member executes (same rule batches already follow)
    validateGroupIds(ops); reserveAll(ops)
    for op of ops: executeOpWithBarrier(op)         // each op's own frame drains
                                                    // before the next sibling
  if {kind:'batch'}: runBatchFrame(settlement.batch)
  for e of emitted: enqueueInto(frameQueue, e)      // r5 HIGH 4 — handler-emitted
                                                    // events settle AFTER the
                                                    // returned settlement
  settlementNestingDepth--

runBatchFrame(batch):
  if ++settlementNestingDepth > maxSettlementNestingDepth → FAULT
  // r5 HIGH 1 — structural BEFORE runtime: a malformed command graph is a
  // fault independent of combat state; a dead target can't hide a bad batch
  validateBatchStructure(batch):
    every op/deferred operationId unique in-batch AND unreserved globally;
    every deferred resultOperationId references an EARLIER 'deal_damage'
    entry; payload shapes well-formed. Any violation → FAULT
  reserveAllOperationIds(batch)                      // atomic, before any mutation
  preflight ALL runtime preconditions (§40–42):
    any fail → emit skip event-equivalent into frameQueue; zero ops (atomic stale-skip)
  resultsCtx = empty
  for entry of batch.operations:                     // ordered, non-interleaved (§43)
    if deferred:
      prior = resultsCtx.get(entry.resultOperationId)
      prior.status !== 'resolved'
        → resultsCtx.record(entry.operationId, {status:'skipped',
            reason:'dependency_not_resolved'}); continue          // r4 HIGH 2
      op = materialize(entry, resultsCtx)           // preserves deferred.operationId
    else op = entry
    executeOpWithBarrier(op)                          // per-op settle inside frame
    resultsCtx.record(op.operationId, <last result>)
  // nested batches allowed — a batch op's event may return {kind:'batch'};
  // it runs inside this frame via the same settleEvent path
  settlementNestingDepth--

FAULT:  // r3 HIGH 6 + r4 MEDIUM 2 — out-of-band diagnostic, NOT a queued event
  trace.recordFault(reason, digest); diagnosticSink.emit(CombatSettlementFaultEvent)
  state = 'faulted'; halt progression; dev/test: throw CombatSettlementFault
  // reason ∈ {settlement_depth_exceeded, settlement_work_budget_exceeded}
  // NEVER enqueue the fault into any event queue; NEVER retro-fail committed ops.

enqueueEvent(pending, targetQueue):                  // THE dedup point (r4 HIGH 1)
  if acceptedEventIds.has(pending.eventId) → return  // stamped once
  acceptedEventIds.add(pending.eventId)
  stamp {combatSequence: allocateSeq()} → push onto targetQueue
  // targetQueue = the emitting scope's frame list (op-local frameEvents /
  // handler's emitted list / rootEventQueue for lifecycle sinks) — the
  // scheduler routes it; there is no shared global immediateQueue.

reserveOperationId(id): seenOperationIds.has(id) → structural fault throw;
  else add. Called per-GROUP atomically — enqueueAuthored (whole list),
  handler-returned op lists (before first op), batches (reserveAll after
  structural validation). (r5 BLOCKER 3 — a produced group never commits its
  first op then discovers a bad id in a later sibling.)

Sink factories (r5 HIGH 2):
  createOperationSink(op, frameEvents)     // internal — scopeId = op.operationId
  createEventSink(event, emitted)          // internal — scopeId = event.eventId
  createLifecycleSink(rootActionId)        // PUBLIC — buff lifecycle/proc roots;
                                           // v7.1: also allocates the root's
                                           // combatSequence → {sink, sequence}
  // Every sink mints evt.${scopeId}.${eventOrdinalByScope[scopeId]++} + the
  // scope's causation id (op → causationOperationId, event → causationEventId,
  // lifecycle → none) and calls enqueueEvent with its target list. Ordinals
  // live in the scheduler-owned map so two sinks for one scope never collide.

// Periodic bridge (r4 BLOCKER 2): scheduler ctor registers a BUILT-IN handler
// for 'periodic_requests_committed' → {kind:'operations'} — converts each
// typed request 1:1: BuffPeriodicDamageRequest → DealDamageOperation{payload},
// BuffPeriodicHealRequest → HealOperation{amount}; ids `periodic.${eventId}.${i}`;
// each op mints its OWN origin (r5 BLOCKER 2):
//   {kind:'buff_periodic', originId:`${req.instanceId}:${req.periodicId}`,
//    sourceId:req.sourceId, rootActionId:event.rootActionId,
//    causationEventId:event.eventId}
// The scheduler is the PRODUCER here (R-C2 consistent). Lifecycle ticks emit
// the same event via a lifecycle sink — one lane for both triggers.
```

Key invariants (review-locked): `rootEventQueue` drains before `authoredQueue` — an authored op's consequences always settle before the next authored op (§55). Consequence trees are strictly depth-first via per-execution event frames: an op's emissions settle inside ITS barrier before siblings and before outer queued events — canonical order `E1 → X → E3 → Z → Y → E2` (r5 BLOCKER 1; a global FIFO produces `E1 → X → E2 → E3`, which is WRONG). Handler-emitted events settle AFTER the handler's returned settlement (r5 HIGH 4). Batch ops get the same frame isolation — outer events cannot interleave mid-batch (§43). **`combatSequence` semantics (r6):** the number is chronological creation/execution-start order — ops stamp at execution-start, events at enqueue-commit. It is NOT a depth-first completion order: `A=1, E1=2, E2=3, X=4` settles `A→E1→X→E2`. Causality lives in the causation fields; trace/debug trees must be built from `causationOperationId`/`causationEventId`/`rootActionId`/`parentOperationId`, never by sorting on `combatSequence`.

- [ ] **Step 1 — Failing tests (executor):** each op type → its port once, payload+origin intact; **missing port → throw (structural fault), NOT a typed `failed` result** (contract §50 — broken wiring is not a combat outcome); result payloads populated (`push_gauge` returns before/after).
- [ ] **Step 2 — Failing tests (scheduler — the corrected semantics):**
  - `authored A → emits event → handler returns ops X,Y → X,Y complete BEFORE authored B runs` (THE regression guard for the review blocker — old pseudocode ran B first).
  - **depth-first consequence frames (r4+r5 BLOCKER 1):** handler returns [X,Y]; X emits E2 whose handler returns [Z] → observed order is `X, Z, Y` — NEVER `X, Y, Z` (a shared FIFO produces the wrong order).
  - **nested event isolation (r5 BLOCKER 1 — THE guard):** authored A emits E1,E2; E1's handler returns [X]; X emits E3 whose handler returns [Z] → order `E1, X, E3, Z, Y-sibling…, E2` — E3 settles inside X's barrier BEFORE E2 (a global FIFO produces `E1, X, E2, E3` = FAIL). Batch variant: E1 → batch[B1,B2]; B1 emits E3; E2 queued outside → `B1, E3's ops, B2, E2` — E2 never interleaves mid-batch.
  - **Option B lock (r4 MEDIUM):** op emits E1,E2 where E1's handler produces X → order `E1-handler, X, E2-handler` — an event's consequence tree settles before the next queued event's handler runs (handlers observe post-consequence state).
  - **handler-emitted ordering (r5 HIGH 4):** handler emits E_child AND returns ops [X] → X's frame completes before E_child is settled (returned settlement before handler emissions).
  - **group-atomic reservation (r5 BLOCKER 3):** `enqueueAuthored([A,B])` where B's id already exists → fault BEFORE A executes (spy authority sees zero calls); handler returns [X,Y] where Y's id collides → fault before X runs; batch duplicate → fault before first batch op.
  - **lifecycle root (r5 HIGH 2+3):** `createLifecycleSink('status.turn.5.p')` emits `PeriodicRequestsCommitted` while the scheduler is quiescent → built-in handler converts requests → ops carry per-request `origin{sourceId:req.sourceId, causationEventId}` and fresh work budget; two sinks for the same rootActionId mint distinct eventIds (shared `eventOrdinalByScope` counter).
  - chained immediate consequences (op → event → op → event) fully drain before next authored op.
  - exactly-once (r4 HIGH 1): dedup lives ONLY at `enqueueEvent` — duplicate delivery is never stamped twice (assert only one stamped event exists), drain does not re-check.
  - scoped sink (r4 MEDIUM 3): authority emits two same-type payloads envelope-free → stamped events carry `evt.OP.0`/`evt.OP.1` + `causationOperationId === op.operationId` — no manual ordinals in the authority.
  - causal edge: authority-emitted event carries `causationOperationId`; handler-emitted event carries `causationEventId` — trace shows op→event→op without string parsing.
  - **global op-id uniqueness (r3 HIGH):** authored-vs-authored collision throws; authored-vs-immediate collision throws; batch-vs-deferred collision throws.
  - **batch structural preflight (r4 BLOCKER 3):** batch containing a duplicate op id / a deferred ref to a nonexistent id / a deferred ref to a LATER entry / a deferred ref to a non-`deal_damage` entry → `CombatSettlementFault` BEFORE any op executes (spy authority sees zero calls — a broken command graph is not a runtime invalidation).
  - deferred runtime dependency (r4 HIGH 2): referenced damage op `skipped` → deferred entry records `{status:'skipped', reason:'dependency_not_resolved'}` — never a silent heal-0.
  - deferred op happy path: materializes using prior in-batch results (fake damage result → heal amount derived); materialized op KEEPS the deferred `operationId`.
  - **periodic bridge (r4 BLOCKER 2 + r5 BLOCKER 2):** stub authority emits `PeriodicRequestsCommitted` via `ctx.events` → built-in handler returns ops → `deal_damage`/`heal` settle in the same barrier with ids `periodic.${eventId}.${i}` and per-request `origin{kind:'buff_periodic', sourceId:req.sourceId, rootActionId:event.rootActionId, causationEventId}`; a lifecycle-scoped sink emits the same event shape; an event carrying requests from MULTIPLE sourceIds produces ops with distinct correct sourceIds (no fabricated shared origin).
  - batch frame: preflight fail → zero ops + skip event; preflight pass → ops run in order, per-op settle, authored ops can't interleave mid-batch; nested batch runs to completion inside parent frame.
  - sequence ownership: events stamped by scheduler (authorities emit pending events with no envelope); ops' `combatSequence` allocated at execution-START before `executor.execute()` (r6 — locked, not a choice).
  - **sequence causality (r6 BLOCKER — THE guard):** op A emits E1,E2; E1's handler produces X → assert `seq(A) < seq(E1)`, `seq(A) < seq(E2)`, `seq(E1) < seq(X)` — a cause's sequence always precedes its effects'. (The v6 bug stamped `E1 < A` because the op's sequence was allocated after `execute` returned.)
  - **trace tree vs chronology (r6):** A emits E1,E2; E1→X; X→E3 → sequences `A1,E1=2,E2=3,X=4,E3=5`; assert `CombatTrace.toString()` renders the causal tree `A├E1├X└E3└E2` (parenting by causation fields) — NOT a flat `A,E1,E2,X,E3` sequence sort.
  - **dual guard (r3 HIGH 5):** recursive nesting past `maxSettlementNestingDepth` → fault; FLAT op→event→op→event chain past `maxImmediateWorkPerBarrier` → fault; fault `reason` distinguishes the two (`settlement_depth_exceeded` vs `settlement_work_budget_exceeded`).
  - fault is out-of-band (r3 HIGH 6): `trace.recordFault` + `diagnosticSink.emit` called; NO event queue receives `CombatSettlementFaultEvent` (a halted scheduler can't drain it); scheduler state → faulted; committed op stays `resolved`.
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

**Damage adapter rule (review-locked):** `dealDamage(payload, ctx)` dispatches on `damageProfile` with `origin` as context — the PROFILE owns the formula (r4 HIGH 4: infrastructure does NOT hard-code `origin ⇒ channel`; a `buff_periodic` op is not automatically DoT — poison/burn/bleed/scripted-pulse profiles may each choose different economies).
- `damageProfile: 'legacy_dot'` → DoT channel (`applyDotDamage` — dotResistance/dotRecovery economy; the migration maps existing periodic defs to this profile to preserve behavior).
- `damageProfile: 'reaction_*'` (origin.kind `'reaction'`) → **reaction channel**: a new explicit path (e.g. `applyReactionDamage` or profile-routed) — NEVER `applyDotDamage` (that would consume `dotResistancePercent`, fire `dotRecovery`, and report reason `'dot'`). The infrastructure layer does NOT pin the formula (review r2 HIGH 5): mitigation/resistance/final-damage layers are the profile's decision — the contract only guarantees the channel is distinct from DoT and honors `canCrit:false`.
- standard hit profiles (`origin.kind 'skill'|'proc'`) → hit channel (`applyModifiedDirectDamage` semantics).
The adapter is allowed to ADD a `CombatSystem` method for the reaction channel if none exists — record as a contract extension in the mission report.

- [ ] **Step 1 — Failing tests:** `{origin.kind:'reaction', canCrit:false}` → reaction channel (assert it does NOT consume `dotResistancePercent` / does NOT trigger `dotRecovery` / reports `reason:'reaction'`); gauge adapter signed-clamps negative pushback at 0 and caps at `GAUGE_MAX`; resource `consume('all')` reports `{before, requested:'all', applied, after}`.
- [ ] **Step 2 — Implement.**
- [ ] **Step 3 — Verify (P3 quick).**

**Exit criteria:** every port has ≥1 real adapter (buffs excepted by design); damage adapter proves the representative PROFILES (`legacy_dot` / `reaction_*` / standard hit) route to their intended channels — profile dispatches, origin is context (r5 MEDIUM 1).

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
- Create: `game/src/core/battle/runtime/scheduler/CombatSettlementFault.ts` + `CombatTraceExporter.ts` (§85 tree dump, dev only) + `diagnosticSink` (out-of-band fault lane — review r3 HIGH 6)
- Modify: `game/docs/systems/combat-overview.md`, `roadmap.md`
- Test: `CombatScheduler.test.ts` extension — fault records diagnostic + halts, never retro-fails committed ops

- [ ] **Step 1 — Fault semantics test:** committed op → event chain overflows (nesting OR work budget) → `trace.recordFault` + `diagnosticSink.emit(CombatSettlementFaultEvent)` + `state=faulted` + halt; the fault event NEVER lands on ANY event queue (a halted scheduler can't drain it — review r3 HIGH 6); the committed op's result stays `resolved` (R9-revised).
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

1. RESOLVED (review r2 + r6): `combatSequence` stamped by scheduler at `enqueueEvent` commit (events) / **execution-START** (ops — allocated before `executor.execute()` so an op's sequence precedes the events it emits; lives on `CombatExecutionRecord` in the trace, NOT on the op). Every executed op + every stamped event gets one; enqueued-but-never-executed ops get none. Semantics: chronological creation/execution-start order — the causal tree comes from causation fields, not sequence order.
2. RESOLVED (review r3): `PreconditionChecker` stays YAGNI — `buff_participant` + `entity_alive` only; add `resource_at_least`/`stacks_at_least` when a real atomic batch needs it.
3. RESOLVED (review r2): explicit reaction damage channel accepted (e.g. `applyReactionDamage`), but the infrastructure plan does NOT pin mitigation/resistance rules — `damageProfile` owns the formula.
4. RESOLVED (review r4, corrected): Xuyên Thổ's "cap 25%" clamps the heal RATIO (`min(0.05·D, 0.25)` — evaluated by StackExpr at resolution time, D≤5 makes it a natural boundary), NOT a max-Hp clamp — `capFractionOfHealTargetMaxHp` was removed from both `DeferredOperation` and `HealOperation` (YAGNI, no real consumer).
