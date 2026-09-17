# Combat Systems Contract — SkillDefinition × BuffSystem × ReactionSystem

Status: FINAL — **PARKED: lưu trữ, chỉ xử lý sau khi toàn bộ mission hiện tại chạy xong** (user ruling 2026-09-17)
Version: 1.2
Applies to: [SkillDefinition v1.1](./2026-09-17-skill-definition-system-spec.md), [Buff System Reimagined v1.0](./2026-09-17-buff-system-reimagined-spec.md), [Reaction System Reimagined v1.0](./2026-09-17-reaction-system-reimagined-spec.md)
Compatibility requirement: None
Migration requirement: None
Purpose: Khóa contract runtime giữa Skill, Buff, Reaction và các combat authorities trước implementation.

> **Implementation notes (2026-09-17):**
> - Contract này **supersedes** hai điểm trong các spec trước: (1) reaction eligibility chuyển từ BuffDefinition flag thành runtime metadata trên `ApplyBuffRequest` (§14); (2) reaction tie-break lexical `ReactionId` bị cấm, thay bằng authored `selectionTiePriority` unique (§33–34).
> - Toàn bộ contract đòi hỏi infra chưa tồn tại: `CombatScheduler` (combatSequence + settlement barrier + exactly-once events), `CombatOperationExecutor`, `CombatRng`, `CombatCapabilityQuery`, `ElementalStateRegistry`, shared `combat/contracts/` layer. Hiện `TurnBattleSystem` gọi trực tiếp các system — đây là mission nền tảng trước mọi spec khác.

## 1. Fundamental Rule

Không system nào được mutate state thuộc authority khác trực tiếp.

Canonical flow:

```
Authored Definition
        ↓
Resolver
        ↓
ResolvedCombatOperation
        ↓
CombatScheduler
        ↓
CombatOperationExecutor
        ↓
Domain Authority
        ↓
Committed Result
        ↓
Domain Event
        ↓
Immediate Settlement
```

Ví dụ:

```
Skill
↓
Apply Hỏa Ấn
↓
BuffSystem commit
↓
ElementalApplicationCommitted
↓
ReactionSystem
↓
ReactionResolution
↓
CombatOperations
↓
Buff / Damage / Gauge authorities
```

## 2. Authority Map

**SkillDefinition**

Owns: authored skill intent, effect ordering, conditions, target intent, cardinality, presentation-independent skill data.

Does NOT own runtime state.

**SkillResolver**

Owns: definition + cast snapshot + progression + route → `ResolvedSkillPlan`.

Does NOT mutate combat state.

**CombatScheduler**

Owns: command ordering, operation ordering, immediate settlement barriers, event queue, `combatSequence` allocation, exactly-once event dispatch.

**CombatOperationExecutor**

Owns: routing a resolved operation to its proper authority.

Does NOT own: damage formulas, Buff rules, Reaction rules, Gauge formulas.

It is a dispatcher, not a gameplay engine.

**BuffSystem**

Owns: BuffInstance, stack, duration, modifier, persistent status, application, consumption, removal, lifecycle.

**ReactionSystem**

Owns: candidate generation, candidate scoring, candidate selection, Reaction snapshot, ReactionResolution construction.

It does NOT mutate state.

**DamageSystem**

Owns: damage calculation, crit, mitigation, resistance, HP loss, damage result, death consequence entry point.

**Gauge / Turn Authority**

Owns: Speed Gauge, pushback, gauge clamp, turn scheduling consequences.

**Action Validation**

Owns: whether an action can currently be performed.
It consumes generic restrictions stored through Buff state.

## 3. Authored Operation ≠ Runtime Operation

This distinction is mandatory.

SkillDefinition contains `AuthoredSkillOperation`. Example:

```ts
{
  type: 'apply_ailment',
  target: 'primary_target',
  ailmentId: 'hoa_an',
  stacks: 1
}
```

It must NOT contain:

- runtime targetId
- runtime sourceId
- BuffInstanceId
- combatSequence
- actual Reaction state

## 4. ResolvedCombatOperation

At runtime, Resolver/Executor produces:

```ts
interface ResolvedCombatOperation {
  operationId: string

  type: CombatOperationType

  sourceId: CombatEntityId

  origin: CombatOperationOrigin

  payload: ResolvedOperationPayload
}
```

All selectors are already runtime-resolved.

## 5. Core CombatOperation Types

Minimum shared operation vocabulary:

```ts
type CombatOperation =
  | DealDamageOperation
  | HealOperation

  | ApplyBuffOperation

  | AddBuffStacksOperation
  | RemoveBuffStacksOperation
  | ConsumeBuffStacksOperation

  | AddBuffModifierOperation
  | RemoveBuffModifierOperation

  | RefreshBuffDurationOperation
  | ExtendBuffDurationOperation

  | TriggerBuffPeriodicOperation
  | RemoveBuffOperation

  | PushGaugeOperation

  | GainResourceOperation
  | ConsumeResourceOperation

  | ApplyShieldOperation
```

No path-specific primitives such as `ApplyHoaAn`, `TriggerDungKim`, `ApplyCamCong`, `DoNguDaoReaction`.

## 6. Persistent Control Is Buff State

Cấm Công is not a separate state authority.
It is a BuffDefinition containing `forbiddenActionTags = ['attack']`.

```
Reaction: Trấn Thủy
↓
ApplyBuff(cam_cong)
```

BuffSystem stores it.
ActionValidator enforces it.

## 7. Secondary Persistent Effects

Persistent reaction outcomes — Bleed, Defense Break, Defense Erosion, Vulnerability, Cấm Công — are BuffDefinitions.
ReactionSystem only requests their application.

## 8. External Mutation Rule

All cross-system gameplay mutation requests must use CombatOperations.

Example: Reaction → consume Buff must become `ConsumeBuffStacksOperation`, not `buff.stacks = 0`.

## 9. Internal Lifecycle Exception

This rule does NOT mean every internal state transition must become a CombatOperation.

BuffSystem may internally perform its own lifecycle — duration decrement, modifier lifetime decrement, natural expiration, battle cleanup — when responding to its canonical lifecycle methods.

Therefore: CombatOperation is mandatory for cross-authority gameplay requests, not for private lifecycle mechanics inside the owning authority.

## 10. CombatOperationOrigin

Every runtime operation carries provenance.

```ts
interface CombatOperationOrigin {
  kind:
    | 'skill'
    | 'reaction'
    | 'buff_periodic'
    | 'proc'
    | 'scripted'

  originId: string

  sourceId: CombatEntityId

  rootActionId: string

  parentOperationId?: string
  causationEventId?: string

  castId?: string
  subcastIndex?: number

  reactionId?: ReactionId
}
```

## 11. Causal Chain

Example:

```
rootActionId: CAST-143
        ↓
operation: Hỏa application
        ↓
event: ElementalApplicationCommitted
        ↓
reaction: Dung Kim
        ↓
operation: Reaction Damage
        ↓
DamageResult
```

Every step must remain traceable to the same root action.

## 12. combatSequence Authority

Only CombatScheduler allocates `combatSequence`.
Individual systems do not invent sequence numbers.
This provides one canonical total ordering.

## 13. Operation IDs

Every runtime operation has a unique `operationId` within the battle execution trace.
Derived operations preserve `parentOperationId` where relevant.

## 14. Reaction Eligibility Is Runtime Metadata

Reaction eligibility is NOT part of BuffDefinition.
Same Hỏa Ấn may be applied by Skill / Reaction / Proc / Script with different reaction eligibility.

Canonical:

```ts
type ReactionEligibility =
  | 'eligible'
  | 'suppressed'
```

## 15. ApplyBuffOperation

Runtime elemental application eventually produces:

```ts
interface ApplyBuffRequest {
  definitionId: BuffDefinitionId

  sourceId: CombatEntityId
  targetId: CombatEntityId

  stacks: number

  baseChance: number

  durationOverride?: number

  reactionEligibility: ReactionEligibility

  origin: CombatOperationOrigin
}
```

Application reason is derived from `origin.kind`.
It must not be independently authored with a contradictory value.

## 16. Buff Application Authority

BuffSystem/ApplicationResolver owns: application chance modifiers, ailment resistance, CombatRng roll, instance resolution, stack cap, reapply behavior, duration.

SkillSystem does NOT roll ailment application itself.
ReactionSystem does NOT roll it either.

## 17. ApplyBuffResult

Canonical result:

```ts
interface ApplyBuffResult {
  applied: boolean

  instanceId?: BuffInstanceId

  created?: boolean

  stacksBefore?: number
  stacksAfter?: number

  requestedStacks?: number
  addedStacks?: number
  overflowStacks?: number

  durationBefore?: number
  durationAfter?: number
}
```

This result is authoritative.
Consumers do not infer application success by querying afterward.

## 18. Failed Application

If application fails:

- NO persistent state mutation
- NO elemental committed event
- NO Reaction

BuffSystem may emit `BuffApplicationFailedEvent` for log/debug.

## 19. ElementalStateRegistry

Reaction does not treat every elemental Buff as canonical Reaction state.

Shared registry:

```ts
interface ElementalStateRegistry {
  getDefinitionId(
    element: ElementType
  ): BuffDefinitionId

  getElement(
    definitionId: BuffDefinitionId
  ): ElementType | null
}
```

Locked baseline:

```
Hỏa  → hoa_an
Thủy → han_tuc
Mộc  → doc_can
Kim  → liet_thuong
Thổ  → tran_an
```

## 20. ElementalApplicationCommitted

After a canonical elemental Buff application commits:

```ts
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

  reactionEligibility: ReactionEligibility

  origin: CombatOperationOrigin

  combatSequence: number
}
```

This event represents committed state.

## 21. Pure Refresh

Example:

```
Hỏa5
+ Hỏa2
↓
Hỏa5
duration refreshed
addedStacks = 0
```

This does NOT trigger Reaction.
Gate: `addedStacks > 0` is mandatory.

## 22. Manual Stack Mutation

Operations `AddBuffStacks` / `RemoveBuffStacks` / `ConsumeBuffStacks` are NOT elemental applications.

Therefore Sinh → +3 Hỏa stack does not create another `ElementalApplicationCommitted`.
Reaction recursion is prevented structurally.

## 23. Reaction Trigger Gate

Reaction dispatcher checks in order:

```
ElementalApplicationCommitted
        ↓
reactionEligibility == eligible ?
        ↓
addedStacks > 0 ?
        ↓
source has elemental_reaction_enabled ?
        ↓
YES
        ↓
ReactionSystem.evaluate(...)
```

Any failed gate: STOP

## 24. Reaction Capability

ReactionSystem does not import PathSystem.
It queries:

```ts
interface CombatCapabilityQuery {
  has(
    entityId: CombatEntityId,
    capabilityId: string
  ): boolean
}
```

Ngộ Đạo supplies `elemental_reaction_enabled`.
Visible Pháp Tu does not.

## 25. Visible Pháp Tu Contract

Visible Pháp Tu can still apply canonical elemental ailments.
Its application can technically be `reactionEligibility = eligible`, but because caster lacks `elemental_reaction_enabled`, no Reaction occurs.

No Pháp Tu-specific branch exists in ReactionSystem.

## 26. Reaction Board Query

ReactionSystem receives readonly state only.

```ts
interface ElementalBoardQuery {
  read(
    sourceId: CombatEntityId,
    targetId: CombatEntityId
  ): ReactionBoard
}
```

Board is same source, same target.

## 27. Source Isolation

Caster A's `Hỏa5` cannot react using caster B's `Kim5` on the same target.
Reaction ownership is source-scoped.

## 28. Candidate Generation

Input: `ReactionBoard` + `triggerElement`.

ReactionSystem only builds relations containing the trigger element.
Maximum: 4 candidates for one elemental application.

## 29. Sinh Strength

For Parent stack count `P`, base strength: `P²`

```
1 → 1
2 → 4
3 → 9
4 → 16
5 → 25
```

## 30. Khắc Strength

For `A = AttackerStacks`, `D = DefenderStacks`, base strength: `A × D`

```
1×5 = 5
3×3 = 9
5×5 = 25
```

## 31. Reaction Bias

Bias uses deterministic fixed-point representation.

Recommended:

```
10000 = ×1.00
12500 = ×1.25
8000  = ×0.80
```

Do not use binary floating-point as the final tie-deciding representation.

## 32. Final Selection Weight

Conceptually:

```
baseStrength
× relationBias
× elementalBias
× reactionSpecificBias
```

Implementation uses deterministic integer/fixed-point math.

## 33. Tie Break

Tie resolution:

1. higher finalWeight
2. Khắc over Sinh
3. lower `selectionTiePriority` value

Every ReactionDefinition has `selectionTiePriority: number`.
This value must be unique within the Reaction registry.

## 34. No Lexical-ID Gameplay Rule

ReactionId naming does NOT decide gameplay.
Renaming `dung_kim` must not alter selection outcome.
Therefore lexical ReactionId ordering is forbidden as gameplay tie-break.

## 35. No Payoff-Aware Candidate Selection

Candidate selection must NOT inspect: expected damage, target defense, child stack cap, expected healing, Cấm Công usefulness.

Selection uses only: Reaction board, relation rules, build bias.
This keeps the system understandable.

## 36. Reaction Snapshot

After winner selection, create immutable snapshot.

```ts
interface ReactionContext {
  reactionId: ReactionId

  relation:
    | 'sinh'
    | 'khac'

  sourceId: CombatEntityId
  targetId: CombatEntityId

  triggerElement: ElementType

  participants:
    readonly ReactionParticipantSnapshot[]

  rootActionId: string
  causationEventId: string

  combatSequence: number
}
```

## 37. Participant Snapshot

```ts
interface ReactionParticipantSnapshot {
  role:
    | 'parent'
    | 'child'
    | 'attacker'
    | 'defender'

  element: ElementType

  instanceId: BuffInstanceId

  stacks: number
}
```

## 38. Reaction Snapshot Is Authoritative

Payoff scaling uses snapshot values.
It must NOT consume then query stack again to derive effect strength.

## 39. ReactionResolution

ReactionSystem returns:

```ts
interface ReactionResolution {
  reactionId: ReactionId

  context: ReactionContext

  preconditions:
    readonly ReactionPrecondition[]

  operations:
    readonly ResolvedCombatOperation[]
}
```

ReactionSystem itself performs no mutation.

## 40. Reaction Preconditions

Before executing a Reaction batch, scheduler/executor validates:

```ts
interface ReactionParticipantPrecondition {
  instanceId: BuffInstanceId

  expectedSourceId: CombatEntityId
  expectedTargetId: CombatEntityId

  expectedStacks: number
}
```

## 41. Why Preconditions Exist

Reaction selection happened from committed state.
Before mutation begins, all participating instances must still match that snapshot.

If instance missing / source mismatch / target mismatch / stack count changed, then Reaction snapshot is stale.

## 42. Stale Reaction Rule

If any Reaction precondition fails: cancel entire Reaction BEFORE any mutation.

Result: `status = skipped`, `reason = stale_reaction_snapshot`.

No partial consumption. No payoff.

## 43. Reaction Batch Execution

After preflight succeeds, Reaction batch starts.

Execution is: non-interleaved, ordered, no external command inserted between operations.

## 44. Reaction Consumption Order

Canonical:

```
1. consume participating elemental states
2. primary payoff
3. persistent secondary status
4. gauge / heal / resource side-effects
```

ReactionDefinition may refine ordering after consumption.
Consumption always occurs first.

## 45. Sinh Consumption

Sinh: consume ALL Parent. Child remains.
Consumption references snapshot participant: `instanceId`, `expectedStacks`.

## 46. Khắc Consumption

Khắc: consume ALL Attacker, consume ALL Defender.
Both reference snapshot instances.

## 47. Reaction Removal Reason

Buff removal caused by Reaction uses `reason = reaction`, not `expired` / `consumed` / `cleansed`.

## 48. No Rollback After Batch Start

Once preflight succeeds and first operation mutates state: NO rollback.

Example: consume ailments → reaction damage kills target. Consumed ailments remain consumed.

## 49. Target Death During Payoff

Later target-dependent operations may become invalid.

Example:

```
consume
↓
reaction damage
↓
target dies
↓
apply Defense Break
```

Final operation returns `skipped`, `reason = invalid_target_state`.
Earlier operations remain committed.

## 50. Structural Failure

Malformed definition or impossible operation contract is not a normal combat skip.
Development/test environment: fail fast.

Examples: unknown BuffDefinition, unknown DamageProfile, invalid Reaction operation, invalid canonical element mapping.

## 51. Runtime Skip

Normal runtime invalidation — target already dead, target removed, expected state no longer exists — returns typed `skipped` rather than throwing an arbitrary battle exception.

## 52. Operation Result

All operations return typed result.

Base:

```ts
interface CombatOperationResultBase {
  operationId: string

  status:
    | 'resolved'
    | 'failed'
    | 'skipped'

  reason?: CombatOperationResultReason
}
```

Each operation has its own typed payload.
Avoid `payload: unknown` as the primary contract.

## 53. ApplyBuff Result Type

Example:

```ts
interface ApplyBuffOperationResult
  extends CombatOperationResultBase {

  type: 'apply_buff'

  result?: ApplyBuffResult
}
```

Other operations follow equivalent discriminated result shapes.

## 54. Elemental Event Timing

BuffSystem:

```
validate
↓
resolve
↓
mutate
↓
commit
↓
produce result
↓
queue domain event
↓
return
```

Reaction never runs inside `BuffSystem.apply()`.

## 55. Post-Commit Settlement Barrier

After each ResolvedCombatOperation completes:

```
OperationExecutor returns
↓
CombatScheduler reaches settlement barrier
↓
drain immediate-settlement events
↓
execute generated commands
↓
continue until immediate queue is quiescent
↓
next authored operation
```

## 56. Immediate Queue Quiescence

Scheduler does not merely process one Reaction event.
It drains all legitimate immediate consequences generated before continuing.

However: Reaction-generated elemental mutations are reaction-suppressed, preventing Reaction recursion.
Other combat systems may still have legitimate immediate consequences.

## 57. Infinite-Loop Protection

Scheduler should have a development safety guard for pathological immediate chains.
Example concept: `maxImmediateSettlementDepth` or equivalent processed-command budget.

Exceeding it: fail loudly in development/testing.
Do not silently truncate gameplay in production logic.

## 58. Exactly-Once Event Processing

Every immediate event has `eventId`.
CombatScheduler guarantees: `eventId` processed at most once.
A duplicated delivery must not produce duplicate Reaction.

## 59. Event Causation

Reaction operations generated from `ElementalApplicationCommitted EVENT-77` receive `causationEventId = EVENT-77` and preserve `rootActionId` from the original cast/action.

## 60. Multicast

Multicast is sequential.

```
Subcast 1 → fully settle
Subcast 2 → sees new state → fully settle
Subcast 3 ...
```

No batched final-board Reaction scan.

## 61. Multicast And Reaction

One elemental application: max one Reaction.
One subcast may contain multiple authored operations, but every application operation receives its own settlement barrier.

## 62. Target Death Between Subcasts

If Reaction kills target, remaining multicast subcasts return to Skill/Targeting policy.
ReactionSystem does not retarget.

## 63. Skill Operation Ordering

Example:

```
Operation 1: Apply Hỏa
Operation 2: Read Hỏa stacks
Operation 3: Deal damage
```

If operation 1 triggers a Reaction that consumes Hỏa, operation 2 sees `Hỏa = 0`.
This is intentional.

## 64. Snapshot-Before-Reaction Mechanics

If a skill wants to read stacks before its own application-triggered Reaction, the skill must explicitly capture that value before the application operation.
No hidden delayed Reaction mechanism exists.

## 65. Cast Outcome

Reaction does not retroactively redefine `SkillCastOutcome`.

Example: skill application lands → Reaction occurs. The skill remains landed according to SkillDefinition v1.1 rules.
Reaction damage is not converted into primary skill damage.

## 66. Damage Origin — Skill

`origin.kind = skill`. DamageSystem handles it.

## 67. Damage Origin — Periodic

`origin.kind = buff_periodic`. DamageSystem handles it.

## 68. Damage Origin — Reaction

`origin.kind = reaction`, `reactionId = ...`. DamageSystem handles it.

Baseline Reaction damage: `canCrit = false` unless explicit progression changes the rule.

## 69. Origin-Specific Modifiers

Skill Damage / Periodic Damage / Reaction Damage remain separate.
A modifier to one origin does not automatically affect the others.

## 70. Gauge Contract

Reaction generates `PushGaugeOperation`.
Gauge authority owns current gauge, clamp, turn-order consequence.
ReactionSystem never mutates gauge.

## 71. Cấm Công Contract

Reaction emits `ApplyBuff(cam_cong)`.
`cam_cong` contains `forbiddenActionTags = ['attack']`.
ActionValidator reads active restriction.

## 72. Cấm Công ≠ Stun

Target retains turn.

Allowed: buff, heal, cleanse, defend, utility, resource.
Forbidden: attack.

## 73. Manual Periodic Trigger

Skill operation `TriggerBuffPeriodic` routes to BuffSystem.
It triggers periodic resolution but does NOT advance Buff lifetime unless separately requested by lifecycle.

## 74. Periodic Damage And Reaction

Periodic execution does not produce `ElementalApplicationCommitted`.
Therefore: NO Reaction.

## 75. Reaction-Generated Elemental Stack

Sinh example `Mộc → Hỏa` should use `AddBuffStacks(Hỏa)`, not `ApplyBuff(Hỏa)`, because this is conversion, not a new elemental application.

## 76. Reaction-Generated Elemental Application

If a future mechanic explicitly needs a genuine elemental application from Reaction, it may use `ApplyBuff` with `reactionEligibility = suppressed`.
Thus recursion remains disabled.

## 77. Modifier Contract

Both Skill and Reaction use `AddBuffModifierOperation`.
BuffSystem owns modifier identity, reapply policy, priority, lifetime, resolution.
No system mutates Buff effect magnitude directly.

## 78. Sinh Modifier

Example Dưỡng Viêm: Reaction computes desired modifier value from snapshot.
BuffSystem stores it according to modifier id, `reapply = max`, `lifetime = child ailment lifetime`.

## 79. Reaction Bias Query

Reaction progression enters through:

```ts
interface ReactionBiasQuery {
  getFor(
    sourceId: CombatEntityId,
    triggerElement: ElementType
  ): ReactionBias
}
```

ReactionSystem does not know whether bias came from path node, equipment, passive, temporary Buff.

## 80. Bias Snapshot

Reaction bias used for candidate selection is read once per evaluation.
The resulting evaluated values should be recorded in debug trace.
Candidate selection must not re-query mutable build state midway through one evaluation.

## 81. Reaction Definition

Conceptual:

```ts
interface ReactionDefinition {
  id: ReactionId

  relation:
    | 'sinh'
    | 'khac'

  selectionTiePriority: number

  elements: ReactionElementRelation

  payoff: ReactionPayoffDefinition
}
```

## 82. Registry Validation

Startup validates:

- unique ReactionId
- unique `selectionTiePriority`
- 5 canonical Sinh
- 5 canonical Khắc
- valid elements
- no self relation
- canonical Buff mapping exists
- all referenced BuffDefinitions exist
- all DamageProfiles exist
- all operation profiles valid

Invalid development configuration: throw.

## 83. Dependency Direction

Core implementations must avoid cycles.

Forbidden conceptual dependencies:

- BuffSystem imports ReactionSystem
- ReactionSystem imports Skill implementation
- Skill implementation imports Buff internals

Prefer shared contract modules/interfaces.

## 84. Suggested Shared Contract Layer

Conceptually:

```
combat/contracts/

  operations/
    CombatOperation
    CombatOperationResult
    CombatOperationOrigin

  events/
    CombatEvent
    ElementalApplicationCommitted

  buff/
    BuffContracts

  reaction/
    ReactionContracts

  elemental/
    ElementalStateRegistry

  capability/
    CombatCapabilityQuery
```

Exact folder structure is not locked.

## 85. Debug Trace Requirement

A Reaction trace should be reconstructable as:

```
RootAction CAST-143
  Subcast 2

  Operation OP-18
    Apply hoa_an +2

  BuffResult
    stacks 1 → 3
    addedStacks 2

  Event EVT-42
    ElementalApplicationCommitted

  ReactionEvaluation
    Dưỡng Viêm:
      base=4
      bias=1.0
      final=4

    Dung Kim:
      base=12
      bias=1.0
      final=12

  Selected:
    Dung Kim

  Preflight:
    hoa_an instance X stacks3 OK
    liet_thuong instance Y stacks4 OK

  ReactionOperations:
    consume hoa_an3
    consume liet_thuong4
    deal reaction damage
    apply defense break
```

This is required for agent/debug reproducibility.

## 86. No Hidden Mutation

Every cross-system persistent change must be traceable as:

```
CombatOperation
→ authority result
→ domain event
```

No side-channel mutation.

## 87. Determinism Contract

Given same initial state, same authored definitions, same seeded RNG, same input commands, must produce:

- same operation order
- same Buff results
- same event order
- same Reaction candidates
- same Reaction winner
- same Reaction batch
- same combatSequence trace
- same final combat state

## 88. RNG Ownership

Allowed randomness uses `CombatRng`. Examples: random elemental cast, Buff application, Proc chance.

Reaction candidate selection uses ZERO RNG.

## 89. Forbidden Cross-Authority Mutation

Forbidden:

```ts
skillSystem.buff.stacks++
reactionSystem.target.hp -= damage
reactionSystem.gauge -= x
buffSystem.resolveReaction()
damageSystem.applyBuff(...)
randomCastSystem.editReactionBoard(...)
```

## 90. Forbidden Core Special Cases

Core systems must not contain gameplay branches such as:

```ts
if (buff.id === 'hoa_an')
if (reaction.id === 'dung_kim')
if (path === 'phap_tu_an')
if (skill.id === '...')
```

Specific behavior belongs in definitions/data.

## 91. Contract Test — Application Failure

Skill attempts Hỏa → application fails.

Expected: no Buff state change, no ElementalApplicationCommitted, no Reaction.

## 92. Contract Test — Cap Refresh

`Hỏa5` apply `Hỏa+2`.

Expected: `addedStacks = 0`, duration may refresh, Reaction not evaluated.

## 93. Contract Test — AddStacks

Reaction adds +3 Hỏa.

Expected: Hỏa stack changes, NO ElementalApplicationCommitted, NO recursive Reaction.

## 94. Contract Test — Immediate Settlement

Skill: `1. Apply Hỏa` → `2. Read Hỏa`. Reaction consumes Hỏa after step 1.

Expected: step 2 reads `Hỏa0`.

## 95. Contract Test — Stale Snapshot

Reaction selected using `Hỏa3`, `Kim4`. Before batch starts, one participant no longer matches expected snapshot.

Expected: preflight fails, entire Reaction skipped, no stacks consumed, no payoff, `reason = stale_reaction_snapshot`.

## 96. Contract Test — Death Mid-Batch

Reaction: consume states → deal damage → apply debuff. Damage kills target.

Expected: consumption remains committed, damage remains committed, final debuff skipped, no rollback.

## 97. Contract Test — Exactly Once

Scheduler receives duplicate delivery of same `eventId`.
Expected: Reaction evaluation occurs once.

## 98. Contract Test — Multicast

Initial board: `Mộc2`. Subcasts: Hỏa, Kim.

Expected: Hỏa application → Reaction settles, then Kim application → reads updated board → Reaction settles.

## 99. Contract Test — Source Isolation

Caster A: `Hỏa5`. Caster B: `Kim5`.
Expected: A cannot Dung Kim using B's Kim.

## 100. Contract Test — Damage Origins

One target receives skill damage, Hỏa periodic damage, Dung Kim Reaction damage.
Expected log origins: `skill`, `buff_periodic`, `reaction`.

## 101. Contract Test — Cấm Công

Target has Cấm Công.

Expected: attack → rejected; heal/buff/cleanse/defend → allowed. Target is not stunned.

## 102. Contract Test — Lifecycle Exception

Buff reaches turn-end expiration through `BuffSystem.onHolderTurnEnd()`.
Expected: BuffSystem may mutate/remove its own instance internally without constructing a cross-system CombatOperation.
This confirms the external mutation rule is scoped correctly.

## 103. Final Contract Invariants

| ID | Invariant |
|---|---|
| CON-01 | Static definitions contain authored intent only |
| CON-02 | Runtime operations contain resolved runtime context |
| CON-03 | Cross-authority mutation requests use CombatOperations |
| CON-04 | Internal authority lifecycle does not require artificial CombatOperations |
| CON-05 | BuffSystem is the sole BuffInstance mutation authority |
| CON-06 | ReactionSystem selects/resolves but does not mutate |
| CON-07 | DamageSystem is the damage/HP authority |
| CON-08 | Gauge authority owns Gauge mutation |
| CON-09 | Elemental Reaction observes only committed Buff state |
| CON-10 | ElementalApplicationCommitted occurs post-commit |
| CON-11 | `addedStacks > 0` is required for baseline Reaction |
| CON-12 | Generic stack mutation is not elemental application |
| CON-13 | Reaction-generated elemental changes are non-reactive by default |
| CON-14 | Reaction settles before the next authored operation |
| CON-15 | Multicast settles sequentially |
| CON-16 | Reaction batch validates snapshot preconditions before mutation |
| CON-17 | A stale Reaction is skipped atomically before mutation |
| CON-18 | After Reaction batch begins, no rollback occurs |
| CON-19 | Immediate events are processed exactly once |
| CON-20 | CombatScheduler alone owns combatSequence |
| CON-21 | Tie-breaking uses stable authored priority, not ReactionId spelling |
| CON-22 | All runtime mutations remain causally traceable |
| CON-23 | No core system contains path-specific special-case logic |

## 104. Definition Of Done

The contract is correctly implemented when:

- SkillDefinition contains no runtime IDs.
- SkillResolver produces a runtime ResolvedSkillPlan.
- Both Skill and Reaction use the shared CombatOperation layer.
- CombatOperationExecutor contains routing, not domain formulas.
- BuffSystem commits before Reaction inspection.
- Elemental application emits authoritative post-commit data.
- Failed applications cannot Reaction.
- Max-stack refresh cannot Reaction.
- Same-source Reaction board works.
- Candidate selection is deterministic.
- Reaction tie priority is explicit and stable.
- Reaction snapshot records exact participating instances/stacks.
- Reaction batch preflight prevents stale partial consumption.
- Consumption happens before Reaction payoff.
- No rollback occurs after batch execution starts.
- Target death safely skips invalid later payoff.
- Reaction-generated stacks do not recursively Reaction.
- Immediate settlement completes before next Skill operation.
- Each multicast subcast sees the fully settled previous state.
- Buff lifecycle remains internal to BuffSystem.
- Cấm Công uses generic action restriction state.
- Skill, Periodic and Reaction damage origins remain distinct.
- Exactly-once event handling is tested.
- Causal trace reconstructs cast → operation → event → Reaction → payoff.
- Same initial state + same RNG seed produces identical final trace and combat state.

## 105. Final Architecture

```
SkillDefinition
      │
      ▼
SkillResolver
      │
      ▼
ResolvedSkillPlan
      │
      ▼
CombatScheduler
      │
      ▼
CombatOperationExecutor
      │
      ├────────────► DamageSystem
      │
      ├────────────► BuffSystem
      │                 │
      │                 ▼
      │       committed elemental event
      │                 │
      │                 ▼
      │           ReactionSystem
      │                 │
      │                 ▼
      │        ReactionResolution
      │                 │
      ├─────────────────┘
      │
      ├────────────► Gauge Authority
      │
      └────────────► Resource / other owners
```

The final rule is:

- Definitions describe intent.
- Resolvers produce executable intent.
- Operations cross authority boundaries.
- Authorities own state.
- Events expose committed facts.
- Reaction interprets those facts.
- Scheduler owns ordering.
- No subsystem owns the entire battle.
- No subsystem reaches through another authority to mutate its state.
- All important state transitions are deterministic, explicit and traceable.

---

## Addendum v1.2 (2026-09-17 — locked via Buff megaplan review rounds 1–2)

Additive deltas locked in the implementation megaplan (`2026-09-17-megaplan-combat-contract.md` v7.1/v7.2). These amend the contract surface without changing any v1.1 semantic:

1. **New buff operations:** `SetBuffStacksOperation`, `SetBuffDurationOperation`, `CleanseBuffOperation` (payload `{targetId, query: BuffCleanseQuery}`), matching result-union members, `BuffAuthority.setStacks`/`setRemainingDuration`/`cleanse`. Every mutator stays reachable via an operation.
2. **`CombatAuthorityExecutionContext.combatSequence`** — the executing op's own execution-start allocation; read channel for authorities stamping internal state. **`CombatOperationExecutor.execute(op, ctx)`** — the scheduler builds the complete ctx (it owns sequence allocation); the executor never allocates or guesses. Batch/deferred entries execute through a scheduler-injected `executeEntry` lane so every entry still gets its own sequence.
3. **`createLifecycleSink(rootActionId)` → `{sink, sequence, settle}`** — `settle()` drains the scheduler and returns `ReadonlyMap<CombatOperationId, status>` for ops executed during that call (lifecycle-authority barrier + outcome correlation).
4. **`PeriodicRequestsCommitted`:** `holderId` replaced by `trigger: {type: 'holder_turn_start' | 'holder_turn_end' | 'source_turn_start' | 'source_turn_end' | 'interval' | 'manual', anchorEntityId?}` — source-turn boundaries anchor on the source and `onTimePassed` is battle-wide; requests are self-contained. Each `BuffPeriodicDamageRequest`/`BuffPeriodicHealRequest` carries emitter-minted `requestId`; generated ops are named `periodic.${requestId}` so emitters correlate settled status back to requests.
5. **`BuffPeriodicDamageRequest.snapshot?: Readonly<Record<string, number>>`** — carries apply-time captured offensive context for `scaling: 'snapshot'` periodics; DamageSystem resolves against it instead of live source stats (target mitigation still live).
6. **`remove_buff` returns `RemoveBuffResult {removed, instanceId?, stacksAtRemoval?}`** — no core mutation API returns void.
7. **Generic capability grants:** `CapabilityGrantDefinition {id, type: CapabilityType, payload: unknown}` + `ActiveCapabilityGrant` + `CapabilityValidatorRegistry` (runtime — owner domains register payload validators; unknown type throws at def load). Buff core stores/exposes grants and never interprets payloads — no path/mechanic vocabulary in buff types.
