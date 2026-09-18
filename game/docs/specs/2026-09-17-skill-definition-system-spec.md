# Skill Definition System — Final Specification

Status: FINAL — **READY FOR IMPLEMENTATION** (v1.2 — synchronized with the combat-systems program's M5 expansion, `2026-09-17-megaplan-skill-definition.md` v2; the 2026-09-17 PARKED ruling is superseded — this spec IS that program's skill mission, and its hard baseline — buff M4 cutover + reaction M-INT — is already merged)
Version: 1.2
Scope: Generic combat skill architecture
Primary consumer: Pháp Tu Reimagined
Validation kit: Hỏa
System owner: Skill System

> **v1.2 amendments (2026-09-18 — locked via Skill megaplan review):**
> - **Un-parked:** the PARKED ruling predates the combat-systems program; that program schedules this spec as its M5. Baseline already merged on master (`d65f28aa` buff M4 + `0eb2f2c1` reaction engine).
> - **Authority corrected:** BuffSystem (buff2) is the canonical buff/ailment application-stack-duration authority — the [hoa-an spec](./2026-09-17-hoa-an-ailment-system-spec.md) is CONTEXT ONLY, not an implementation dependency (parent plan ruling). Skill produces `apply_buff`/`add_buff_stacks`/`consume_buff_stacks`/`trigger_buff_periodic`/`remove_buff`/`cleanse` operation INTENT through the [Combat Contract](./2026-09-17-combat-systems-contract-spec.md); the authored `*_ailment` operations in §24 bind onto those buff operations (an ailment IS a `kind:'ailment'` BuffDefinition — buff spec §1).
> - **Three state layers (§3 rewritten):** `SkillDefinition` / `SkillProgressionState` / `SkillCombatRuntimeState` — the old `SkillRuntimeState` name conflated persistent progression with battle-scoped cast state.
> - **`remove_buff` vs `cleanse` (§24):** identified-instance removal (`RemoveBuffOperation` — selector) is distinct from query-based cleanse (`CleanseBuffOperation` — `BuffCleanseQuery`); "remove 2 debuffs" is a cleanse.
> - **`reactionEligibility` (§52):** producer-path metadata on `ApplyBuffRequest`; whether a reaction runs is the ReactionSystem capability+registry gate (`elemental_reaction_enabled`).
> - **Scope:** this spec governs the ACTIVE turn-combat skill pipeline. `PassiveSkillDefinition` schema + validation land with it; `PassiveSystem` remains a separate event-driven runtime — its migration is a documented deferred lane, not a parallel-pipeline violation.
> - **Semantic model vs concrete binding:** §§5–50 define the SEMANTIC model — immutable definition, discriminated union, deterministic ordering, snapshot-at-commit, landed semantics, typed modification language, no deep merge, no arbitrary callbacks. The concrete TURN-MODEL binding — field-level names (`operations`/`cadence`/`targetIntent`/`subcasts`/`instances`), the `ResolvedSkillPlanStep` plan IR (operation/read/branch), and the adapter field map — lives in megaplan v2 M1–M4. Where names differ, the megaplan binding governs implementation and this spec governs invariants: `primary`/`post_resolution` phases bind to authored op ordering + `cast_outcome`-gated plan steps; `once_per_target` binds to `for_each_target`/per-target step expansion; `TargetingDefinition` binds to `targetIntent` + `SkillTargetIntent`.

> **Implementation notes (2026-09-17 — partially superseded by v1.2 amendments above):**
> - ~~Depends on the ailment authority described in [2026-09-17-hoa-an-ailment-system-spec.md](./2026-09-17-hoa-an-ailment-system-spec.md)~~ → v1.2: BuffSystem (buff2) là canonical buff/ailment authority; hoa-an spec = context only; authored `*_ailment` ops bind onto contract buff ops (see §24 binding table).
> - Codebase hiện có hai skill representations sống song song: `Skill.effects: SkillEffect[]` (legacy) và `Skill.triggers: TriggerBinding[]` + `SkillAction` union (Trigger/Action rework 2026-08-31, `SkillActionRegistry`). Spec này mô tả representation thứ ba (`SkillDefinition` + `ResolvedSkillPlan`); §69 yêu cầu một executor đích — khi implement phải ruling rõ mối quan hệ với TriggerBinding path (absorb/replace), tránh ba pipeline tồn tại cùng lúc.
> - `Skill` interface hiện tại trộn definition + runtime state (level, experience, unlocked, equipped, loadoutSlot, selectedSpecializationId) — spec §3 yêu cầu tách, đây là migration thật.
> - `executionPolicy` của spec (`attack_speed`/`cooldown`/`manual`) khác `SkillExecutionPolicy` hiện tại (`attack_speed`/`cooldown`/`cast_time`/`attack_speed_cast`/`channel`); turn engine đang dùng `TurnSkillDefinition.cooldownTurns` — v1.2/R8 RESOLVED: turn units (`cooldownTurns`/`chargeTurns`) là canonical cadence duy nhất; real-time policies là retired authored metadata (see §12 note).
> - `SkillResourcePoolKey = never` hiện tại (named pools đã dời khỏi `CombatEntity`); `resourceId: 'the'` của spec đòi hỏi một Resource authority — verify owner hiện tại của Thế trước khi implement resource operations.

## 1. Purpose

`SkillDefinition` là authored immutable data mô tả:

> Một kỹ năng muốn thực hiện những operation nào, lên ai, theo thứ tự nào, dưới điều kiện nào.

`SkillDefinition` không trực tiếp sở hữu gameplay state và không tự thực thi gameplay mutation.

Nó không được tự:

- trừ HP
- thêm/xóa ailment
- thêm/xóa buff
- thay đổi resource
- resolve resistance
- roll random ngoài Combat RNG
- recompute stat
- trigger reaction thủ công

Các system tương ứng vẫn là authority.

## 2. Architecture Contract

Luồng chuẩn:

```
Skill Definition
      ↓
Skill Resolver
      ↓
Resolved Skill Plan
      ↓
Skill Executor
      ↓
┌───────────────────────────┐
│ Targeting System          │
│ Damage System             │
│ Buff System (buff2 — owns │
│   buff AND ailment state) │
│ Resource System           │
│ Healing / Shield System   │
└───────────────────────────┘
      ↓
Reaction / Proc / Event consumers
```

Trách nhiệm:

| Layer | Authority |
|---|---|
| SkillDefinition | skill muốn làm gì |
| SkillResolver | phiên bản skill hiện tại |
| SkillExecutor | thứ tự execution |
| Targeting | mục tiêu hợp lệ |
| Damage | damage thực tế |
| Buff (buff2) | buff + ailment lifecycle (ailment = `kind:'ailment'` BuffDefinition) |
| Resource | resource lifecycle |
| Reaction | elemental reaction |
| Stat | combat stat |
| Progression | permanent modifications |
| Route | stance/path modifications |

## 3. SkillDefinition Is Immutable — Three State Layers

Definition không chứa runtime state:

- current cooldown
- current charges
- last target
- last cast
- current Thế
- current route
- temporary combat modifier
- level / experience / unlock / equipped / loadout / specialization

Có BA lớp state riêng biệt — không được trộn:

```ts
// Persistent player state — SkillSystem owns, save surface
interface SkillProgressionState {
  skillId: SkillId

  level: number
  experience: number
  totalExperience: number

  selectedSpecializationId?: string

  unlocked: boolean
  equipped: boolean
  loadoutSlots: number[]
}
```

```ts
// Battle-scoped state — turn runtime owns (TurnSkillSlot home), NOT saved
interface SkillCombatRuntimeState {
  skillId: SkillId

  cooldownRemainingTurns: number

  chargeProgress?: number

  lastCastSequence?: number
}
```

Per-cast execution data (ví dụ `theBurned`, `multicastDepth`) thuộc `SkillCastSnapshot` / execution context — không nằm trong cả ba lớp trên.

Resolver nhận `SkillProgressionState` + `SkillCombatRuntimeState` như READONLY inputs.

Không được mutate static definition trong battle.

## 4. Active và Passive phải tách schema

Không ép passive vào schema active với hàng loạt field vô nghĩa.

Canonical:

```ts
type SkillDefinition =
  | ActiveSkillDefinition
  | PassiveSkillDefinition
```

## 5. ActiveSkillDefinition

```ts
interface ActiveSkillDefinition {
  kind: 'active'

  id: SkillId

  identity: SkillIdentity
  classification: ActiveSkillClassification

  targeting: TargetingDefinition
  execution: ActiveSkillExecutionDefinition

  requirements?: SkillRequirement[]

  costs?: ResourceCostDefinition[]

  effects: SkillEffectDefinition[]

  variants?: SkillVariantDefinition[]

  automation?: SkillAutomationDefinition

  presentation: SkillPresentationDefinition
  balance?: SkillBalanceMetadata
}
```

## 6. PassiveSkillDefinition

Passive skill không có:

- castTime
- manual target
- cooldown cast loop

Nó có event trigger.

```ts
interface PassiveSkillDefinition {
  kind: 'passive'

  id: SkillId

  identity: SkillIdentity

  triggers: PassiveTriggerDefinition[]

  effects: SkillEffectDefinition[]

  requirements?: SkillRequirement[]

  presentation: SkillPresentationDefinition
  balance?: SkillBalanceMetadata
}
```

Ví dụ các passive kiểu:

- Ngộ Đạo Hỗn Độn
- counter
- follow-up
- on evade
- on ally damaged

có thể dùng schema passive thay vì custom skill handler.

## 7. Identity

```ts
interface SkillIdentity {
  nameKey: string
  descriptionKey: string

  path?: CultivationPathId
  way?: WayId

  element?: ElementId

  tags: SkillTag[]
}
```

Gameplay luôn dùng `skillId`, không dùng display name.

Tên có thể đổi.
ID phải ổn định.

## 8. Active Classification

```ts
interface ActiveSkillClassification {
  slot:
    | 'basic'
    | 'special'
    | 'ultimate'

  delivery:
    | 'direct'
    | 'projectile'
    | 'area'
    | 'self'
}
```

Không cần `canCrit`, `canMiss`, `hitCount` ở đây.
Những thuộc tính đó thuộc từng damage operation.

## 9. TargetingDefinition

```ts
interface TargetingDefinition {
  allegiance:
    | 'enemy'
    | 'ally'
    | 'self'
    | 'any'

  selector:
    | 'single'
    | 'all'
    | 'random'
    | 'lowest_hp'
    | 'highest_hp'
    | 'boss_priority'

  maxTargets?: number

  filters?: TargetFilter[]

  invalidTargetPolicy:
    | 'fail_cast'
    | 'retarget'
    | 'skip_target'
}
```

Random target bắt buộc dùng deterministic Combat RNG.

Forbidden: `Math.random()`

## 10. Target Lifetime

Target selection và target validity là hai thứ khác nhau.

Recommended lifecycle:

```
Cast Start
↓
target intent exists
↓
Cast Commit
↓
Targeting System resolves actual targets
↓
effects execute
```

Trước mỗi effect: target validity rechecked.

Ví dụ:

```
Damage kills Enemy A
↓
later ApplyAilment effect
↓
Enemy A is dead
↓
effect skipped
```

Không apply Hỏa Ấn lên corpse.

## 11. Deterministic Target Ordering

Multi-target skills phải sử dụng stable combat entity ordering.

Không phụ thuộc:

- DOM order
- render order
- JS object order
- UI slot order

Điều này cần thiết cho:

- replay
- tests
- reaction ordering
- proc ordering

## 12. Execution

```ts
interface ActiveSkillExecutionDefinition {
  castTime: number
  cooldown: number

  interruptible: boolean

  executionPolicy:
    | 'attack_speed'
    | 'cooldown'
    | 'manual'
}
```

`execution` chỉ sở hữu cast mechanics.
Không chứa damage semantics.

**v1.2 — turn binding (R8):** canonical ACTIVE cadence là TURN units — `cadence {cooldownTurns, chargeTurns?}` trong megaplan binding. `castTime`/`cooldown` (giây) và `executionPolicy` ở đây là legacy real-time authored metadata — không phải combat authority trong turn engine; adapter giữ chúng cho tooltip, không đưa vào plan.

## 13. Cast Lifecycle

Canonical:

```
PRECHECK
↓
CAST_START
↓
casting / delay
↓
CAST_COMMIT
↓
resolve targets
↓
PRIMARY
↓
derive cast outcome
↓
POST_RESOLUTION
↓
CAST_COMPLETE
```

Đây là thay đổi quan trọng so với draft trước.

## 14. Cooldown Timing

Default: cooldown starts at CAST_COMMIT

Nếu skill bị interrupt trước commit:

- không bắt đầu cooldown

trừ skill explicit định nghĩa khác.

## 15. Resource Cost

```ts
interface ResourceCostDefinition {
  resourceId: ResourceId

  amount: ScalarExpression

  timing:
    | 'cast_start'
    | 'cast_commit'

  insufficientPolicy:
    | 'block_cast'
}
```

Pháp Tu Reimagined hiện không dùng MP làm skill cost.
Không cần thêm cost field rỗng vào từng skill.

## 16. Effects có Phase

```ts
type SkillEffectPhase =
  | 'primary'
  | 'post_resolution'
```

`primary` = gameplay action xác định skill đã thực sự kết nối/thực hiện thành công hay chưa.

`post_resolution` = action phụ thuộc kết quả của toàn bộ primary phase.

Ví dụ: `+5 Thế if Basic landed` phải nằm ở `post_resolution`, không nằm chung primary sequence.

## 17. SkillEffectDefinition

```ts
interface SkillEffectDefinition {
  id: SkillEffectId

  phase:
    | 'primary'
    | 'post_resolution'

  order: number

  target:
    | 'skill_targets'
    | 'source'
    | TargetSelectorOverride

  cardinality:
    | 'once_per_cast'
    | 'once_per_target'

  condition?: SkillCondition

  operation: SkillOperationDefinition

  invalidTargetPolicy?:
    | 'skip_effect'
    | 'skip_target'
    | 'stop_skill'
}
```

Effect ID phải stable.

## 18. Effect Ordering

Sort:

```
phase
→ order
→ authored stable index
```

Ví dụ Dẫn Hỏa:

```
PRIMARY 100 direct_damage
PRIMARY 200 apply_hoa_an

POST 100 gain_the
```

Không dùng array insertion order như hidden gameplay rule.

## 19. Primary Outcome

Sau khi toàn bộ Primary phase hoàn tất, Skill Executor tạo:

```ts
interface SkillPrimaryOutcome {
  connected: boolean

  connectedTargets: CombatEntityId[]

  validTargetCount: number

  primaryEffectResults: SkillEffectResult[]
}
```

## 20. Canonical "Landed" Semantic

`landed` không đồng nghĩa `damage > 0`.

Canonical:

> Một offensive skill được coi là `landed` nếu ít nhất một Primary effect thành công kết nối với ít nhất một target hợp lệ.

Examples:

**Damage**

- Hit kết nối nhưng shield absorb toàn bộ: `landed = true`
- Miss: `landed = false`

**Ailment-only skill**

- Ailment application thành công: `landed = true`
- Ailment application bị resist/fail: `landed = false`

**Offensive debuff**

- Debuff apply thành công: `landed = true`

**Self-utility**

- Self buff/heal/resource cast thành công: `landed = true` (self là valid target) — nhưng không gọi là "hit". `landed` KHÔNG đồng nghĩa "không fail": nó yêu cầu ít nhất một primary effect mang connection semantics kết nối/resolve thành công.

Điều này hỗ trợ skill như `Độc Chưởng` mà không cần fake 0-damage hit.

## 21. EffectResult phải định nghĩa `connected`

```ts
interface SkillEffectResult {
  effectId: SkillEffectId

  success: boolean
  connected: boolean

  targets: SkillEffectTargetResult[]
}
```

Per-target:

```ts
interface SkillEffectTargetResult {
  targetId: CombatEntityId

  success: boolean
  connected: boolean

  damageDealt?: number

  stacksAdded?: number
  stacksConsumed?: number

  resourceDelta?: number
}
```

Không chỉ lưu aggregate total vì later effect có thể cần dữ liệu riêng từng target.

## 22. Post-Resolution Effects

Sau khi primary outcome được tạo:

```
POST_RESOLUTION effects execute
```

Ví dụ:

```
Basic landed
→ +5 Thế
```

condition:

```ts
{
  query: 'cast_outcome',
  field: 'landed'
}
```

Không còn circular dependency.

## 23. Cardinality

Đây là required field.

- AoE Damage: `once_per_target`
- Gain Thế: `once_per_cast`

Nếu Ultimate trúng 5 target, +Thế vẫn chỉ xảy ra một lần trừ khi skill explicit thiết kế `per_target`.

## 24. Operation Union

V1 hỗ trợ:

```ts
type SkillOperationDefinition =
  | DamageOperation
  | HealOperation

  | ApplyAilmentOperation
  | ModifyAilmentOperation
  | TriggerAilmentTickOperation
  | ConsumeAilmentOperation

  | ApplyBuffOperation
  | RemoveBuffOperation
  | CleanseBuffOperation

  | ResourceGainOperation
  | ResourceConsumeOperation

  | ShieldOperation
```

Không thêm custom operation chỉ vì một skill mới cần convenience syntax.

**v1.2 — Combat Contract binding:** authored operations bind onto contract buff ops (ailment = `kind:'ailment'` BuffDefinition):

| Authored | → Contract op |
|---|---|
| `apply_ailment` / `apply_buff` | `ApplyBuffOperation` (carries `reactionEligibility`) |
| `modify_ailment` | `AddBuffModifierOperation` / stack ops |
| `trigger_ailment_tick` | `TriggerBuffPeriodicOperation` |
| `consume_ailment` | `ConsumeBuffStacksOperation` |
| `remove_buff` | `RemoveBuffOperation` — **identified instance via selector** |
| `cleanse` | `CleanseBuffOperation` — **query-based** (`{kind?, tags?, element?}`, `count?`) — "remove 2 debuffs" là cleanse, KHÔNG phải remove_buff |

## 25. DamageOperation

```ts
interface DamageOperation {
  type: 'damage'

  damageProfile: DamageProfileId

  element?: ElementId

  coefficient: ScalarExpression

  hitCount: number

  canCrit: boolean
  canMiss: boolean

  tags?: DamageTag[]
}
```

Example:

```ts
{
  type: 'damage',

  damageProfile: 'phap_tu_spell',

  element: 'fire',

  coefficient: 1.0,

  hitCount: 1,

  canCrit: true,
  canMiss: true
}
```

## 26. Damage Profile

Không lặp trong từng skill:

- intelligence scaling
- attunement scaling
- spell base formula
- generic element formula

Nếu nhiều skill dùng cùng combat formula, dùng `damageProfile`.

Ví dụ:

- `phap_tu_spell`
- `physical_weapon`
- `ailment_tick`

Damage System sở hữu profile calculation.
Skill chỉ cung cấp coefficient và overrides thật sự cần thiết.

## 27. Damage Ownership

Skill: request damage

Damage System:

- accuracy
- crit
- resistance
- mitigation
- shield
- HP mutation
- death
- damage events

Không copy damage calculation vào Skill Executor.

## 28. ApplyAilmentOperation

```ts
interface ApplyAilmentOperation {
  type: 'apply_ailment'

  ailmentId: AilmentId

  stacks: ScalarExpression
  chance: ScalarExpression

  durationOverride?: ScalarExpression

  sourceScope: 'caster'
}
```

BuffSystem (buff2) sở hữu:

- RNG (application roll — CombatRng, không skill tự roll)
- resistance
- stack
- refresh
- duration
- modifier

`reactionEligibility` là producer-path metadata do SKILL author/adapter quyết định (§52) — BuffSystem chỉ mang nó qua committed event.

## 29. ModifyAilmentOperation

```ts
interface ModifyAilmentOperation {
  type: 'modify_ailment'

  ailmentId: AilmentId

  scope:
    | 'caster_owned'
    | 'specific_source'
    | 'all_sources'

  modification: AilmentModificationDefinition
}
```

Ví dụ: potency ×1.5 / 2 target turns

## 30. TriggerAilmentTickOperation

```ts
interface TriggerAilmentTickOperation {
  type: 'trigger_ailment_tick'

  ailmentId: AilmentId

  scope: 'caster_owned'

  count: ScalarExpression
}
```

BuffSystem quyết định tick semantics (`TriggerBuffPeriodicOperation` — không advance lifetime trừ khi lifecycle yêu cầu riêng).

## 31. ConsumeAilmentOperation

```ts
interface ConsumeAilmentOperation {
  type: 'consume_ailment'

  ailmentId: AilmentId

  scope: 'caster_owned'

  stacks:
    | ScalarExpression
    | 'all'
}
```

Skill không mutate stacks trực tiếp.

## 32. Resource Operations

Gain:

```ts
interface ResourceGainOperation {
  type: 'resource_gain'

  resourceId: ResourceId
  amount: ScalarExpression
}
```

Consume:

```ts
interface ResourceConsumeOperation {
  type: 'resource_consume'

  resourceId: ResourceId

  amount:
    | ScalarExpression
    | 'all'

  valueSource?:
    | 'current'
    | 'cast_snapshot'
}
```

`cast_snapshot` đặc biệt quan trọng cho empowered Ultimate.

## 33. ScalarExpression

Không dùng arbitrary callbacks.

Allowed:

```ts
type ScalarExpression =
  | number

  | {
      op: 'add'
      values: ScalarExpression[]
    }

  | {
      op: 'multiply'
      values: ScalarExpression[]
    }

  | {
      op: 'subtract'
      left: ScalarExpression
      right: ScalarExpression
    }

  | {
      op: 'divide'
      left: ScalarExpression
      right: ScalarExpression
    }

  | {
      op: 'min'
      values: ScalarExpression[]
    }

  | {
      op: 'max'
      values: ScalarExpression[]
    }

  | {
      op: 'clamp'
      value: ScalarExpression
      min: ScalarExpression
      max: ScalarExpression
    }

  | {
      op: 'if'
      condition: SkillCondition
      then: ScalarExpression
      else: ScalarExpression
    }

  | SkillValueQuery
```

Không hỗ trợ: `(ctx) => arbitraryLogic(ctx)`

## 34. Value Queries

Supported examples:

- `ailment_stacks`
- `ailment_duration`
- `resource_current`
- `resource_max`
- `resource_snapshot`
- `target_hp_percent`
- `source_hp_percent`
- `skill_level`
- `effect_result`
- `cast_outcome`

Queries: readonly, deterministic, side-effect free.

## 35. Per-Target Expression Context

Nếu effect `once_per_target` thì expression như `ailment_stacks(current_target)` được evaluate riêng cho từng target.

Ví dụ Nổ Ultimate:

```
Enemy A: 5 Hỏa Ấn
Enemy B: 2 Hỏa Ấn
Enemy C: 0 Hỏa Ấn
```

mỗi enemy nhận coefficient riêng.

## 36. Conditions

Conditions cũng pure/read-only.

Supported logical primitives:

- comparison
- and
- or
- not

Queries có thể kiểm tra:

- has ailment
- ailment stack count
- resource
- HP
- effect result
- cast outcome

Không được làm mutation trong condition.

## 37. Variants

Route hoặc empowered form không tạo duplicate SkillDefinition.

Base: `phan_thien_liet_diem`

Variants:

- `route_dot`
- `route_no`
- `empowered_dot`
- `empowered_no`

## 38. Variant Definition

```ts
interface SkillVariantDefinition {
  id: SkillVariantId

  activation: SkillCondition

  priority: number

  modifications: SkillModification[]
}
```

Variant resolution phải deterministic.

## 39. Cast Snapshot

Tại `CAST_COMMIT`, Skill Resolver tạo immutable snapshot của những state cần thiết cho cast:

```ts
interface SkillCastSnapshot {
  sourceId: CombatEntityId

  activeRoute?: RouteId

  resources: Readonly<Record<ResourceId, number>>

  activeVariantIds: SkillVariantId[]

  combatSequence: number
}
```

Điều kiện empowered được quyết định tại đây.

## 40. Empowered State Cannot Change Mid-Cast

Ví dụ:

```
cast starts at 98 Thế
nhưng trong thời gian cast có một effect khác đưa caster lên 102.
Nếu threshold được kiểm tra tại commit và lúc đó là 102:
empowered
Nếu commit snapshot là 98:
base Ultimate
```

Sau commit, variant không đổi giữa chừng.

## 41. Thế Burn Snapshot

Nếu empowered Ultimate commit với 120 Thế thì `theBurned = 120` được snapshot.

Nếu Primary effect nào đó vô tình gain thêm Thế, không làm `theBurned` tăng thành 125.

Consume effect dùng `cast_snapshot`.

## 42. SkillModification Language

Route, progression và skill-specific equipment modifiers nên dùng cùng modification language.

Canonical:

```ts
type SkillModification =
  | SetParameterModification
  | AddParameterModification
  | MultiplyParameterModification

  | EnableEffectModification
  | DisableEffectModification

  | AppendEffectModification
```

## 43. Typed Modification Address

Không dùng:

```ts
param: 'effects[2].operation.foo.bar'
```

hoặc arbitrary object paths.

Use typed address:

```ts
{
  effectId: 'apply_hoa_an',
  field: 'chance'
}
```

Supported fields phải được schema registry biết trước.

Điều này cho phép:

- validation
- type safety
- migration
- debug trace

## 44. Example Modification

DoT route:

```ts
{
  type: 'multiply_parameter',

  target: {
    effectId: 'apply_hoa_an',
    field: 'chance'
  },

  value: 1.25
}
```

Stack:

```ts
{
  type: 'add_parameter',

  target: {
    effectId: 'apply_hoa_an',
    field: 'stacks'
  },

  value: 1
}
```

## 45. No Generic Deep Merge

Forbidden: `deepMerge(baseSkill, routeOverride)`

Lý do:

- array semantics mơ hồ
- override khó trace
- conflict âm thầm
- schema validation yếu

Modification phải explicit.

## 46. Resolution Layers

Skill-specific resolution order:

1. Base Definition
2. Permanent Progression
3. Skill-specific Equipment / Build
4. Route Variant
5. Empowered Variant
6. Temporary Skill Modifiers

Global modifiers không nên patch skill nếu chúng thực sự là combat-stat modifier.

Ví dụ `Nổ +8% crit` / `Nổ +25% crit damage` nên nằm ở Route Combat Modifier nếu áp dụng toàn bộ route.

## 47. Numeric vs Behaviour Modification

Không phải mọi thứ đều nên biến thành `+5% damage`.

Schema phải hỗ trợ behaviour modifications như:

- enable effect
- disable effect
- append effect
- change ailment stacks
- change next-tick modifier
- change consume semantics

Progression tree vì vậy có thể thay đổi cách skill chơi chứ không chỉ tăng số.

## 48. Modifier Conflict

Nếu hai sources cùng SET same field, resolver không được phụ thuộc insertion order.

Conflict phải:

- resolve qua priority
- hoặc validation error

Tất cả resolution phải deterministic.

## 49. ResolvedSkillPlan

Trước execution:

```ts
interface ResolvedSkillPlan {
  skillId: SkillId

  snapshot: SkillCastSnapshot

  activeVariants: SkillVariantId[]

  targeting: ResolvedTargetingDefinition
  execution: ResolvedExecutionDefinition

  primaryEffects: ResolvedSkillEffect[]
  postResolutionEffects: ResolvedSkillEffect[]

  trace?: SkillResolutionTrace
}
```

Executor chỉ chạy `ResolvedSkillPlan`.
Không vừa execute vừa tiếp tục patch definition.

## 50. Resolution Trace

Development build nên có trace.

Example:

```
Dẫn Hỏa Quyết
apply_hoa_an.chance

base             0.70
route_dot        ×1.25
node_dan_hoa_2   +0.05
final            0.925
```

Hoặc:

```
direct_damage.coefficient

base             1.00
route_dot        ×0.85
progression      ×1.10

final            0.935
```

Đây là infrastructure cực kỳ giá trị cho QA và balance.

## 51. Automation

Automation chỉ quyết định WHEN / WHO.
Không quyết định gameplay rules.

```ts
interface SkillAutomationDefinition {
  priority?: number

  targetPolicy?: AutomationTargetPolicy

  castConditions?: AutomationCondition[]
  holdConditions?: AutomationCondition[]
}
```

Ví dụ `hold Ultimate until Thế >= 100` là AI behavior, không phải skill requirement.
Người chơi vẫn có thể manually cast base Ultimate dưới 100 Thế.

## 52. Reaction Boundary

Skill Definition không trực tiếp xử lý generic elemental reaction.

Correct:

```
Skill
↓
ApplyBuffOperation (reactionEligibility = eligible | suppressed)
↓
BuffSystem commits → ElementalApplicationCommitted
↓
Reaction gate: eligibility → addedStacks>0 → capability (elemental_reaction_enabled)
↓
Reaction System observes state
```

Không `skill.triggerReaction()` trừ mechanic đặc biệt cố tình forced reaction và đã được architecture review.

**v1.2:** `reactionEligibility` là producer-path metadata do skill/adapter quyết định lúc author/convert — `'eligible'` cho normal external elemental applications, `'suppressed'` cho reaction-generated/recursive lanes. Việc reaction có thực sự chạy hay không do ReactionSystem's capability+registry gate quyết định (`elemental_reaction_enabled`) — skill KHÔNG quyết định reaction execution, và KHÔNG đọc legacy capability flags của caster.

## 53. Passive Trigger Contract

Passive skill sử dụng semantic combat events.

Conceptual:

```ts
interface PassiveTriggerDefinition {
  event:
    | 'skill_landed'
    | 'damage_taken'
    | 'damage_dealt'
    | 'ailment_applied'
    | 'ailment_tick'
    | 'evade'
    | 'turn_start'
    | 'turn_end'

  condition?: SkillCondition

  cooldown?: number
  procChance?: number
}
```

Proc chance phải dùng deterministic Combat RNG.

## 54. Proc Recursion Protection

Passive/reactive skills cần infrastructure chống loop.

Ví dụ:

```
A triggers B
B triggers A
A triggers B...
```

Event context nên có `procDepth` / `originChain` và engine-wide recursion limit.
Không implement guard riêng từng skill.

## 55. Presentation

```ts
interface SkillPresentationDefinition {
  iconId: AssetId

  nameKey: string
  shortDescriptionKey: string
  tooltipKey?: string

  animationId?: string
  castVfxId?: string
  hitVfxId?: string
}
```

Gameplay không phụ thuộc VFX.

## 56. Tooltip

Tooltip lấy resolved params.
Không hard-code `70%`, `1.0x`, `+5 Thế` trong localization string.

Use placeholders.

Ví dụ:

```
Gây {damage} sát thương Hỏa.
Có {chance}% gây {stacks} Hỏa Ấn.
```

## 57. Probability Convention

Canonical: `0.0 → 1.0`

Example: `chance: 0.70`

Không mix `70`, `0.7`, `"70%"`.

## 58. Multiplier Convention

Canonical:

- `1.00` = normal
- `1.15` = +15%
- `0.85` = -15%

## 59. Validation

Definition validation phải bắt được ít nhất:

- duplicate skill ID
- duplicate effect ID
- unknown ailment
- unknown resource
- unknown damage profile
- invalid effect field modification
- negative cast time
- negative cooldown
- chance outside valid resolved range
- invalid target selector
- unknown expression query
- division by zero
- NaN
- Infinity
- invalid passive/active fields
- variant targeting nonexistent effect
- conflicting modifiers without resolution rule

## 60. Deterministic RNG

Tất cả randomness:

- hit
- crit
- ailment application
- random target
- passive proc
- random skill selection

phải dùng một deterministic Combat RNG infrastructure.
Không skill tự sở hữu RNG.

## 61. Dẫn Hỏa Quyết — Canonical Validation Example

```ts
const DAN_HOA_QUYET: ActiveSkillDefinition = {
  kind: 'active',

  id: 'dan_hoa_quyet',

  identity: {
    nameKey: 'skill.dan_hoa_quyet.name',
    descriptionKey: 'skill.dan_hoa_quyet.description',

    path: 'phap_tu',
    way: 'ngu_hanh',
    element: 'fire',

    tags: [
      'offensive',
      'fire',
      'ailment_application'
    ]
  },

  classification: {
    slot: 'basic',
    delivery: 'projectile'
  },

  targeting: {
    allegiance: 'enemy',
    selector: 'single',

    filters: [
      { type: 'alive' }
    ],

    invalidTargetPolicy: 'retarget'
  },

  execution: {
    castTime: 1.4,
    cooldown: 0,

    interruptible: true,

    executionPolicy: 'attack_speed'
  },

  effects: [
    {
      id: 'direct_damage',

      phase: 'primary',
      order: 100,

      target: 'skill_targets',
      cardinality: 'once_per_target',

      operation: {
        type: 'damage',

        damageProfile: 'phap_tu_spell',
        element: 'fire',

        coefficient: {
          op: 'if',

          condition: {
            query: 'has_ailment',
            ailmentId: 'hoa_an',
            sourceScope: 'caster'
          },

          then: 1.15,
          else: 1.00
        },

        hitCount: 1,

        canCrit: true,
        canMiss: true
      }
    },

    {
      id: 'apply_hoa_an',

      phase: 'primary',
      order: 200,

      target: 'skill_targets',
      cardinality: 'once_per_target',

      condition: {
        query: 'effect_target_result',
        effectId: 'direct_damage',
        field: 'connected',
        target: 'current_target'
      },

      operation: {
        type: 'apply_ailment',

        ailmentId: 'hoa_an',

        stacks: 1,
        chance: 0.70,

        sourceScope: 'caster'
      }
    },

    {
      id: 'gain_the',

      phase: 'post_resolution',
      order: 100,

      target: 'source',
      cardinality: 'once_per_cast',

      condition: {
        query: 'cast_outcome',
        field: 'landed'
      },

      operation: {
        type: 'resource_gain',

        resourceId: 'the',
        amount: 5
      }
    }
  ],

  variants: [
    {
      id: 'route_dot',

      priority: 100,

      activation: {
        query: 'active_route',
        equals: 'dot'
      },

      modifications: [
        {
          type: 'multiply_parameter',

          target: {
            effectId: 'apply_hoa_an',
            field: 'chance'
          },

          value: 1.25
        },

        {
          type: 'add_parameter',

          target: {
            effectId: 'apply_hoa_an',
            field: 'stacks'
          },

          value: 1
        }
      ]
    },

    {
      id: 'route_no',

      priority: 100,

      activation: {
        query: 'active_route',
        equals: 'no'
      },

      modifications: [
        {
          type: 'multiply_parameter',

          target: {
            effectId: 'apply_hoa_an',
            field: 'chance'
          },

          value: 0.50
        }
      ]
    }
  ],

  presentation: {
    iconId: 'skill_fire_basic',

    nameKey: 'skill.dan_hoa_quyet.name',

    shortDescriptionKey:
      'skill.dan_hoa_quyet.short'
  }
}
```

## 62. Important Note on Route Damage

Current route profile contains approximately:

- DoT direct damage ×0.85
- Nổ direct damage ×1.15

Nếu đây là modifier áp dụng cho toàn bộ direct damage của route, nó không nên được lặp trong mỗi SkillDefinition.

Nó thuộc Route Combat Modifier và Damage System nhận resolved combat modifier.

Skill overlay chỉ chứa những thay đổi riêng của skill như:

- +1 Hỏa Ấn
- different per-stack coefficient
- enable next-tick mechanic
- enable consume mechanic

## 63. Skill-Specific vs System-Wide Params

Rule: nếu cùng một rule áp dụng cho mọi skill của route/path, đừng patch từng skill.

Examples:

**Route-level**

- direct damage ×0.85
- ailment potency +30%
- crit +8%
- crit damage +25%

**Skill-level**

- Dẫn Hỏa +1 Hỏa Ấn
- Xích Viêm next tick ×1.5
- Ultimate consume Hỏa Ấn

Điều này tránh config duplication và drift.

## 64. No Custom Runtime Handler by Default

Forbidden default pattern:

```ts
execute(ctx) {}
onCast(ctx) {}
onHit(ctx) {}
customDamage(ctx) {}
customHandler: ...
```

Nếu một mechanic không thể biểu diễn: trước tiên review primitive set, chứ không lập tức thêm callback.

## 65. Scripted Escape Hatch

Nếu cuối cùng thật sự cần:

```ts
operation: {
  type: 'scripted',
  handlerId: '...'
}
```

thì bắt buộc có:

- documented reason
- declared owner
- declared inputs
- declared outputs
- automated tests
- architecture approval

Mục tiêu cho Pháp Tu elemental kit: `scripted operation count = 0`

## 66. Runtime Events

Skill System emit semantic events:

```
skill_cast_started
skill_cast_committed

skill_primary_resolved
skill_landed

skill_effect_resolved

skill_cast_completed

skill_cast_interrupted
skill_cast_failed
```

Events được publish sau state commit tương ứng.

## 67. Event Reentrancy

Event consumer không mutate đang-nửa-chừng Skill Executor state.

New gameplay command được queue và execute qua combat scheduler.
Tránh nested mutation không kiểm soát.

## 68. Save / Serialization

Static SkillDefinition không lưu vào save.

Persist = `SkillProgressionState`:

- skillId
- unlock
- level
- experience / totalExperience
- equipped state / loadoutSlots
- progression choices (selectedSpecializationId)

`SkillCombatRuntimeState` (cooldown/charge/cast sequence) KHÔNG persist — battle-scoped, recreated per battle.

Load: resolve definition from registry + rehydrate progression state.

Balance values không nằm trong save.

## 69. Migration Requirement

Project hiện có nhiều authored skill cũ.
Migration không cần big-bang.

Recommended:

```
Old Skill Data
     ↓
temporary compatibility adapter
     ↓
ResolvedSkillPlan
```

Skill mới/Reimagined dùng schema mới trực tiếp.
Không viết hai executors lâu dài.

Destination architecture vẫn phải là:

```
one ResolvedSkillPlan
one ACTIVE turn-combat execution pipeline
```

(PassiveSystem là separate event-driven runtime — documented deferred lane, không tính là "parallel pipeline" — v1.2 scope note.)

## 70. Required Tests — Core Schema

Phải có automated tests cho:

- immutable definition
- active/passive validation
- effect phase ordering
- effect order deterministic
- once_per_cast
- once_per_target
- target revalidation
- target dies between effects
- landed from direct damage
- landed when damage fully absorbed
- not landed on miss
- landed from ailment-only skill
- not landed when ailment fails
- post-resolution sees final primary outcome
- variant activation snapshot
- variant cannot change mid-cast
- resource snapshot
- modifier ordering
- modifier conflict
- per-target expression
- AoE landed semantics
- deterministic RNG
- readonly queries
- script-free Hỏa kit resolution

## 71. Required Tests — Dẫn Hỏa Quyết

Minimum:

- hit + ailment success → landed → gain 5 Thế
- hit + ailment fail → landed → gain 5 Thế
- miss → no ailment attempt → no Thế
- shield absorbs 100% → still landed → gain 5 Thế
- target already Hỏa Ấn → direct coefficient 1.15
- DoT route → resolved application chance ×1.25 → +1 stack request
- Nổ route → resolved application chance ×0.50
- target dies from direct damage → Hỏa Ấn application skipped → skill still landed → gain Thế

Điểm cuối rất quan trọng: kết liễu mục tiêu vẫn là landed cast dù target chết trước effect apply ailment.

## 72. Architecture Invariants

| Area | Invariant |
|---|---|
| Definition | Immutable |
| State | THREE layers — Definition / SkillProgressionState / SkillCombatRuntimeState |
| Active/Passive | Discriminated union |
| Plan | `ResolvedSkillPlanStep` IR — reads/branches are executor-owned steps, never CombatOperations |
| Reads | Narrow READONLY query ports — never the CombatAuthorityPorts command surface |
| Cleanse | `cleanse` (query) ≠ `remove_buff` (identified selector) |
| Mutation | System-owner only |
| RNG | Deterministic |
| Target order | Deterministic |
| Effects | Phase + explicit order |
| Landed | Resolved after Primary |
| Post effects | Run after outcome exists |
| Damage | Damage System |
| Buff + Ailment | BuffSystem (buff2) |
| Resource | Resource System |
| Reaction | Reaction System |
| Expressions | Pure |
| Conditions | Pure |
| Modification | Typed + explicit |
| Deep merge | Forbidden |
| Variants | Snapshot at commit |
| Empowered state | Fixed for that cast |
| Custom callback | Forbidden by default |
| Query | Readonly |

## 73. Definition of Done

Skill Definition System chỉ được xem là đủ cho Pháp Tu khi cùng một infrastructure biểu diễn được hoàn chỉnh:

- Dẫn Hỏa Quyết
- Xích Viêm Xuyên Tâm
- Phần Thiên Liệt Diễm
- DoT route
- Nổ route
- Empowered DoT Ultimate
- Empowered Nổ Ultimate

bao gồm:

- direct damage
- conditional damage
- ailment application
- ailment stack query
- ailment modification
- manual ailment tick
- ailment consume
- resource gain
- resource consume
- resource snapshot
- single target
- AoE
- per-target formula
- route variant
- empowered variant
- progression modification
- automation
- tooltip resolved values

mà không cần Hỏa-specific runtime handler.

Nếu một trong ba skill Hỏa cần custom handler: review primitive/schema trước khi chấp nhận handler.

## 74. Final Principle

`SkillDefinition` không phải code gameplay được viết bằng JSON/TypeScript object.

Nó là declarative combat data.

Một skill tốt nên đọc được như:

```
PRIMARY
- gây 1.0 Fire spell damage
- nếu hit, thử apply 1 Hỏa Ấn với 70%

POST
- nếu cast landed, nhận 5 Thế
```

chứ không phải:

```ts
if (...) {
  calculateSomething()
  mutateTarget()
  triggerSomethingElse()
}
```

Mục tiêu cuối cùng: skill mới chủ yếu được tạo bằng data + primitives đã có, còn engine chỉ phải thay đổi khi game thật sự xuất hiện một loại hành vi mới.
