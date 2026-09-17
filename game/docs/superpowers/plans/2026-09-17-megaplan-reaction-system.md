# Reaction System Reimagined — Implementation Megaplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Non-trivial production missions MUST follow `game/docs/architecture/architecture-worker-workflow.md` (G0–G5) and return the G5 evidence report.

**Goal:** Build the capability-gated Ngũ Hành reaction engine for Ngộ Đạo (hidden Pháp Tu): same-source/same-target reaction board, Sinh `P²` / Khắc `A×D` deterministic candidate selection, consume-all semantics, snapshot+precondition atomicity, and pure `ResolvedCombatOperation` emission — shipped **inert** (nothing in production grants `elemental_reaction_enabled`) and **fully test-covered** on fixture element/ailment ids.

**Architecture:** New module `game/src/core/reaction/` — a read-only evaluator (`ReactionSystem`) that observes committed `ElementalApplicationCommitted` events through `ReactionTriggerGate`, reads a same-source board via `ElementalBoardQuery`, selects ONE candidate by fixed-point weight, freezes participants into a `ReactionContext` snapshot, and emits a `ReactionResolution` (preconditions + ordered operations). A `ReactionBatchRunner` executes the batch through `CombatOperationExecutor`: preflight preconditions → consume-first → payoff order → typed skips, no rollback. Cấm Công lands as a `forbiddenActionTags:['attack']` buff enforced by a new `ActionValidator` in the turn engine. All payoff content lives in `game/src/data/reaction/` as data — the 10 canonical relations bound to **test fixture buff ids** (real ấn ids deferred to the seal batch).

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser.

**Specs:**
- `game/docs/specs/2026-09-17-reaction-system-reimagined-spec.md` (v1.0 — reaction semantics)
- `game/docs/specs/2026-09-17-combat-systems-contract-spec.md` (v1.1 — **SUPERSEDES** two spec points: `reactionEligibility` is runtime metadata on `ApplyBuffRequest`, and tie-break uses authored `selectionTiePriority` — lexical ReactionId ordering is forbidden)
- `game/docs/specs/2026-09-17-buff-system-reimagined-spec.md` (v1.0 — consumed API: `ApplyBuffRequest`/`ApplyBuffResult`, `ConsumeStacksResult`, `BuffInstanceSnapshot`, removal reason `'reaction'`, modifier `reapply:'max'` + `buff_lifetime`, `forbiddenActionTags`)
- `game/docs/specs/2026-09-17-hoa-an-ailment-system-spec.md` (context only — real ailments NOT authored here)

**Sibling-plan dependency:** This megaplan is the code-level expansion of the ReactionSystem scope inside `game/docs/superpowers/plans/2026-09-17-combat-systems-reimagined.md` (its M6). **Hard prerequisite:** that program's M1 (contracts), M2 (scheduler/executor) and M3 (BuffSystem core with the §51/§67 query+mutation surface) must have landed. M0 verifies presence; if absent, this plan is BLOCKED — do not create parallel contract types under `core/reaction/`.

## Global Constraints

- **Engine ships INERT (R7 — ruling assumption, pending user sign-off):** `elemental_reaction_enabled` is granted by nothing in production. No `TurnBattleSystem`/`GameManager*` wiring of the reaction trigger in this program. All coverage is Vitest-level on fixture content. The engine's existence must be invisible to production combat.
- **Legacy reaction path untouched (R3 — ruling assumption, pending user sign-off):** `TurnReactionManager` (`src/core/battle/turn/TurnReactionManager.ts`, rules engine over `WuxingRelations`) keeps serving visible Pháp Tu via `canInitiateWuxingReactions` (`TurnBattleSystem.ts:137`, stamped at `TurnBattleAdapter.ts:60`). Do not delete, reroute, or weaken it — the visible-Pháp Tu reaction-removal ruling executes in the seal batch, not here.
- **No ấn authoring:** `hoa_an`/`han_tuc`/`doc_can`/`liet_thuong`/`tran_an` definitions and real payoff tuning are seal-batch scope. This program binds elements to fixture ids `test_seal_fire`/`test_seal_water`/`test_seal_wood`/`test_seal_metal`/`test_seal_earth` and secondary statuses to `test_bleed`/`test_defense_break`/`test_defense_erosion`/`test_cam_cong`.
- **Zero RNG in the reaction engine (INV-R17):** no `Math.random()`, no `CombatRng` injection — selection is pure fixed-point math. Randomness enters only upstream (random cast, application roll).
- **No mutation:** `ReactionSystem` never mutates buff/damage/gauge state. All state change requests are `ResolvedCombatOperation`s executed by `CombatOperationExecutor` → domain authority. Forbidden: `buff.stacks = 0`, direct `target.hp` writes, `actionGauge` writes (contract §8, §89).
- **No core special cases (CON-23):** no `if (reaction.id === 'dung_kim')`, no path/`phap_tu_an` imports, no element-id branches in engine code — relations and payoffs are data.
- **Operation emission, not execution:** `ReactionSystem` produces `ReactionResolution`; `ReactionBatchRunner` owns preflight + ordered execution + typed skips; `CombatScheduler` owns `combatSequence` and settlement barriers (never allocated inside this module).
- **P3 verification:** `quick` (default) = `npm run type-check` + `npx vitest run <scope>` from `game/`. `full` = `npm run type-check` + `npm run build` + `npx vitest run` — mandatory for M4 (touches `TurnSkillAction.ts`/`TurnBattleSystem.ts` battle runtime selection path).
- **P4:** adversarial QA (quick) after every production mission; deep for M4 (ActionValidator lands in the live action-selection path).
- **P5:** three-lens review round per mission; every finding gets severity; Medium+ blocks completion.
- **P7:** commit steps describe granularity only — every commit needs explicit user authorization.
- **P13/P14:** M4 touches `core/battle/turn/**` action selection — drive a real battle via Playwright (`npm run dev`, actual port) confirming an unsealed actor still selects normally before merge-ready.
- **Per-mission report:** changed / files / authority moved / adapters remaining / tests / build status / behavior changes (=None unless approved) / risks / next.

## Canonical names (locked across sibling plans — spell identically)

**Consumed (owned by foundation/sibling plans — import, never redefine):**
`CombatOperation`, `ResolvedCombatOperation`, `CombatOperationResultBase`, `CombatOperationOrigin`, `CombatScheduler`, `combatSequence`, `ElementalApplicationCommitted` (with `addedStacks`, `reactionEligibility`, `eventId`, `origin`), `ReactionEligibility` (`'eligible' | 'suppressed'`), `CombatCapabilityQuery`, `ElementalStateRegistry` (interface shape from contract §19 — this plan owns its file + impl), `ApplyBuffRequest` (has `reactionEligibility` + `origin`), `ConsumeStacksResult`, `BuffInstanceSnapshot`, removal reason `'reaction'`, modifier `reapply:'max'` + lifetime `'buff_lifetime'`, `forbiddenActionTags`.

**Produced (owned by this plan):**
`ReactionId`, `ReactionRelation`, `ReactionDefinition`, `ReactionElementRelation`, `ReactionPayoffStep`, `StackExpr`, `ReactionRegistry`, `CANONICAL_REACTIONS`, `ReactionBoard`, `ElementalBoardQuery` (impl), `ReactionCandidate`, `NormalizedReactionBias`, `ReactionBias`, `ReactionBiasQuery`, `ReactionContext`, `ReactionParticipantSnapshot`, `ReactionParticipantPrecondition`, `ReactionResolution`, `ReactionEvaluationResult`, `ReactionGateVerdict`, `ReactionTriggerGate`, `ReactionOperation`, `ReactionBatchRunner`, `ReactionBatchOutcome`, `ReactionResolvedEvent`, `ReactionSkippedEvent`, `ReactionDispatcher`, `ReactionEvaluationTrace`, `ActionValidator` (turn-engine), `selectionTiePriority`, `elemental_reaction_enabled` (capability id constant), `REACTION_MAX_STACKS = 5`, `BIAS_SCALE = 10_000`.

## Ruling assumptions — pending user sign-off

| # | Assumption | Rationale |
|---|---|---|
| R3 | Legacy `TurnReactionManager` + `canInitiateWuxingReactions` stay live and untouched until the seal batch lands real ấn ids + the capability grant. Deletion scheduled there, not here. | New engine is inert without seals; removing legacy now deletes visible-Pháp Tu gameplay with no replacement. Matches sibling plan R3. |
| R7 | Engine lands capability-ungranted: inert in production, fully test-covered. | Deferred-grant is explicit architecture (`CombatCapabilityQuery` port exists; nothing calls `.has()` in production until seals). Matches sibling plan R7. |
| R-A | `DealReactionDamageOperation` (the reaction damage op) declares `damageProfile: 'reaction_damage'`, `element: <attacker element>` (the Khắc overcomer), `canCrit: false`, `origin.kind: 'reaction'`. | Spec silent on element/profile; attacker-element preserves the legacy Khắc Chế semantic ("damage on the overcomer element, target resistance applies"). **Provisional — flag for balance pass.** Alternative: elementless true damage. |
| R-B | Xuyên Thổ heal cap "25%" = `0.25 × source.maxHp` (caster-side sustain cap), heal target = `sourceId`. | Spec says "cap 25%" without naming the base; source-maxHp is the conventional sustain cap. **Provisional.** |
| R-C | Dưỡng Kim "Kim penetration `+4%×P`" maps to modifier channel `'potency'` (multiply `1 + 0.04×P`) on the child Liệt Thương instance. | `BuffModifierChannel` has no `'penetration'` channel (buff spec §30); potency is the generic magnitude channel. **Provisional** — seal batch may add a stat/peneration channel. |
| R-D | `elementBias` in `ReactionBias` keys on the relation's *agent* element: Sinh → parent element, Khắc → attacker element. | §55 "prefer Hỏa-related reaction" needs a deterministic key; trigger-element keying boosts all 4 candidates equally (no discrimination). Baseline = 1.0 either way. **Provisional.** |
| R-E | A sealed actor with NO legal action produces an empty turn (`action: null`, `skillId: ''` — same shape as the existing no-action return), not a stun flag. | Cấm Công ≠ stun (contract §72): the actor keeps its turn cadence; "no legal action" is a selection outcome, not a CC block. **Provisional.** |
| R-E2 | `actionTags` inference: a `TurnSkillDefinition` without authored `actionTags` counts as `['attack']` iff it carries `damage`; the slot-less fallback basic (`skillId 'basic_attack'`, `skill: null`) is always `['attack']`. | No `tags` taxonomy exists on `TurnSkillDefinition` today; inference makes the seal meaningful against unannotated content. Explicit `actionTags` always wins. **Provisional** — real tag taxonomy lands with the skill-definition pipeline. |
| R-F | `operationId`s emitted by `ReactionSystem` are deterministic: `rx.${event.eventId}.${reactionId}.${index}` — INCLUDING `DeferredOperation` entries (contract v4: deferred ops carry their own pre-minted `operationId`; materialization preserves it). `combatSequence` is NEVER copied — the scheduler stamps each op's sequence at execute time onto `CombatExecutionRecord` and each event's at `enqueueEvent` (sole allocator; contract v3+). | Contract §12/§13 — uniqueness within the trace, derivable without inventing sequence numbers. Scheduler asserts global uniqueness via `reserveOperationId` on every path (contract v4 — authored/immediate/batch/deferred all reserve). |

---

## Mission 0 — Inventory + prerequisite verification (read-only)

**Files:**
- Create: `game/docs/architecture/2026-09-17-reaction-inventory.md`

- [ ] **Step 1 — Lock baseline:** record `git rev-parse HEAD` in the inventory doc; all "current state" claims reference this SHA.
- [ ] **Step 2 — Verify foundation prerequisites (BLOCKING):** confirm these exist and compile:
  - `game/src/core/battle/contracts/operations.ts` — `CombatOperation` union incl. `ConsumeBuffStacksOperation`, `AddBuffStacksOperation`, `AddBuffModifierOperation`, `ExtendBuffDurationOperation`, `ApplyBuffOperation`, `PushGaugeOperation`, `HealOperation`, `DealDamageOperation`; `CombatOperationOrigin`; `ResolvedCombatOperation`; `ReactionEligibility`
  - `game/src/core/battle/contracts/results.ts` — `CombatOperationResultBase` + per-op result payloads (incl. damage `rawDamage`/`hpDamage` on the damage result — needed by Xuyên Thổ heal)
  - `game/src/core/battle/contracts/settlement.ts` — `ImmediateSettlement` union (`{kind:'operations'}` / `{kind:'batch'}`) + `CombatOperationBatch` (preconditions + ordered ops) + `DeferredOperation` (declarative primitive carrying its own pre-minted `operationId` + `origin`, materialized from prior in-batch results via `BatchResultContext` — the `heal_from_damage` vehicle; SUPERSEDES the earlier `HealOperation.fractionOfOperationResult` idea — the executor never resolves refs)
  - `game/src/core/battle/contracts/events.ts` — `ElementalApplicationCommitted` (fields: `eventId`, `instanceId`, `sourceId`, `targetId`, `definitionId`, `element`, `stacksBefore/After`, `requestedStacks`, `addedStacks`, `reactionEligibility`, `origin`, `combatSequence`)
  - `game/src/core/battle/contracts/capability.ts` — `CombatCapabilityQuery { has(entityId, capabilityId): boolean }`
  - `game/src/core/battle/runtime/scheduler/` — `CombatScheduler` (sequence allocation, settlement barrier, exactly-once `eventId` dedup, `reserveOperationId` global uniqueness), `CombatOperationExecutor`, `BuffAuthority`/`DamageAuthority`/`GaugeAuthority` ports (all taking `CombatAuthorityExecutionContext`), `contracts/context.ts`
  - `game/src/core/buff2/` (or wherever the new engine landed) — `BuffSystem` with `getInstance`/`getForTarget`/`getByDefinition`/`getStacks`/`consumeStacks`/`addStacks`/`addModifier`/`extendDuration`/`apply`; `BuffDefinition` carrying `forbiddenActionTags`; `BuffInstanceSnapshot` with `instanceId`
  - If any are missing: **report BLOCKED to coordinator.** The foundation plan owns those names; do not stub them locally.
- [ ] **Step 3 — Legacy reaction inventory:** `TurnReactionManager.checkAndTrigger` call site (`TurnBattleSystem.ts:2978` inside `applySkillAilments`, gated by `initiatesReactions` ← `actor.canInitiateWuxingReactions` at `TurnBattleSystem.ts:1441`), the two-phase sinh/khắc loop, `KHAC_CHE_COEFF`/`CONG_MINH_AMP`, `scaleBuffPotency` usage. Record that `docs/systems/elements-reactions.md` is STALE — it references `core/element/ElementReaction.ts` (`ELEMENT_REACTIONS`), `core/element/ReactionManager.ts`, `core/element/ElementLoadout.ts`, none of which exist (rule engine `WuxingRelations.ts` + `TurnReactionManager.ts` is the live path).
- [ ] **Step 4 — Turn-engine seams:** `selectAction`/`selectForcedAction` (`TurnSkillAction.ts:500`/`:536`, called at `TurnBattleSystem.ts:1241–1243`), `FALLBACK_BASIC_ATTACK` (`TurnSkillAction.ts:426`), `applySkillAilments` (`:2939`), `enqueueFollowUpExecutions` multicast roll (`:2217–2263`), `resolveDeclaredHit` (`:1863` ailment call), `ActionGauge` API (`GAUGE_MAX=1000`, `refundGauge` positive-only — pushback needs negative-delta support on the gauge authority port).
- [ ] **Step 5 — Capability candidates:** document the existing precedent — `TurnBattleParticipant.canInitiateWuxingReactions` (participant flag stamped at battle build from `activeStatDomains.includes('phap_tu')`, `TurnBattleAdapter.ts:60`), `resolvePathRuntime` seam (`GameManagerTurnBattleOps.ts:831`), buff `capabilities` descriptors (buff spec §47). Recommend: `CombatCapabilityQuery` impl = battle-build participant flag map → later buff capability descriptors. `elemental_reaction_enabled` stays ungranted.
- [ ] **Step 6 — Damage/vitals seam:** `CombatSystem.applyModifiedDirectDamage(target, raw, attacker, reason)` / `applyDirectDamage` / `applyHealing` (`CombatSystem.ts:147–168`); `VitalsChangeReason` already includes `'reaction'` (`EntityVitalsSystem.ts:5`) — no new reason needed; `elementalBasePower(source, element)` (`ElementDamageCalculator.ts:23`) is the base-power input the `reaction_damage` profile resolves; `getResistanceMitigationPercent` (`Resistance.ts:19`).
- [ ] **Step 7 — Write the authority matrix + ruling-assumption table** (R3, R7, R-A…R-F) into the inventory doc; flag every "provisional" for user sign-off.

**Exit criteria:** baseline SHA recorded; every prerequisite verified present (or plan reports BLOCKED); legacy trigger path + capability seams documented with file:line; ruling table written for sign-off.

---

## Mission 1 — ElementalStateRegistry + ReactionDefinition/Registry + ReactionBoard + ReactionTriggerGate

**Files:**
- Create: `game/src/core/reaction/ReactionTypes.ts`
- Create: `game/src/core/reaction/ElementalStateRegistry.ts`
- Create: `game/src/core/reaction/ReactionDefinition.ts`
- Create: `game/src/core/reaction/ReactionRegistry.ts`
- Create: `game/src/core/reaction/ReactionBoard.ts`
- Create: `game/src/core/reaction/ReactionTriggerGate.ts`
- Create: `game/src/core/reaction/testing/ReactionTestFixtures.ts` — fixture world builder + fixture buff ids
- Test: `game/src/core/reaction/ElementalStateRegistry.test.ts`, `ReactionRegistry.test.ts`, `ReactionBoard.test.ts`, `ReactionTriggerGate.test.ts`

**Interfaces — Consumes:**
```ts
// from game/src/core/battle/contracts/events.ts (foundation M1)
interface ElementalApplicationCommitted {
  eventId: string
  instanceId: BuffInstanceId
  sourceId: CombatEntityId
  targetId: CombatEntityId
  definitionId: BuffDefinitionId
  element: ElementType
  stacksBefore: number
  stacksAfter: number
  requestedStacks: number
  addedStacks: number
  reactionEligibility: ReactionEligibility   // 'eligible' | 'suppressed' — contract §14
  origin: CombatOperationOrigin
  combatSequence: number
}
// from contracts/capability.ts
interface CombatCapabilityQuery { has(entityId: CombatEntityId, capabilityId: string): boolean }
// from new BuffSystem (buff spec §51) — narrow surface actually consumed:
//   getInstance(selector: { instanceId } | { definitionId; sourceId; targetId }): BuffInstanceSnapshot | undefined
//   BuffInstanceSnapshot { instanceId, definitionId, sourceId, targetId, stacks, remaining? }
```

**Interfaces — Produces:**
```ts
// ReactionTypes.ts
type ReactionId = string
type ReactionRelation = 'sinh' | 'khac'
type ReactionParticipantRole = 'parent' | 'child' | 'attacker' | 'defender'

interface ReactionBoard {
  sourceId: CombatEntityId
  targetId: CombatEntityId
  fireStacks: number
  waterStacks: number
  woodStacks: number
  metalStacks: number
  earthStacks: number
  /** Live instance per element present on the board (stacks > 0). Needed for participant snapshots. */
  readonly instances: Readonly<Partial<Record<ElementType, BuffInstanceId>>>
}

type ReactionGateVerdict =
  | 'evaluate'            // all gates passed
  | 'not_elemental'       // definitionId not registered in ElementalStateRegistry (defense-in-depth)
  | 'suppressed'          // reactionEligibility !== 'eligible'
  | 'no_stack_gain'       // addedStacks <= 0 (pure refresh / failed add)
  | 'capability_missing'  // source lacks 'elemental_reaction_enabled'

const ELEMENTAL_REACTION_CAPABILITY = 'elemental_reaction_enabled' as const
const REACTION_MAX_STACKS = 5 as const

// ElementalStateRegistry.ts — contract §19
interface ElementalStateRegistry {
  getDefinitionId(element: ElementType): BuffDefinitionId
  getElement(definitionId: BuffDefinitionId): ElementType | null
}
function createElementalStateRegistry(
  mapping: Readonly<Record<ElementType, BuffDefinitionId>>,
): ElementalStateRegistry   // throws unless all 5 elements mapped + all ids distinct

// ReactionBoard.ts — contract §26
interface ElementalBoardQuery {
  read(sourceId: CombatEntityId, targetId: CombatEntityId): ReactionBoard
}
class BuffSystemBoardQuery implements ElementalBoardQuery {
  constructor(buffs: BuffReadPort, elements: ElementalStateRegistry)
}

// ReactionTriggerGate.ts — contract §23 order is LOCKED
class ReactionTriggerGate {
  constructor(capabilities: CombatCapabilityQuery, elements: ElementalStateRegistry)
  check(event: ElementalApplicationCommitted): ReactionGateVerdict
}
```

Gate chain (contract §23 — order matters, first failure wins the verdict):
```
event.reactionEligibility === 'eligible'   → else 'suppressed'
elements.getElement(event.definitionId) === event.element  → else 'not_elemental' (structural guard)
event.addedStacks > 0                      → else 'no_stack_gain'
capabilities.has(event.sourceId, 'elemental_reaction_enabled') → else 'capability_missing'
→ 'evaluate'
```

**Fixture module** (`testing/ReactionTestFixtures.ts`) — the ONLY place fixture ids live:
```ts
export const TEST_ELEMENT_BUFF_IDS: Record<ElementType, string> = {
  fire: 'test_seal_fire', water: 'test_seal_water', wood: 'test_seal_wood',
  metal: 'test_seal_metal', earth: 'test_seal_earth',
}
export const TEST_STATUS_BUFF_IDS = {
  bleed: 'test_bleed', defenseBreak: 'test_defense_break',
  defenseErosion: 'test_defense_erosion', camCong: 'test_cam_cong',
} as const

// createReactionTestWorld(): real new-BuffSystem over fixture BuffDefinitions
//   (5 elemental defs: kind 'ailment', element, instanceScope 'per_source',
//    stacking { maxStacks: 5, add/refresh }, lifetime holder_turns duration 3)
//   + 4 status defs (test_cam_cong carries forbiddenActionTags: ['attack'])
//   + fixture registry + scripted CombatRng + stub scheduler/executor
// Helpers: world.applyElement(sourceId, targetId, element, stacks) — routes a
//   real ApplyBuffRequest with reactionEligibility 'eligible' and returns the
//   fabricated ElementalApplicationCommitted the committed apply produced.
```

- [ ] **Step 1 — Failing tests (registry):** `createElementalStateRegistry` throws on missing element / duplicate id / non-element key; `ReactionRegistry` startup validation throws on: duplicate `ReactionId`, duplicate `selectionTiePriority`, sinh def missing parent+child, khắc def missing attacker+defender, self-element relation (parent===child etc.), element not in registry mapping, referenced payoff buff id unknown (`buffExists` predicate), graph not covering all 5 canonical sinh + all 5 canonical khắc pairs, more than one def per canonical pair (contract §82 + spec §62–63).
- [ ] **Step 2 — Failing tests (board):**
  - `reads same-source stacks only` — source A has `test_seal_fire ×3`, source B has `test_seal_metal ×5` on the same target → `read(A, target)` reports `fireStacks:3, metalStacks:0`; `read(B, target)` reports `fireStacks:0, metalStacks:5` (spec §7, contract §27 / required test §76).
  - `board is per (source,target) pair` — same source's stacks on target 1 vs target 2 isolated.
  - `instances` carries the live `instanceId` per element; empty when stacks 0.
  - non-elemental buffs (e.g. `test_bleed`) never appear on the board.
- [ ] **Step 3 — Failing tests (gate):** order-verified verdicts — `suppressed` eligibility → `'suppressed'` even with `addedStacks>0` and capability; `addedStacks:0` → `'no_stack_gain'`; capability absent → `'capability_missing'`; all pass → `'evaluate'`; unregistered `definitionId`/`element` mismatch → `'not_elemental'`. Capability queried ONLY after the earlier gates (spy on `CombatCapabilityQuery.has` to prove order).
- [ ] **Step 4 — Implement** `ElementalStateRegistry`, `ReactionBoard`/`BuffSystemBoardQuery`, `ReactionTriggerGate`, `ReactionTypes.ts` shells, `ReactionDefinition.ts` types (full shape below — payoff union can be type-only this mission, populated in M4), `ReactionRegistry` + `validateReactionDefinitions(defs, elements, buffExists)`.
- [ ] **Step 5 — Verify (P3 quick):** `npm run type-check` + `npx vitest run src/core/reaction`.

```ts
// ReactionDefinition.ts — contract §81 + spec §61
interface ReactionElementRelation {
  parent?: ElementType    // sinh only
  child?: ElementType     // sinh only
  attacker?: ElementType  // khac only
  defender?: ElementType  // khac only
}

interface ReactionDefinition {
  id: ReactionId
  relation: ReactionRelation
  /** Authored, UNIQUE within the registry — tie-break level 3 (contract §33). Never id-derived. */
  selectionTiePriority: number
  elements: ReactionElementRelation
  payoff: ReactionPayoffDefinition  // authored ordered steps — M4
}
```

**Exit criteria:** registry validation rejects every malformation listed; board is same-source/same-target on real buff state; gate emits the exact contract §23 verdict order; zero reaction-evaluation code exists yet (gate returns verdict only).

---

## Mission 2 — Candidate generation + fixed-point selection + ReactionBiasQuery

**Files:**
- Create: `game/src/core/reaction/ReactionCandidate.ts` — candidate build + weight math
- Create: `game/src/core/reaction/ReactionBias.ts` — `ReactionBias`, `NormalizedReactionBias`, `ReactionBiasQuery`, `IdentityReactionBiasQuery`
- Modify: `game/src/core/reaction/ReactionTypes.ts` — `ReactionCandidate`, `ReactionEvaluationResult`
- Create: `game/src/core/reaction/ReactionSystem.ts` — `buildCandidates` + `selectCandidate` only this mission
- Test: `game/src/core/reaction/ReactionCandidate.test.ts`, `ReactionSelection.test.ts`, `ReactionBias.test.ts`

**Interfaces — Produces:**
```ts
// ReactionBias.ts — spec §54 shape, contract §31 fixed-point representation
const BIAS_SCALE = 10_000 as const  // 10_000 = x1.00; 12_500 = x1.25; 8_000 = x0.80

interface ReactionBias {
  relationBiasBps?: { sinh?: number; khac?: number }
  elementBiasBps?: Partial<Record<ElementType, number>>   // keyed by agent element (R-D)
  reactionBiasBps?: Partial<Record<ReactionId, number>>
}
interface NormalizedReactionBias {
  relationBps: Record<ReactionRelation, number>
  elementBps: (agentElement: ElementType) => number
  reactionBps: (reactionId: ReactionId) => number
}
function normalizeReactionBias(bias: ReactionBias | undefined): NormalizedReactionBias

interface ReactionBiasQuery {  // contract §79
  getFor(sourceId: CombatEntityId, triggerElement: ElementType): ReactionBias
}
class IdentityReactionBiasQuery implements ReactionBiasQuery  // all 1.0 — production default

// ReactionCandidate.ts
interface ReactionCandidate {
  definition: ReactionDefinition
  /** P^2 for sinh, A*D for khac — integer, from board stacks. */
  baseStrength: number
  /** Exact integer weight: baseStrength * relationBps * elementBps * reactionBps (max 25*10^12 << 2^53). */
  finalWeightScaled: number
  /** Trace record of the evaluated biases (contract §80). */
  evaluatedBias: { relationBps: number; elementBps: number; reactionBps: number }
}

function computeBaseStrength(def: ReactionDefinition, board: ReactionBoard): number
function computeFinalWeight(base: number, def: ReactionDefinition, bias: NormalizedReactionBias): number
```

**Candidate generation (spec §15/§28, INV-R06):** for trigger element `E`, candidates = canonical relations containing `E` — at most 4:
```
sinh: E as parent  → needs board.stacks(E)>0 AND board.stacks(SINH_CYCLE[E])>0
sinh: E as child   → needs board.stacks(SINH_PARENT_OF[E])>0 AND board.stacks(E)>0
khac: E as attacker → needs board.stacks(E)>0 AND board.stacks(KHAC_OVERCOMES[E])>0
khac: E as defender → needs board.stacks(KHAC_ATTACKER_OF[E])>0 AND board.stacks(E)>0
```
Derive candidates by scanning the registry (no pair-table): `def` qualifies iff its relation's two elements both have `stacks > 0` on the board AND `E` is one of them. Cast-order independence is structural — the pair's direction comes from `WuxingRelations` (`SINH_CYCLE`, `KHAC_OVERCOMES` — already the codebase's relation authority at `src/core/element/WuxingRelations.ts`), never from which element arrived last.

**Selection (contract §33, INV-R10/R13):** pick max `finalWeightScaled` → tie: `'khac'` beats `'sinh'` → tie: lower `selectionTiePriority`. Never inspect payoff/damage/defense (contract §35). Bias queried ONCE per evaluation (contract §80) — the normalized snapshot is passed into `selectCandidate`; no mid-evaluation re-query.

- [ ] **Step 1 — Failing tests (strength, spec §74):**
  - `sinh strength is P squared`: P=1..5 → 1/4/9/16/25.
  - `khac strength is A times D`: (1,5)→5, (3,3)→9, (5,5)→25, (4,5)→20.
  - `mature sinh beats weak khac`: sinh P4 (16) vs khac 1×5 (5) → sinh wins.
  - `mature khac beats weak sinh`: sinh P2 (4) vs khac 4×4 (16) → khac wins.
  - `equal weight tie picks khac`: sinh P3 (9) vs khac 3×3 (9) → khac (INV-R13).
  - `same-relation tie picks lower selectionTiePriority`: two khắc candidates at equal weight → the def with the smaller authored number wins; renaming a `ReactionId` must not change the winner (contract §34 — assert by re-registering a copy under a different id with same priority → throws duplicate-priority; and same priority under different ids → priority, not spelling, decides).
  - `bias rescales deterministically`: `relationBiasBps.khac = 5000` halves khắc weights; result ordering equals ordering by exact integer product (no float compare anywhere in selection).
- [ ] **Step 2 — Failing tests (candidate generation, spec §15):**
  - `fire trigger generates at most 4 candidates`: board `wood3 fire2 water4 metal1` + trigger `fire` → exactly the 4 relations containing fire (wood→fire sinh, fire→earth sinh — needs earth, absent → excluded; assert the candidate list = `{moc→hoa sinh if wood present, hoa→tho sinh if earth present, thuy khac hoa, hoa khac kim}` filtered by presence — concrete assertion: wood3+fire2+water4+metal1+earth0 yields `[duong_viem(candidate: wood→fire), tuc_viem(water→fire), dung_kim(fire→metal)]` = 3 candidates).
  - `trigger element absent from a relation excludes it`: wood-only board + fire trigger → zero candidates.
  - `a pair absent one side never qualifies`: `fire5 metal0` + fire trigger → no `dung_kim` candidate.
  - `cast order does not matter`: board `wood2 fire3` reached by (wood last-applied) vs (fire last-applied) → same candidate set + same winner (`duong_viem`) — INV-R06.
  - `one application evaluates at most one reaction` — `evaluateAfterElementalApplication` returns ≤1 resolution (INV-R05) even when 4 candidates qualify.
- [ ] **Step 3 — Failing tests (bias port, contract §79–80):** `IdentityReactionBiasQuery` returns all-1.0; a scripted bias query is called exactly once per evaluation (spy counter); recorded `evaluatedBias` in the candidate trace equals the snapshot values.
- [ ] **Step 4 — Implement** candidate build (`buildCandidates` over `ReactionRegistry.all()`), `computeBaseStrength`, `computeFinalWeight`, `normalizeReactionBias`, `selectCandidate`, `IdentityReactionBiasQuery`.
- [ ] **Step 5 — Verify (P3 quick).**

**Exit criteria:** all §74 selection cases green; candidate set never exceeds 4 and always contains the trigger element; tie-break = weight → khắc → `selectionTiePriority`; zero RNG imports in `core/reaction/`; no payoff fields read during selection.

---

## Mission 3 — Snapshot + participants + preconditions + batch execution semantics

**Files:**
- Create: `game/src/core/reaction/ReactionResolution.ts` — context/participant/precondition/resolution types + builder
- Create: `game/src/core/reaction/ReactionBatchRunner.ts` — preflight + ordered execution + typed skips
- Create: `game/src/core/reaction/ReactionEvents.ts` — `ReactionResolvedEvent`, `ReactionSkippedEvent`
- Modify: `game/src/core/reaction/ReactionSystem.ts` — `resolveCandidate` + `evaluateAfterElementalApplication` full chain
- Test: `game/src/core/reaction/ReactionSnapshot.test.ts`, `ReactionBatch.test.ts`

**Interfaces — Produces:**
```ts
// contract §36-38 — snapshot shape (participants array supersedes spec §19 flat fields)
interface ReactionParticipantSnapshot {
  role: ReactionParticipantRole
  element: ElementType
  instanceId: BuffInstanceId
  stacks: number
}

interface ReactionContext {
  reactionId: ReactionId
  relation: ReactionRelation
  sourceId: CombatEntityId
  targetId: CombatEntityId
  triggerElement: ElementType
  participants: readonly ReactionParticipantSnapshot[]   // sinh: parent+child; khac: attacker+defender
  rootActionId: string          // copied from event.origin.rootActionId
  causationEventId: string      // = event.eventId (contract §59)
  combatSequence: number        // = event.combatSequence (scheduler owns allocation — never minted here)
}

interface ReactionParticipantPrecondition {  // contract §40
  instanceId: BuffInstanceId
  expectedSourceId: CombatEntityId
  expectedTargetId: CombatEntityId
  expectedStacks: number
}

interface ReactionResolution {  // contract §39
  reactionId: ReactionId
  context: ReactionContext
  preconditions: readonly ReactionParticipantPrecondition[]
  /** Contract v1.1+review: may contain DeferredOperation entries (heal_from_damage)
      materialized by the batch runner at their position from prior in-batch results. */
  operations: readonly (ResolvedCombatOperation | DeferredOperation)[]
}

type ReactionEvaluationResult =
  | { kind: 'no_reaction'; gate: Exclude<ReactionGateVerdict, 'evaluate'> }
  | { kind: 'no_reaction'; gate: 'evaluate'; reason: 'no_candidates' }
  | { kind: 'resolved'; resolution: ReactionResolution; trace: ReactionEvaluationTrace }

// ReactionBatchRunner.ts — contract §40-51
type ReactionBatchOutcome =
  | { status: 'resolved'; reactionId: ReactionId; results: readonly CombatOperationResultBase[] }
  | { status: 'skipped'; reactionId: ReactionId; reason: 'stale_reaction_snapshot' }
  | { status: 'partial'; reactionId: ReactionId; results: readonly CombatOperationResultBase[] }
      // mid-batch invalidation: earlier ops committed, later ops 'skipped' — NOT a rollback (§48-49)

class ReactionBatchRunner {
  constructor(executor: CombatOperationExecutor, buffs: BuffReadPort, alive: (id: CombatEntityId) => boolean)
  execute(resolution: ReactionResolution): ReactionBatchOutcome
}
```

**Snapshot rule (contract §38):** all payoff math reads `context.participants[*].stacks` — the pre-consume values. Never consume-then-query. Participants: sinh = `{parent, child}` (child snapshotted too — it receives conversion stacks + the amplifier modifier); khắc = `{attacker, defender}`. Preconditions cover **every** participant (contract §41 — "all participating instances must still match").

**Batch semantics (contract §43–51):**
```
1. preflight: for each precondition, buffs.getInstance({instanceId}) must exist AND
   match expectedSourceId/expectedTargetId/expectedStacks
   → any failure: whole batch { status:'skipped', reason:'stale_reaction_snapshot' } — ZERO ops execute
2. execute operations strictly in authored order, non-interleaved (§43):
   consume ops first (§44 — always head of the list by construction), then payoff steps
3. after each op, if an op's target is no longer valid (dead/removed):
   that op → result { status:'skipped', reason:'invalid_target_state' }; continue (§49)
4. no rollback once the first op commits (§48)
5. emit ReactionResolvedEvent post-commit (spec §50) via the sink —
   handler-emitted events mint `eventId` from the TRIGGERING event
   (`evt.${triggerEvent.eventId}.reaction_resolved`) + set
   `causationEventId = triggerEvent.eventId` (contract v4 causality);
   the scheduler stamps combatSequence at enqueue:
   { type:'reaction_resolved', reactionId, relation, sourceId, targetId,
     consumed: [{buffId, stacks}...] — from snapshot }
   skipped batches emit ReactionSkippedEvent { type:'reaction_skipped', reactionId, reason } for trace parity
```

- [ ] **Step 1 — Failing tests (snapshot):**
  - `snapshot captures pre-consume stacks`: board wood4 fire2, resolve `duong_viem` → `context.participants` = `[{parent, wood, id, 4}, {child, fire, id, 2}]`; payoff steps computed from 4 (not post-consume 0).
  - `preconditions mirror every participant` — sinh produces 2 preconditions, khắc 2; each carries instanceId + expected source/target/stacks.
  - `context carries causal chain` — `rootActionId`/`causationEventId`/`combatSequence` copied from the fabricated event (contract §59).
- [ ] **Step 2 — Failing tests (batch semantics):**
  - `stale participant skips the whole reaction` (contract §95): select on wood3, then externally remove 1 stack before `runner.execute` → outcome `{status:'skipped', reason:'stale_reaction_snapshot'}`, board unchanged, zero ops dispatched (spy executor), `ReactionSkippedEvent` emitted.
  - `missing instance is stale` — participant instance removed entirely → same skip.
  - `consume runs before payoff` — executor spy records op order: `consume_buff_stacks` ops strictly precede all others (§44).
  - `death mid-batch keeps committed ops` (contract §96): khắc batch where the damage op kills the target (stub authority) → consume ops + damage committed, trailing apply-debuff op → `'skipped'/'invalid_target_state'`, outcome `status:'partial'`, consumed stacks NOT restored.
  - `operations are non-interleaved` — the runner drives them synchronously through the executor in list order; a scheduler-level interleave assertion lives in the determinism suite (M5).
  - `removal reason is reaction` — consume ops carry the payload marker that routes to `consumeStacks(all)` with removal reason `'reaction'` (§47 — assert on the op payload field, e.g. `payload.removalReason === 'reaction'`).
- [ ] **Step 3 — Implement** `resolveCandidate` (snapshot + preconditions + op emission shell — op payload constructors land fully in M4), `evaluateAfterElementalApplication` (gate → board read → candidates → bias → select → resolve), `ReactionBatchRunner`, events.
- [ ] **Step 4 — Verify (P3 quick).**

**Exit criteria:** contract §36–51 mechanics proven: snapshot-authoritative payoffs, atomic stale-skip, consume-first order, no rollback, typed skips, `reaction_resolved`/`reaction_skipped` events with exact consumed list.

---

## Mission 4 — Payoff emission: 10 reaction definitions + Cấm Công / ActionValidator

**Files:**
- Create: `game/src/data/reaction/ReactionDefinitions.ts` — `CANONICAL_REACTIONS` (10 defs, payoff steps as data)
- Create: `game/src/core/reaction/ReactionOperations.ts` — `ReactionOperation` union + op constructors (definition → `ResolvedCombatOperation[]`)
- Create: `game/src/core/reaction/StackExpr.ts` — stack-expression eval (pure)
- Create: `game/src/core/battle/turn/ActionValidator.ts`
- Modify: `game/src/core/buff/BuffTypes.ts` — `BuffDefinition.forbiddenActionTags?: readonly string[]` (additive; if the new buff2 `BuffDefinition` has landed, add there instead/too — same canonical name)
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` — `TurnSkillDefinition.actionTags?: readonly string[]`; `selectAction`/`selectForcedAction` accept restriction context; `actionTagsOf()` inference (R-E2); sealed fallback → null-action (R-E)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` — compute actor forbidden tags once per declare (`actor.buffs` + `this.registry`), pass into selection (~line 1241); no other behavior change
- Modify: `game/src/core/reaction/ReactionSystem.ts` — full payoff op emission via `ReactionOperations`
- Test: `game/src/core/reaction/ReactionPayoff.sinh.test.ts`, `ReactionPayoff.khac.test.ts`, `ReactionPayoff.noRecursion.test.ts`, `game/src/core/battle/turn/ActionValidator.test.ts`, `TurnBattleSystem.camCong.test.ts`

**Interfaces — Produces:**
```ts
// StackExpr.ts — closed DSL evaluated against the snapshot (payoff math; doubles OK —
// fixed-point is required only for selection weight, contract §31)
type StackExpr =
  | { op: 'const'; value: number }
  | { op: 'stacks'; role: ReactionParticipantRole }
  | { op: 'add' | 'mul' | 'min' | 'max'; args: readonly StackExpr[] }
  | { op: 'ceil_half' | 'floor_half'; arg: StackExpr }
function evalStackExpr(expr: StackExpr, ctx: ReactionContext): number

// ReactionDefinition payoff model (all data — contract §3 authored-vs-runtime rule)
interface ReactionPayoffDefinition { steps: readonly ReactionPayoffStep[] }
type ReactionPayoffStep =
  | { kind: 'add_child_stacks'; stacks: StackExpr }                                   // sinh conversion → AddBuffStacksOperation (NOT ApplyBuff — contract §75)
  | { kind: 'add_child_modifier'; modifierId: string; channel: 'potency' | 'periodic_damage'; value: StackExpr }
      // emits AddBuffModifierOperation { operation:'multiply', reapply:'max', lifetime:{type:'buff_lifetime'} }
  | { kind: 'extend_child_duration'; turns: StackExpr; maxRemaining: number }          // ExtendBuffDurationOperation with authored cap (spec §37)
  | { kind: 'reaction_damage'; coefficient: StackExpr; damageProfile: string; element: 'attacker' }  // DealDamageOperation origin.kind 'reaction', canCrit:false (R-A)
  | { kind: 'apply_status'; definitionId: BuffDefinitionId; stacks?: StackExpr; durationOverride?: StackExpr;
      maxDuration?: number; modifier?: { modifierId: string; channel: 'potency'; value: StackExpr };
      when?: { role: ReactionParticipantRole; op: 'gte' | 'lt'; value: number } }      // → ApplyBuffOperation(reactionEligibility:'suppressed') [+ AddBuffModifier]
  | { kind: 'push_gauge'; fractionOfMax: StackExpr }                                   // PushGaugeOperation — negative = pushback
  | { kind: 'heal_from_damage'; fraction: StackExpr; capFractionOfHealTargetMaxHp: number; healTarget: 'source' }
      // Emitted as a DeferredOperation positioned after the damage op in the batch
      // (contract v4 shape): {kind:'heal_from_damage_result', operationId (pre-minted
      // `rx.${eventId}.${reactionId}.heal`), resultOperationId: <the damage op's id>,
      // healTarget, fraction, capFractionOfHealTargetMaxHp, origin}. The batch runner
      // materializes it into a HealOperation from the referenced damage op's
      // {rawDamage|hpDamage} (R-B); the CAP is carried on the materialized op and
      // resolved by HealAuthority at execute time — the runner has no stat access.
      // Executor never sees an unresolved ref.

// The emitted subset of CombatOperation (spec §47; ApplyControl lowered to ApplyBuff per contract §6/§71):
type ReactionOperation =
  | ConsumeBuffStacksOperation | AddBuffStacksOperation | AddBuffModifierOperation
  | ExtendBuffDurationOperation | DealDamageOperation | ApplyBuffOperation
  | PushGaugeOperation | HealOperation

// ActionValidator.ts — contract §70-72 / R10
interface ActionValidator {
  forbiddenActionTags(entityId: CombatEntityId): ReadonlySet<string>
}
class BuffPoolActionValidator implements ActionValidator {
  constructor(registry: BuffDefinitionCatalog)  // resolves def.forbiddenActionTags per live instance
  forbiddenActionTags(entityId): ReadonlySet<string>          // needs holder's pool — see step 4 signature
}
function isActionAllowed(action: SelectedAction, forbidden: ReadonlySet<string>): boolean
function actionTagsOf(action: SelectedAction): readonly string[]  // authored tags else damage-inference (R-E2)
```

**`CANONICAL_REACTIONS` (all values provisional per spec §83–84; ids/priorities are the locked structure):**

| id | relation | elements | selectionTiePriority | payoff steps (snapshot vars: P=parent, A=attacker, D=defender) |
|---|---|---|---|---|
| `duong_viem` | sinh | wood→fire | 10 | `add_child_stacks ceil(P/2)`; `add_child_modifier {duong_viem, periodic_damage, 1+0.05·P}` |
| `luyen_tho` | sinh | fire→earth | 20 | `add_child_stacks ceil(P/2)`; `push_gauge −0.03·P` |
| `duong_kim` | sinh | earth→metal | 30 | `add_child_stacks ceil(P/2)`; `add_child_modifier {duong_kim, potency, 1+0.04·P}` (R-C) |
| `tu_thuy` | sinh | metal→water | 40 | `add_child_stacks ceil(P/2)`; `extend_child_duration floor(P/2), maxRemaining 5` |
| `nhuan_moc` | sinh | water→wood | 50 | `add_child_stacks ceil(P/2)`; `add_child_modifier {nhuan_moc, periodic_damage, 1+0.05·P}` |
| `tuc_viem` | khắc | water→fire | 60 | `reaction_damage 0.20·(A+D)+0.08·D`; `push_gauge −0.03·A` |
| `dung_kim` | khắc | fire→metal | 70 | `reaction_damage 0.35·(A+D)`; `apply_status test_defense_break {stacks A, durationOverride min(3,ceil(D/2))}` |
| `doan_moc` | khắc | metal→wood | 80 | `reaction_damage 0.15·(A+D)`; `apply_status test_bleed {stacks 1+floor(A/2), modifier {doan_moc, potency, 1+0.05·D}}` |
| `xuyen_tho` | khắc | wood→earth | 90 | `reaction_damage 0.15·(A+D)`; `apply_status test_defense_erosion {stacks A}`; `heal_from_damage {fraction 0.05·D, cap 0.25, healTarget source}` |
| `tran_thuy` | khắc | earth→water | 100 | `reaction_damage 0.10·(A+D)`; `push_gauge −0.04·A`; `apply_status test_cam_cong {when A≥3, durationOverride D∈1–3→1 / D∈4–5→2}` |

Emitted op order per batch (contract §44 — consumes ALWAYS first, then authored payoff order):
`consume(parent)`+`consume(defender/attacker per relation)` → conversion/`reaction_damage` → `apply_status`/`add_child_modifier`/`extend_child_duration` → `push_gauge`/`heal_from_damage` side-effects last.

Every `ApplyBuffOperation` emitted by a reaction sets `reactionEligibility: 'suppressed'` and `origin: { kind:'reaction', originId: reactionId, sourceId, rootActionId, causationEventId, reactionId, castId?, subcastIndex? }` (contract §59/§76). `add_child_stacks` emits `AddBuffStacksOperation` — structurally incapable of producing `ElementalApplicationCommitted` (contract §22/§93 = INV-R14; no recursion without relying on the flag).

- [ ] **Step 1 — Failing tests (Sinh, spec §77 — one describe per reaction):**
  - `duong_viem consumes all parent, keeps child, converts, amplifies`: board wood4 fire1 → consume `test_seal_wood` 4 (reason `reaction`), `test_seal_fire` gains `ceil(4/2)=+2` stacks via `AddBuffStacksOperation`, modifier `duong_viem` multiply `1.2` `reapply:'max'` `buff_lifetime` on the fire instance, NO damage op emitted (INV-R18).
  - `amplifier reapply keeps max`: fire instance already carrying `duong_viem ×1.25` (P5 earlier) — new P2 reaction emits `×1.10`; BuffSystem max-policy keeps `×1.25` (assert resulting modifier value, not just call).
  - per-reaction conversion targets resolve through `ElementalStateRegistry` (child element → child buff id) — never a literal buff id in `ReactionDefinitions` for elemental steps.
  - `tu_thuy caps duration`: child `test_seal_water` at remaining 4 + `floor(P/2)=2` → capped at 5 (`maxRemaining`).
  - `luyen_tho pushes gauge -0.03P` — PushGaugeOperation payload `fractionOfMax === -0.15` at P5.
- [ ] **Step 2 — Failing tests (Khắc, spec §78 — one describe per reaction):**
  - per-reaction: snapshot A/D → consume BOTH (reason `reaction`) → payoff uses snapshot values → board empty of both afterwards.
  - `tuc_viem coefficient = 0.20(A+D)+0.08D`: A4 D2 → `0.20·6+0.08·2 = 1.36` on the DealDamage payload; `element === 'water'` (attacker); `canCrit === false`; `origin.kind === 'reaction'`, `origin.reactionId === 'tuc_viem'`.
  - `dung_kim defense break`: `apply_status` emits ApplyBuff `test_defense_break` stacks A, `durationOverride === min(3, ceil(D/2))`, `reactionEligibility === 'suppressed'`.
  - `doan_moc bleed`: stacks `1+floor(A/2)`; modifier `doan_moc` value `1+0.05·D` targets the bleed selector `(definitionId, sourceId, targetId)` — NOT an instanceId (instance doesn't exist at resolution time).
  - `xuyen_tho heal`: emitted as a `DeferredOperation` positioned after the damage op in the batch, carrying its own pre-minted `operationId` (`rx.${event.eventId}.xuyen_tho.heal`) + `origin`; the batch runner materializes it from the damage op's `hpDamage`/`rawDamage` — test with stub damage result `hpDamage 1000`, D3 → materialized `HealOperation{amount === 150, capFractionOfHealTargetMaxHp === 0.25, targetId === sourceId}`; the CAP is applied by `HealAuthority` (healed = min(150, 0.25·source.maxHp) = 100 at maxHp 400) — the runner has no stat access (contract v4).
  - `tran_thuy seal gate`: A2 → no `test_cam_cong` op; A3 → op present; duration 1 at D3, 2 at D4.
- [ ] **Step 3 — Failing tests (no recursion, spec §80/contract §93):** resolve `duong_viem` with `test_seal_metal` already on the board → emitted `AddBuffStacksOperation` on fire produces NO `ElementalApplicationCommitted` (the scheduler stub's event log stays empty) → `dung_kim` does NOT chain in the same batch.
- [ ] **Step 4 — Failing tests (Cấm Công, spec §81/contract §101):** `TurnBattleSystem.camCong.test.ts` — enemy participant with basic `actionTags:['attack']` + self-heal special `actionTags:['heal']` (cooldown ready), holding a `test_cam_cong`-style buff whose def carries `forbiddenActionTags:['attack']`:
  - `forced 'basic' pick is rejected and falls back to the legal special` — `selectForcedAction(actor, 'basic')` under seal returns the heal, not the attack.
  - `sealed actor with only attacks yields an empty turn` — participant with only the attack basic → `declareActorAction` result `action === null`, `skillId === ''`, `ccBlocked === false` (not a stun — R-E).
  - `heal/buff/cleanse-tagged actions remain legal` — untagged/`['heal']`/`['buff']`/`['cleanse']` defs all selectable under the seal.
  - `unsealed actor unchanged` — no forbidden tags → selection identical to today (regression guard).
- [ ] **Step 5 — Implement** `StackExpr` eval, `ReactionOperations` emitters, `CANONICAL_REACTIONS`, full `resolveCandidate` emission; `forbiddenActionTags` field; `ActionValidator` + `actionTagsOf` + `isActionAllowed`; `selectAction`/`selectForcedAction` restriction param (ultimate→special→basic candidates filtered; fallback basic `['attack']`); `TurnBattleSystem` computes `forbidden` set once per declare and passes it.
- [ ] **Step 6 — Verify (P3 full)** + P13/P14 Playwright real-battle drive (unsealed selection unaffected) + P4 deep + P5 round.

**Exit criteria:** all 5 Sinh + all 5 Khắc profiles resolve through ops (spec §85 rows); consume-all + reason `reaction`; modifiers `reapply:'max'`/`buff_lifetime`; damage `origin:'reaction'`/`canCrit:false`; gauge ops routed; seal enforced as tag restriction not stun; engine still inert in production.

---

## Mission 5 — Determinism + trace + sequential-settlement proof + docs

**Files:**
- Create: `game/src/core/reaction/ReactionDispatcher.ts` — `onElementalApplicationCommitted` → gate → evaluate → returns `ImmediateSettlement {kind:'batch', batch: CombatOperationBatch}` to the scheduler (contract settlement.ts; the unit M7/seal-batch wiring registers this as the immediate handler for `elemental_application_committed`)
- Create: `game/src/core/reaction/ReactionTrace.ts` — `ReactionEvaluationTrace` (candidates w/ base+bias+final, winner, preflight, emitted ops) + §85-shaped formatter
- Modify: `game/src/core/reaction/ReactionSystem.ts` — record trace through evaluation
- Test: `game/src/core/reaction/ReactionDeterminism.test.ts`, `ReactionDispatcher.test.ts`, `ReactionTrace.test.ts`
- Docs: `game/docs/systems/elements-reactions.md` — add "new engine (inert)" section correcting the stale file list (M0 finding); roadmap note

**Interfaces — Produces:**
```ts
class ReactionDispatcher {
  constructor(
    gate: ReactionTriggerGate, system: ReactionSystem,
    /** Builds the CombatOperationBatch (preconditions + ordered ops) the scheduler's
        CombatOperationBatchRunner will preflight + run inside a batch frame. */
    batchFactory: (resolution: ReactionResolution) => CombatOperationBatch,
    /** Contract v4: the dispatcher emits via the scheduler-owned sink;
        ReactionResolved/Skipped events mint `eventId` from the incoming
        event (`evt.${event.eventId}.reaction_resolved`) + set
        `causationEventId` — handler-emitted events have no executing op. */
    sink: CombatEventSink,
  )
  /** Scheduler's immediate handler for 'elemental_application_committed'.
      Returns ImmediateSettlement {kind:'batch'} on resolution, or void when the
      gate/selection produces no reaction — the scheduler drains it like any
      other immediate consequence. */
  onElementalApplicationCommitted(event: ElementalApplicationCommitted): ImmediateSettlement | void
}

interface ReactionEvaluationTrace {  // contract §85 shape
  eventId: string; combatSequence: number
  board: ReactionBoard
  candidates: readonly { reactionId: ReactionId; baseStrength: number; evaluatedBias: {…}; finalWeightScaled: number }[]
  selected?: ReactionId
  preconditions?: readonly ReactionParticipantPrecondition[]
  operationIds: readonly string[]
}
```

- [ ] **Step 1 — Failing tests (sequential multicast, spec §79/contract §98):** scripted subcast loop — apply wood2 (commits), then fire application → dispatcher runs reaction to settle, then metal application reads the UPDATED board: assert second application sees post-consume state (e.g. fire board stacks = post-reaction value, not pre), each application evaluated independently, max one reaction each. Assert evaluate calls run strictly between applications (no batched end-of-cast scan — event order log).
- [ ] **Step 2 — Failing tests (determinism, spec §82/contract §87):** same fixture world + same scripted event sequence (two runs) → deep-equal candidate lists, winner, preconditions, emitted operation id sequence, consumed list, final board. Run with a randomized-but-seeded order of 200 synthetic applications across elements (SeededCombatRng from foundation) → identical trace digest both runs.
- [ ] **Step 3 — Failing tests (canonical ordering, spec §60):** two resolutions sharing a sequence boundary order by `combatSequence → sourceId → targetId → reactionId` (assert comparator in `ReactionDispatcher`/`ReactionTrace` ordering helper).
- [ ] **Step 4 — Failing tests (trace, contract §85):** `formatReactionTrace` renders rootAction → event → candidates(with weights) → selected → preflight → emitted ops in the documented tree shape; trace records evaluated bias snapshot per candidate.
- [ ] **Step 5 — Failing test (exactly-once handoff):** dispatcher ignores a duplicate `eventId` (scheduler dedups — assert dispatcher delegates/relies on it; if scheduler owns dedup, this test asserts the dispatcher is idempotent under double-invoke with the same event).
- [ ] **Step 6 — Implement + docs; verify (P3 quick)** + P4 quick + P5 round + final self-review against spec §85 DoD checklist.

**Exit criteria:** spec §74–82 + contract §91–101 reaction-relevant rows all named and green; sequential settlement proven; trace reconstructable; docs updated; engine remains production-inert.

---

## Test matrix — spec/contract requirements → named tests

| Source | Requirement | Test (file :: name) |
|---|---|---|
| §74 | Sinh P² 1/4/9/16/25 | `ReactionCandidate.test.ts :: sinh strength is P squared` |
| §74 | Khắc A×D cases | `:: khac strength is A times D` |
| §74 | mature-sinh / mature-khắc / equal-tie | `ReactionSelection.test.ts :: 3 cases` |
| §75 | addedStacks>0 trigger / cap-refresh / failed / periodic / suppressed | `ReactionTriggerGate.test.ts :: verdict cases` (+contract §91–92 coverage via event fabrication) |
| §76/§27 | source isolation | `ReactionBoard.test.ts :: reads same-source stacks only` |
| §15/§28 | ≤4 candidates, trigger membership | `ReactionCandidate.test.ts :: candidate generation cases` |
| §12 | cast-order independence | `ReactionSelection.test.ts :: cast order does not matter` |
| §11 | one application = one reaction | `ReactionSelection.test.ts :: at most one resolution` |
| §77 | per-Sinh consume/convert/amplify/no-damage/max-reapply | `ReactionPayoff.sinh.test.ts :: 5 describes` |
| §78 | per-Khắc snapshot/consume/reason/snapshot-values | `ReactionPayoff.khac.test.ts :: 5 describes` |
| §79 | sequential multicast settle | `ReactionDeterminism.test.ts :: sequential subcast` |
| §80 | no recursion | `ReactionPayoff.noRecursion.test.ts` |
| §81/§101 | Cấm Công restriction | `TurnBattleSystem.camCong.test.ts` + `ActionValidator.test.ts` |
| §82/§87 | determinism | `ReactionDeterminism.test.ts :: seeded digest` |
| §60 | canonical ordering | `ReactionDeterminism.test.ts :: ordering comparator` |
| §50 | reaction event payload | `ReactionBatch.test.ts :: resolved event consumed list` |
| §95 | stale snapshot atomic skip | `ReactionBatch.test.ts :: stale participant skips whole reaction` |
| §96 | death mid-batch no rollback | `ReactionBatch.test.ts :: death mid-batch keeps committed ops` |
| §97 | exactly-once | `ReactionDispatcher.test.ts :: duplicate eventId` |
| §33/§34 | tie-break authored priority | `ReactionSelection.test.ts :: tie cases` |
| §22/§93 | AddBuffStacks → no elemental event | `ReactionPayoff.noRecursion.test.ts` |
| §80/§79 | bias read once, recorded | `ReactionBias.test.ts` + trace assertions |
| §85 | debug trace shape | `ReactionTrace.test.ts` |

## Deferred to seal batch (explicitly NOT this program)

- Real ấn `BuffDefinition`s (`hoa_an`, `han_tuc`, `doc_can`, `liet_thuong`, `tran_an`) + `ElementalStateRegistry` rebinding to real ids; `cam_cong`/bleed/defbreak/erosion production ids replacing `test_*`.
- `elemental_reaction_enabled` production grant (Ngộ Đạo kit / way module) + `CombatCapabilityQuery` production backing.
- `ReactionDispatcher` wiring into `CombatScheduler` immediate-settlement drain inside `TurnBattleSystem` (foundation M7 seam).
- Legacy `TurnReactionManager`/`canInitiateWuxingReactions` retirement + visible-Pháp Tu reaction ruling execution (R3).
- Real payoff number tuning; `damageProfile 'reaction_damage'` authoring in DamageSystem profile registry; R-A element decision; R-C penetration channel.
- Skill `tags` taxonomy (`attack` etc.) replacing the R-E2 inference.

## Spec-vs-codebase conflicts found (for coordinator)

1. `docs/systems/elements-reactions.md` is stale: references `core/element/ElementReaction.ts` (`ELEMENT_REACTIONS` pair-table), `core/element/ReactionManager.ts`, `core/element/ElementLoadout.ts` — none exist. Live path = `WuxingRelations.ts` + `TurnReactionManager.ts` (two-phase rule engine, `KHAC_CHE_COEFF`/`CONG_MINH_AMP` at `TurnReactionManager.ts:38-39`). Doc updated in M5.
2. Spec §65 `reactionEligible: boolean` on the event → superseded by contract §14 `reactionEligibility: 'eligible' | 'suppressed'` runtime metadata on `ApplyBuffRequest`. This plan uses the contract spelling everywhere.
3. Spec §24 lexical-ReactionId tie-break → superseded by contract §33–34 authored unique `selectionTiePriority`.
4. Spec §19 flat `ReactionContext` fields → superseded by contract §36 `participants` array (needed for instanceId capture anyway).
5. `TurnSkillDefinition` has no `tags`/`actionTags` (`TurnSkillAction.ts:55-255`) and `BuffDefinition` has no `forbiddenActionTags` (`BuffTypes.ts:238-284`) — additive fields added in M4; R-E2 inference bridges until the skill-definition tag taxonomy lands.
6. `ActionGauge.ts` exposes only `refundGauge` (positive delta, `GAUGE_MAX=1000`) — gauge pushback needs a negative-delta route on the gauge authority port; flagged for foundation executor.
7. `canInitiateWuxingReactions` (`TurnBattleSystem.ts:137`, stamped `TurnBattleAdapter.ts:60` for the `phap_tu` stat domain) gates the LEGACY engine for ALL pháp tu — broader than the spec's Ngộ Đạo-only intent. R3 keeps this live; the new capability is deliberately ungranted (R7). Coordinator must confirm the visible-Pháp Tu reaction removal timing (seal batch).
8. RESOLVED (contract plan v4): `heal_from_damage` rides `DeferredOperation` inside `CombatOperationBatch` — the deferred entry carries its own pre-minted `operationId` (R-F pattern) + `origin`; the batch runner materializes a concrete `HealOperation` from prior in-batch results via `BatchResultContext`; the source-maxHp cap is carried on the materialized op (`capFractionOfHealTargetMaxHp`) and resolved by `HealAuthority` (stat reads are authority-owned, not runner-owned). `HealOperation.amount` is always concrete by executor time. The executor never resolves refs.
9. Current `Buff`/`BuffPool` have no `instanceId` — participant snapshots require the new BuffSystem's `BuffInstanceSnapshot.instanceId`. One more reason the foundation prerequisite is blocking.
10. `Độc Căn` name collision (poison-root mechanic inside `trung_doc` vs future `doc_can` id) — sibling plan R4 owns the rename at its M4; this plan's fixtures use `test_seal_wood` and stay clear of the collision.

## Open questions for coordinator

1. RESOLVED: `DeferredOperation` materialization (contract plan v4, R-C7) — damage result payload carries `hpDamage`/`rawDamage`; runner builds the concrete `HealOperation` via `BatchResultContext`; deferred entries carry pre-minted `operationId`s; heal cap resolved by `HealAuthority`.
2. R-A: reaction damage `element` — attacker-element (chosen, preserves legacy overcomer-element semantics) vs elementless true damage?
3. R-C: is a `'penetration'`/`'stat'` modifier channel planned for buff2, or is the `'potency'` proxy acceptable for Dưỡng Kim at seal batch?
4. Should `CANONICAL_REACTIONS` ship in `src/data/reaction/` (chosen) or stay test-adjacent until seal batch rebinds the ids?
5. RESOLVED (contract v4): `operationId` minting ownership — ReactionSystem mints deterministic ids for ALL its ops including `DeferredOperation` entries (R-F pattern); the scheduler never mints op ids — it asserts global uniqueness via `reserveOperationId` on every execution path and stamps `combatSequence` itself.
