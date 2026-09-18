# Buff System Reimagined — Final Architecture Specification

Status: FINAL — **PARKED: lưu trữ, chỉ xử lý sau khi toàn bộ mission hiện tại chạy xong** (user ruling 2026-09-17)
Version: 1.6
Compatibility requirement: None
Migration requirement: None
Primary reference implementation: Hỏa Ấn
System owner: Buff System
Architecture style: Breaking redesign / single authority / data-first

> **Implementation notes (2026-09-17):**
> - Đây là spec foundation của trilogy: "Ailment System" trong [hoa-an spec](./2026-09-17-hoa-an-ailment-system-spec.md) = BuffSystem này (ailment là `kind: 'ailment'`); buff operations trong [skill-definition spec](./2026-09-17-skill-definition-system-spec.md) map lên §65. Cả ba cùng PARKED.
> - Problem list B01–B20 đã verify trên code hiện tại: `scaleBuffPotency`/`potencyAmplified` tồn tại (`BuffSystem.ts:36-47`), `damagePerTurn`/`damagePerSecond` snapshot lúc apply (`BuffSystem.ts:90-91`), `Math.random()` trong proc paths (`BuffSystem.ts:488,514`), runtime mutable `effects` (`BuffTypes.ts:220-221,313`).
> - **RESOLVED by implementation review (megaplan v2–v6):** `TurnBuffSystem`/`TurnBuffPool` — no independent turn authority exists to absorb; the codebase already retired those impls (only test files importing `core/buff` remain — megaplan M5 renames/verifies). `player.persistentTimedEffects` is NOT a buff pool (Kiếp Thương-style persistent state stays untouched); persistent buffs are owned by `GameManager.buffPool` → megaplan `BuffPersistence` wrapper.
> - **Migration ruling (locked):** §73 wins — NO compat layer, NO dual-run, data-first migration → consumer cutover → old package deletion. Skill spec §69's temporary-adapter permission does NOT extend to the buff authority.

## 1. Purpose

Buff System là authority duy nhất của persistent combat state có lifecycle.

Bao gồm:

- Buff
- Debuff
- Ailment
- Marker
- Stack
- Duration
- Persistent modifier
- Periodic status
- Control-state presence
- Persistent capability grants

Buff System không phải authority của:

- Damage formula
- Healing formula
- Skill execution
- Targeting
- Reaction rules
- Proc logic
- Path mechanics
- Resource economy
- Combat turn scheduling
- Stat calculation
- AI

## 2. Problems Confirmed In Current Engine

Các vấn đề hiện tại cần được loại bỏ thay vì vá tiếp.

| ID | Problem | Severity |
|---|---|---|
| B01 | DoT resolve damage khi apply rồi lưu `damagePerTurn` | Critical |
| B02 | Runtime `Buff.effects` là mutable copy | Critical |
| B03 | `scaleBuffPotency()` mutate magnitude trực tiếp | Critical |
| B04 | `potencyAmplified` là workaround cho thiếu modifier model | High |
| B05 | Tick và duration progression bị gộp trong `update()` | Critical |
| B06 | Không có manual periodic trigger | Critical |
| B07 | Consume / cleanse / expire đều gần như là remove | High |
| B08 | Không có first-class stack consumption | High |
| B09 | Modifier không có identity / lifetime / stacking policy | Critical |
| B10 | Refresh giữ lại destructive mutation cũ | High |
| B11 | Combat proc sử dụng trực tiếp `Math.random()` | Critical |
| B12 | BuffSystem execute reactive/proc mechanics | High |
| B13 | `BuffEffectTemplate` đang thành catch-all gameplay union | High |
| B14 | Một `update()` xử lý turn + seconds + persistence | High |
| B15 | Consumer có thể nhận mutable Buff | High |
| B16 | Pool routing tạo authority/routing complexity | High |
| B17 | Tick timing không phải authored contract rõ ràng | High |
| B18 | Duration scaling / lifetime clock / tick timing đang trộn | High |
| B19 | Dynamic periodic scaling không biểu diễn sạch | Critical |
| B20 | Reaction/Skill phải biết Buff implementation details | High |

## 3. Core Architecture

Target model:

```
              BuffDefinition
              immutable data
                    │
                    ▼
              BuffSystem
          state + lifecycle authority
                    │
              BuffInstance
        ┌───────────┼───────────┐
        │           │           │
      stacks     lifetime    modifiers
        │           │           │
        └───────────┼───────────┘
                    │
              resolved intents
                    │
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
 DamageSystem   StatSystem    Proc/Reaction
```

Buff System lưu và thay đổi persistent state.
Các authority khác xử lý gameplay domain của họ.

## 4. Canonical System Shape

```ts
class BuffSystem {
  private readonly instances:
    Map<BuffInstanceId, BuffInstance>

  constructor(
    private readonly definitions: BuffRegistry,
    private readonly applicationResolver: BuffApplicationResolver,
    private readonly periodicResolver: BuffPeriodicResolver,
    private readonly events: CombatEventQueue,
  ) {}
}
```

Một BuffSystem canonical cho battle.
Không tạo `new BuffSystem(targetBuffPool)` theo từng target.

## 5. BuffPool Is Removed As Gameplay Authority

Không còn:

```
Entity A → BuffPool
Entity B → BuffPool
Entity C → BuffPool
```

Canonical storage thuộc BuffSystem.

Mỗi instance tự chứa:

- definitionId
- sourceId
- targetId

Query theo target/source chỉ là index/query.

## 6. BuffDefinition

```ts
interface BuffDefinition {
  id: BuffDefinitionId

  name: string
  description?: string

  kind:
    | 'buff'
    | 'debuff'
    | 'ailment'
    | 'marker'

  element?: ElementType

  instanceScope: BuffInstanceScope

  stacking: BuffStackingDefinition
  lifetime: BuffLifetimeDefinition

  application?: BuffApplicationDefinition

  periodic?: PeriodicEffectDefinition[]

  statModifiers?: BuffStatModifierDefinition[]

  controls?: ControlDefinition[]

  capabilities?: CapabilityGrantDefinition[]

  dispellable: boolean

  tags?: readonly string[]
}
```

Definition hoàn toàn immutable.

## 7. Instance Scope

Đây là khái niệm riêng, không được trộn với stacking.

```ts
type BuffInstanceScope =
  | 'per_source'
  | 'per_target'
```

**per_source**

Identity: definitionId + sourceId + targetId

Hai source độc lập.

Ví dụ: Hỏa Ấn của A và Hỏa Ấn của B là hai instance.

**per_target**

Identity: definitionId + targetId

Target chỉ được có một instance.
Instance vẫn giữ `sourceId`.

Nếu source mới reapply: `sourceOwnership: latest` — mặc định source mới trở thành owner.

Suitable cho:

- Taunt
- unique global marker
- một số global debuff

## 8. BuffInstance

```ts
interface BuffInstance {
  instanceId: BuffInstanceId

  definitionId: BuffDefinitionId

  sourceId: CombatEntityId
  targetId: CombatEntityId

  stacks: number

  remaining?: number

  modifiers: BuffModifier[]

  snapshot?: BuffSnapshotData

  createdSequence: number
  lastAppliedSequence: number
}
```

Không có `effects: BuffEffect[]`.
Không có `potencyAmplified`.
Không chứa mutable Definition clone.

## 9. Stacking Model

```ts
interface BuffStackingDefinition {
  maxStacks: number

  onReapplyStacks:
    | 'add'
    | 'replace'
    | 'keep'

  onReapplyDuration:
    | 'refresh'
    | 'keep'
    | 'extend'

  replaceInstanceOnReapply?: boolean
}
```

`stack amount` đến từ Apply request.
Không hard-code `reapply = +1`.

## 10. Apply Request

```ts
interface ApplyBuffRequest {
  definitionId: BuffDefinitionId

  sourceId: CombatEntityId
  targetId: CombatEntityId

  stacks?: number

  baseChance?: number

  durationOverride?: number

  reason:
    | 'skill'
    | 'reaction'
    | 'proc'
    | 'scripted'
}
```

Defaults: `stacks = 1`, `baseChance = 1`

## 11. Application Definition

Application behavior thuộc Buff domain.

```ts
interface BuffApplicationDefinition {
  resistance:
    | 'none'
    | 'ailment'

  clampChance?: boolean
}
```

Positive self-buff thường: `resistance = none`
Ailment: `resistance = ailment`

## 12. Application Resolver

BuffSystem không tự viết random/stat formula inline.

```ts
interface BuffApplicationResolver {
  resolve(
    request: ApplyBuffRequest,
    definition: BuffDefinition,
  ): BuffApplicationResolution
}
```

Resolver được phép dùng Stat System / CombatRng.

Final conceptual chance:

```
baseChance
× sourceApplicationModifier
× targetResistanceModifier
```

rồi clamp `0 → 1`.

## 13. RNG Rule

Không system combat nào gọi `Math.random()`.

Canonical:

```ts
interface CombatRng {
  roll(): number

  rollChance(chance: number): boolean
}
```

Buff application có thể roll chance — nhưng bắt buộc qua injected `CombatRng`.
Proc randomness thuộc Proc System.
Skill randomness thuộc Skill/Combat resolver.

## 14. Failed Application

Application fail:

- NO instance creation
- NO stack
- NO duration refresh
- NO modifier change
- NO reaction

Return:

```ts
{
  applied: false
}
```

## 15. Reapplication Semantics

Ví dụ Hỏa Ấn:

```
current:
3 stacks
1 turn

incoming:
2 stacks

policy:
add + refresh

result:
5 stacks
3 turns
```

Overcap:

```
4 + 3
max 5

result:
5
```

Overflow bị bỏ mặc định.
Không tự convert overflow thành mechanic khác.

## 16. Apply At Stack Cap

Nếu `Hỏa Ấn ×5`, `remaining 1` và successful application `incoming +1`:

```
result:
stacks = 5
duration refreshed
```

Return result phải phản ánh:

```ts
{
  requestedStacks: 1,
  addedStacks: 0,
  overflowStacks: 1,
  durationChanged: true,
}
```

## 17. Lifetime — Three Independent Concepts

Không được trộn:

- duration amount
- clock
- duration scaling

## 18. Lifetime Clock

```ts
type BuffLifetimeClock =
  | 'holder_turns'
  | 'source_turns'
  | 'rounds'
  | 'seconds'
  | 'permanent'
```

## 19. Duration Scaling

```ts
type BuffDurationScaling =
  | 'fixed'
  | 'ailment_scaled'
```

## 20. Lifetime Definition

```ts
interface BuffLifetimeDefinition {
  clock: BuffLifetimeClock

  duration?: number

  scaling: BuffDurationScaling

  removeOnSourceDeath?: boolean
}
```

Default: `removeOnSourceDeath = false`
Do đó caster chết không tự xóa DoT của họ.

## 21. Explicit Lifecycle Entry Points

Universal overloaded `update()` bị xóa.

BuffSystem nhận explicit lifecycle:

```ts
onHolderTurnStart(entityId)

onHolderTurnEnd(entityId)

onSourceTurnStart(entityId)

onSourceTurnEnd(entityId)

onRoundEnd()

onTimePassed(seconds)

onEntityDeath(entityId)

onBattleEnd()
```

Không đoán context qua overload.

## 22. Periodic Effect Definition

V1 (v1.5 — canonical shape locked against the contract megaplan):

```ts
interface PeriodicDamageDefinition {
  id: string

  type: 'damage'

  element:
    | ElementType
    | 'physical'

  damageProfile: DamageProfileId

  coefficient: number

  scaling:
    | 'snapshot'
    | 'dynamic'

  snapshotFields?: readonly string[]   // v1.5 — present iff scaling:'snapshot'

  timing:
    | 'holder_turn_start'
    | 'holder_turn_end'
    | 'source_turn_start'
    | 'source_turn_end'
    | 'interval'

  intervalSeconds?: number

  stackScaling:
    | 'multiply'
    | 'ignore'

  canCrit: boolean
  canMiss: boolean                     // v1.5
  hitCount: number                     // v1.5

  tags?: readonly string[]             // v1.5
}
```

Periodic union có thể mở rộng bằng nhu cầu gameplay thật.
Không tạo catch-all callback.

## 23. Damage Authority

BuffSystem không import hoặc tính:

- armor mitigation
- resistance formula
- elemental power
- crit
- HP mutation
- death

BuffSystem tạo request (v1.5 — canonical `BuffPeriodicDamageRequest`, deferring
to the Combat Contract's `contracts/periodic.ts`):

```ts
interface BuffPeriodicDamageRequest {
  requestId: string                    // emitter-minted correlation id

  instanceId: BuffInstanceId
  periodicId: string

  sourceId: CombatEntityId
  targetId: CombatEntityId

  element?: ElementType | 'physical'
  damageProfile: DamageProfileId

  coefficient: number                  // authored × stackScaling × modifiers

  hitCount: number
  canCrit: boolean
  canMiss: boolean

  stackCount?: number                  // metadata for stack-scaled profiles
  tags?: readonly string[]

  snapshot?: Readonly<Record<string, number>>  // iff scaling:'snapshot'
}
```

**The request carries NO `CombatOperationOrigin`/`originId`** (v1.5 — supersedes
the old `origin:'buff'`/`originId` fields). Operation provenance is owned by
the scheduler's built-in periodic bridge, which mints
`CombatOperationOrigin{kind:'buff_periodic', originId, sourceId, rootActionId,
causationEventId}` when materializing the generated `DealDamageOperation` /
`HealOperation`. The request is pure payload — provenance is bridge business.

DamageSystem xử lý phần còn lại.

## 24. Dynamic Scaling

`scaling = dynamic` means:

```
tick
↓
current source stats
↓
current target stats
↓
DamageSystem
```

Không lưu final damage trong BuffInstance.
Hỏa Ấn sử dụng dynamic.

## 25. Snapshot Scaling

`scaling = snapshot` means:

```
apply
↓
snapshot required offensive context
↓
store minimal snapshot
```

Tick sử dụng snapshot.

Snapshot phải chứa dữ liệu semantic cần thiết.
Không nhất thiết lưu `finalDamage` nếu damage system có thể resolve từ canonical snapshot context.

## 26. Tick Is Not Lifetime

Đây là invariant bắt buộc.

```
periodic trigger
≠
duration decrement
```

Hai operation độc lập.

Manual tick: trigger periodic, duration unchanged.
Natural lifecycle: trigger periodic, then advance lifetime.

## 27. Manual Periodic Trigger

```ts
// v1.4 addendum — supersedes the old `PeriodicResolution[]` return:
// a multi-unit trigger is SEQUENTIAL (v1.3 rule 1 — units 2..N are emitted
// by the periodic_operation_settled continuation AFTER earlier units
// settle), so the call can truthfully return only series-start metadata.
triggerPeriodic(
  selector: BuffInstanceSelector,
  options: {
    periodicId?: string

    reason:
      | 'skill'
      | 'reaction'
      | 'scripted'
  }
): TriggerPeriodicStartResult

interface TriggerPeriodicStartResult {
  started: boolean            // false = selector matched no live unit
  firstRequestId?: string     // the request emitted synchronously
  candidateUnitCount: number  // ordered unit list size at trigger time —
                              // candidates, NOT promised resolutions
}
```

Per-request outcomes are observable via `PeriodicRequestsCommitted` /
`PeriodicOperationSettled` / combat trace — never claimed by this return.

Không advance duration.

## 28. Natural Holder-Turn-End Ordering

Canonical order:

```
1. Holder's action ends

2. holder_turn_end periodic effects resolve

3. use-based modifiers consumed

4. holder-turn modifier lifetimes advance

5. buff lifetime advances

6. buffs reaching zero are removed as expired

7. committed Buff events are published

8. queued Reaction/Proc commands may resolve
```

Ordering phải deterministic.

## 29. Buff Modifier

```ts
interface BuffModifier {
  id: string

  appliedBy?: CombatEntityId

  channel: BuffModifierChannel

  operation:
    | 'add'
    | 'multiply'
    | 'set'

  value: number

  reapply:
    | 'replace'
    | 'stack'
    | 'max'
    | 'min'

  priority: number

  lifetime: BuffModifierLifetime
}
```

## 30. Initial Modifier Channels

V1:

```ts
type BuffModifierChannel =
  | 'potency'
  | 'periodic_damage'
  | 'next_periodic_damage'
  | 'duration'
  | 'application_chance'
```

Không thêm channel path-specific.

## 31. Modifier Resolution Order

Để tránh order-dependent math:

```
Base
↓
ADD modifiers
↓
MULTIPLY modifiers
↓
SET modifier
```

Nếu nhiều `set`: highest priority wins.
Nếu priority tie: stable modifier id ordering.

Không phụ thuộc insertion order.

## 32. Same Modifier Reapplication

Modifier identity dựa vào `id` + `appliedBy` where relevant.

Example: `liet_diem_next_tick` with `reapply = replace`

```
Repeated application:
×1.5
→ apply again
→ still ×1.5
```

không `×2.25`.

## 33. Modifier Lifetime

```ts
type BuffModifierLifetime =
  | {
      type: 'buff_lifetime'
    }

  | {
      type: 'uses'
      remaining: number
    }

  | {
      type: 'holder_turns'
      remaining: number
    }

  | {
      type: 'source_turns'
      remaining: number
    }

  | {
      type: 'rounds'
      remaining: number
    }

  | {
      type: 'battle'
    }

  | {
      type: 'explicit'
    }
```

## 34. Modifier Boundary Semantics

`holder_turns: 2` nghĩa là modifier hợp lệ trong hai holder-turn boundaries kế tiếp mà nó tồn tại trước periodic resolution.

At `holder_turn_end`:

```
periodic uses modifier
↓
remaining modifier turns -1
```

Manual tick: does not decrement holder_turn lifetime.

`uses: 1`: first eligible effect uses modifier → removed immediately after resolution.

## 35. Buff Refresh Does Not Refresh Modifier

Mandatory invariant:

```
refresh buff duration
≠
refresh modifier lifetime
```

Modifier chỉ refresh nếu explicit `addModifier()` được gọi lại.

## 36. Stack APIs

```
addStacks(...)
removeStacks(...)
consumeStacks(...)
setStacks(...)
```

Không external mutation.

## 37. Consume Is First-Class

```ts
consumeStacks(
  selector,
  amount: number | 'all',
  context,
): ConsumeStacksResult
```

Result:

```ts
interface ConsumeStacksResult {
  consumed: number
  remaining: number
  removed: boolean
}
```

If stacks reach zero: removal reason = `consumed`.

## 38. Duration APIs

```
refreshDuration(...)
extendDuration(...)
setRemainingDuration(...)
```

No direct mutation.

## 39. Removal Reasons

```ts
type BuffRemovalReason =
  | 'expired'
  | 'consumed'
  | 'cleansed'
  | 'reaction'
  | 'death'
  | 'source_death'
  | 'battle_end'
  | 'replaced'
  | 'scripted'
```

Mọi removal phải có reason.

## 40. Target Death

```
target death
↓
remove every buff targeting entity
↓
reason = death
```

Không convert thành expire.
Không trigger `onExpire`.

## 41. Source Death

Default: buff remains

Nếu definition `removeOnSourceDeath: true` thì remove `reason = source_death`.

Hỏa Ấn: `removeOnSourceDeath = false`

## 42. Cleanse

```ts
cleanse(
  targetId,
  query,
): CleanseResult
```

Query có thể chọn: kind / tags / element / definition id.

Chỉ buff `dispellable = true` được cleanse.
Removal: `reason = cleansed`.

## 43. Reaction Ownership

Reaction System không sống trong BuffSystem.

Flow:

```
Buff application commits
↓
BuffAppliedEvent queued
↓
ReactionSystem observes committed state
↓
ReactionSystem resolves rule
↓
Reaction creates combat commands
↓
BuffSystem / DamageSystem execute those commands
```

Reaction không mutate BuffInstance trực tiếp.

## 44. No Event Reentrancy

Buff mutation:

```
validate
↓
resolve
↓
mutate
↓
commit
↓
queue events
```

Event listener không được chạy nested mutation ngay giữa transaction.
Consumers tạo `CombatCommand` cho scheduler.

Điều này ngăn `apply → reaction → consume → apply → listener` nested state mutation khó kiểm soát.

## 45. Domain Events

Initial events:

```ts
type BuffEvent =
  | BuffAppliedEvent
  | BuffApplicationFailedEvent

  | BuffStacksChangedEvent
  | BuffDurationChangedEvent

  | BuffModifierAddedEvent
  | BuffModifierRemovedEvent

  | BuffPeriodicResolvedEvent

  | BuffRemovedEvent
```

Events chỉ phát sau state commit.

## 46. Event Payload

Common fields:

```ts
{
  instanceId

  definitionId

  sourceId
  targetId

  combatSequence

  reason?
}
```

Mutation events nên có `before` / `after` khi hữu ích.

## 47. Proc / Reactive Responsibility

Các mechanic sau không còn được BuffSystem execute:

- onHitProc
- reactiveTrigger
- reactiveProc
- reactiveEconomy
- counter
- follow-up
- intercept
- dotRecovery

Buff có thể grant persistent capability.

Example:

```ts
interface CapabilityGrantDefinition {
  id: string
  type: CapabilityType
  payload: unknown
}
```

BuffSystem expose readonly capability descriptors.
System owner xử lý behavior.

## 48. Example Counter Flow

```
Buff grants counter capability
↓
Combat event: damage_taken
↓
ProcSystem queries active capability
↓
ProcSystem rolls CombatRng
↓
ProcSystem checks resource
↓
TurnBattleSystem queues counter action
```

Không có `BuffSystem.rollReactiveTrigger()`.

## 49. Stat Modifier Responsibility

Buff Definition có thể khai báo stat modifier.
BuffSystem expose active descriptors.

```ts
getStatModifiers(targetId):
  readonly ActiveStatModifier[]
```

Stat System resolve final stats.
BuffSystem không recompute stat tree.

## 50. Control State

```ts
BuffDefinition:
controls: [
  { type: 'stun' }
]
```

BuffSystem: `hasControl(targetId, 'stun')`
TurnBattleSystem quyết định stun làm gì.
BuffSystem chỉ xác nhận persistent control state đang tồn tại.

## 51. Query API

Consumer chỉ nhận readonly state.

```ts
getInstance(selector):
  Readonly<BuffInstanceSnapshot> | undefined

getForTarget(targetId):
  readonly BuffInstanceSnapshot[]

getByDefinition(targetId, definitionId):
  readonly BuffInstanceSnapshot[]

getStacks(selector): number

has(selector): boolean

getModifiers(selector):
  readonly BuffModifierSnapshot[]

getCapabilities(targetId):
  readonly ActiveCapability[]
```

Không expose mutable instance.

## 52. Selector

```ts
type BuffInstanceSelector =
  | {
      definitionId: string
      targetId: string
      sourceId: string
    }

  | {
      instanceId: string
    }
```

Operations cần targeting rộng hơn có query API riêng.
Không mutate "all matching" một cách mơ hồ.

## 53. Operation Results

Core APIs không return `void`.

Example:

```ts
interface ApplyBuffResult {
  applied: boolean

  instanceId?: string

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

## 54. Periodic Result

```ts
interface PeriodicResolution {
  instanceId: string

  periodicId: string

  sourceId: string
  targetId: string

  stackCount: number

  reason:
    | 'natural'
    | 'skill'
    | 'reaction'
    | 'scripted'

  damageResult?: DamageResult
}
```

Useful for skill conditions, combat log, reactions, tests.

## 55. Deterministic Ordering

Nếu nhiều statuses trigger ở cùng boundary, canonical sort:

```
1. targetId
2. definitionId
3. sourceId
4. instanceId
5. periodicId
```

Hoặc equivalent explicit stable comparator.
Không dựa vào Map insertion order.

## 56. Definition Validation

Registry startup validates:

- unique definition ID
- maxStacks >= 1
- valid instanceScope
- duration required unless permanent
- non-negative duration
- valid periodic IDs
- periodic IDs unique per definition
- intervalSeconds required for interval periodic
- valid damageProfile
- valid element
- valid modifier channels
- valid control IDs
- valid capability descriptors

Development build: throw on invalid authored data.
Không silent fallback.

## 57. Hỏa Ấn Canonical Definition

Locked gameplay definition:

```ts
const HOA_AN: BuffDefinition = {
  id: 'hoa_an',

  name: 'Hỏa Ấn',

  kind: 'ailment',

  element: 'fire',

  instanceScope: 'per_source',

  stacking: {
    maxStacks: 5,

    onReapplyStacks: 'add',
    onReapplyDuration: 'refresh',
  },

  lifetime: {
    clock: 'holder_turns',

    duration: 3,

    scaling: 'ailment_scaled',

    removeOnSourceDeath: false,
  },

  application: {
    resistance: 'ailment',
  },

  periodic: [
    {
      id: 'hoa_an_dot',

      type: 'damage',

      element: 'fire',

      damageProfile: 'phap_tu_ailment',

      coefficient: TBD_BALANCE,

      scaling: 'dynamic',

      timing: 'holder_turn_end',

      stackScaling: 'multiply',

      canCrit: false,
    },
  ],

  dispellable: true,

  tags: [
    'elemental',
    'fire',
    'ailment',
    'dot',
    'reaction_source',
  ],
}
```

## 58. Hỏa Ấn Application

Example:

```
1 stack / 1 turn remaining

Dẫn Hỏa Quyết applies 1 stack
↓
2 stacks
3 turns
```

At cap:

```
5 stacks / 1 turn

successful apply
↓
5 stacks / 3 turns
```

## 59. Hỏa Ấn Tick

Natural:

```
target turn end
↓
resolve current caster stats
↓
resolve current target mitigation
↓
damage coefficient × 5 stacks
↓
damage
↓
duration -1
```

Hỏa Ấn tick:

- does not crit
- does not roll accuracy
- does not count as skill hit

Damage System receives proper origin tags.

## 60. Xích Viêm — Next Tick Modifier

DoT route:

```ts
buffSystem.addModifier(hoaAnSelector, {
  id: 'xich_viem_next_tick',

  appliedBy: casterId,

  channel: 'next_periodic_damage',

  operation: 'multiply',

  value: 1.5,

  reapply: 'replace',

  priority: 100,

  lifetime: {
    type: 'uses',
    remaining: 1,
  },
})
```

Next manual or natural Hỏa Ấn tick: `×1.5` → modifier consumed.

## 61. Phần Thiên Hỏa Vực

Empowered DoT Ultimate can execute:

```
apply Hỏa Ấn
↓
manual triggerPeriodic()
↓
add potency modifier
↓
extend duration
```

Each operation is independent and ordered by SkillDefinition.
No special Hỏa code in BuffSystem.

## 62. Manual Tick

`triggerPeriodic()` does:

- periodic resolution
- modifier use consumption

does NOT:

- decrement Buff lifetime
- decrement holder-turn modifiers

A `uses` modifier can be consumed because a use occurred.
A `holder_turns` modifier is not decremented.

## 63. Cửu Tiêu Viêm Bạo

Nổ Ultimate:

```
query caster-owned Hỏa Ấn stack count
↓
Skill System computes coefficient
↓
DamageSystem resolves nuke
↓
BuffSystem.consumeStacks(all)
```

Result: removal reason = `consumed`. No `onExpire`.

## 64. Cộng Minh

Old model — `scaleBuffPotency()` / `potencyAmplified = true` — is deleted.

New:

```
ReactionSystem
↓
addModifier(
  ailment,
  {
    id,
    channel: 'potency',
    operation: 'multiply',
    value,
    reapply: 'replace',
    lifetime
  }
)
```

No destructive mutation.

## 65. SkillDefinition Integration

Skill operations targeting BuffSystem:

```ts
type BuffSkillOperation =
  | ApplyBuffOperation
  | AddBuffModifierOperation
  | TriggerBuffPeriodicOperation
  | ConsumeBuffStacksOperation
  | AddBuffStacksOperation
  | RemoveBuffStacksOperation
  | RefreshBuffDurationOperation
  | ExtendBuffDurationOperation
  | CleanseBuffOperation
```

Skill executor uses API only.

## 66. Forbidden Patterns

Forbidden after redesign:

- `Math.random()` inside gameplay systems
- `buff.stacks += ...` outside BuffSystem
- `buff.effects[x] *= ...` anywhere
- `potencyAmplified`
- `scaleBuffPotency()`
- `BuffSystem.rollOnHitEffects()`
- `BuffSystem.rollReactiveTrigger()`
- `BuffSystem.calculateDamagePerTurn()`
- `if (buff.id === 'hoa_an')` inside Buff core
- Pháp Tu-specific / Thể Tu-specific / Kiếm Tu-specific knowledge in BuffSystem

## 67. Required BuffSystem API

Minimum:

```ts
class BuffSystem {
  apply(...): ApplyBuffResult

  addStacks(...): StackChangeResult

  removeStacks(...): StackChangeResult

  consumeStacks(...): ConsumeStacksResult

  setStacks(...): StackChangeResult

  refreshDuration(...): DurationChangeResult

  extendDuration(...): DurationChangeResult

  setRemainingDuration(...): DurationChangeResult

  // v1.4 — addModifier reports the minted runtime entry id;
  // removeModifier removes EVERY entry carrying the authored modifierId
  // (all_matching) and reports the removed generations.
  addModifier(...): ModifierChangeResult & { modifierRuntimeId?: string }

  removeModifier(...): ModifierChangeResult & { removedRuntimeIds: readonly string[] }

  triggerPeriodic(...):
    TriggerPeriodicStartResult   // v1.4 — start metadata, not resolutions

  remove(...):
    RemoveBuffResult

  cleanse(...):
    CleanseResult

  onHolderTurnStart(...): void

  onHolderTurnEnd(...): void

  onSourceTurnStart(...): void

  onSourceTurnEnd(...): void

  onRoundEnd(...): void

  onTimePassed(...): void

  onEntityDeath(...): void

  onBattleEnd(...): void

  getInstance(...)

  getForTarget(...)

  getByDefinition(...)

  getStacks(...)

  getModifiers(...)

  getStatModifiers(...)

  getCapabilities(...)

  hasControl(...)

  has(...)
}
```

## 68. Transaction Rule

Mọi mutation:

```
validate
↓
resolve
↓
mutate internal state
↓
commit
↓
produce result
↓
queue domain events
```

Không event callback chạy giữa transaction.

## 69. Architecture Invariants

| ID | Invariant |
|---|---|
| INV-B01 | Single authority — chỉ BuffSystem mutate BuffInstance |
| INV-B02 | Immutable definition — BuffDefinition không thay đổi runtime |
| INV-B03 | No mutable runtime effects — BuffInstance không giữ mutable `effects[]` |
| INV-B04 | Explicit instance scope — per-source và per-target là authored behavior |
| INV-B05 | Explicit lifecycle — turn/time progression đi qua explicit lifecycle methods |
| INV-B06 | Tick != duration — periodic resolution độc lập lifecycle progression |
| INV-B07 | Modifier independence — modifier có identity, policy và lifetime riêng |
| INV-B08 | Refresh isolation — buff refresh không refresh modifier lifetime |
| INV-B09 | Semantic removal — mọi removal có reason |
| INV-B10 | External damage authority — Damage System sở hữu damage |
| INV-B11 | Deterministic RNG — mọi randomness qua CombatRng |
| INV-B12 | Committed-state events — consumer chỉ thấy committed state |
| INV-B13 | No reentrant mutation — event response được queue thành command mới |
| INV-B14 | No path-specific core — Buff core không biết cultivation path |
| INV-B15 | Readonly external state — consumer không nhận mutable BuffInstance |

## 70. Required Core Tests

**Instance identity**

```
A applies Hỏa Ấn
B applies Hỏa Ấn
same target
→ two instances
```

**Global instance**

```
per_target definition
A apply
B reapply
→ one instance
→ ownership changes according to policy
```

**Stack**

```
4 + 3
max = 5
→ 5
→ overflow 2
```

**Refresh**

```
5 stacks / 1 turn
successful reapply
→ 5 stacks / 3 turns
```

**Failed application**

```
application fail
→ no state change
```

**Dynamic periodic**

```
apply Hỏa Ấn
increase source Fire Power
tick
→ new Fire Power affects tick
```

**Snapshot periodic**

```
apply snapshot DoT
change source stat
tick
→ snapshot semantics preserved
```

**Manual tick**

```
manual tick
→ damage
→ buff duration unchanged
```

**Next tick modifier**

```
×1.5 uses=1
tick 1 = boosted
tick 2 = normal
```

**Holder-turn modifier**

```
modifier holder_turns=2
manual tick
→ remaining still 2
natural turn end
→ effect applies
→ remaining 1
```

**Refresh isolation**

```
buff refresh
→ buff duration resets
temporary modifier
→ lifetime unchanged
```

**Consume**

```
5 stacks
consume all
→ consumed 5
→ instance removed
→ reason consumed
```

**Cleanse** → reason cleansed

**Expire** — duration reaches zero → reason expired

**Death**

```
target dies
→ reason death
→ no onExpire
```

**Source death** — Hỏa caster dies → Hỏa Ấn remains

**Modifier reapply**

```
same replace modifier ×1.5
applied twice
→ ×1.5
not ×2.25
```

**Determinism**

```
same seed
same commands
→ same application rolls
→ same event ordering
→ same status state
```

## 71. Hỏa Ấn Acceptance Test

Buff System Reimagined không được xem là hoàn thành nếu chưa biểu diễn được Hỏa Ấn hoàn toàn bằng generic primitives:

- apply
- application resistance
- per-source ownership
- 5 stacks
- refresh
- 3 holder turns
- dynamic Fire DoT
- manual tick
- next-tick modifier
- potency modifier
- duration extend
- partial stack removal
- consume all
- cleanse
- reaction interaction
- target death
- source death persistence
- battle cleanup

Zero Hỏa-specific branch trong Buff core.

## 72. Secondary Acceptance Test

Sau Hỏa Ấn, ít nhất một non-Hỏa status phải được authored trên cùng primitives.

Recommended: Poison / Bleed / or existing CC/debuff.

Nếu second status yêu cầu redesign ngay lập tức: Buff abstraction chưa đủ generic.

## 73. Deletion List

Current concepts phải bị xóa hoặc viết lại:

- BuffPool gameplay authority
- runtime `Buff.effects`
- `damagePerTurn` as canonical runtime DoT
- `damagePerSecond` as canonical runtime DoT
- `scaleBuffPotency()`
- `potencyAmplified`
- `BuffSystem.calculateDamagePerTurn()`
- `BuffSystem.rollOnHitEffects()`
- `BuffSystem.rollReactiveTrigger()`
- universal overloaded `BuffSystem.update()`
- direct combat `Math.random()`
- generic silent `remove()`
- reactive path execution inside BuffSystem

Không giữ compatibility layer.
Không dual-run engine.
Không fallback sang implementation cũ.

## 74. Definition of Done

Buff System Reimagined hoàn thành khi:

- BuffDefinition hoàn toàn immutable.
- BuffInstance chỉ chứa runtime state.
- Mọi external Buff state readonly.
- BuffSystem là mutation authority duy nhất.
- Stack, duration và modifier hoàn toàn tách biệt.
- Manual tick hoạt động không advance duration.
- Dynamic periodic damage hoạt động.
- Snapshot periodic vẫn biểu diễn được như một authored policy.
- Modifier có identity + reapply policy + deterministic lifetime.
- Consume / cleanse / expire / death khác semantic.
- Application sử dụng deterministic CombatRng.
- BuffSystem không execute Proc/Reaction/Path mechanic.
- Damage resolution thuộc DamageSystem.
- Event chỉ publish sau committed state.
- Không có nested/reentrant mutation.
- Hỏa Ấn hoạt động bằng zero custom BuffSystem branch.
- Ít nhất một status thứ hai chứng minh generic design.

## 75. Final Architecture Rule

- BuffDefinition describes persistent combat state.
- BuffInstance stores only runtime state.
- BuffSystem owns lifecycle and mutation.
- DamageSystem owns damage.
- StatSystem owns stats.
- ReactionSystem owns reactions.
- ProcSystem owns procs.
- SkillSystem owns skill execution.
- TurnBattleSystem owns combat timing.

Nếu một feature mới buộc BuffSystem biết tên skill / tên path / reaction cụ thể / counter cụ thể / resource cụ thể thì responsibility đã bị đặt sai.

Buff System phải trở thành một generic persistent-state engine, không phải nơi mọi mechanic có duration được đưa vào.

---

## Addendum v1.1 (2026-09-17 — locked via implementation-megaplan review rounds 1–2)

Clarifications locked during the implementation-plan review. These refine — never contradict — the v1.0 semantics:

1. **§53/§67 concrete result shapes:** `remove(): RemoveBuffResult {removed: boolean; instanceId?; stacksAtRemoval?}`; `StackChangeResult {stacksBefore; stacksAfter}`; `DurationChangeResult {durationBefore; durationAfter}`; `ModifierChangeResult {applied|removed: boolean}`; `CleanseResult {cleansed: BuffInstanceId[]; skipped: BuffInstanceId[]}` (`skipped` = matched but `dispellable:false`). No core mutation API returns `void`.
2. **§45 `BuffPeriodicResolvedEvent` superseded:** the committed buff-side fact is the contract's `PeriodicRequestsCommitted` event carrying the typed requests. Actual damage/heal outcomes are `deal_damage`/`heal` operation results owned by Damage/Heal authorities — BuffSystem never knows final amounts, so no buff event carries `amount`.
3. **§34 `uses` consumption timing:** a `uses` modifier is consumed iff the generated periodic operation actually **resolved** (settled op status `'resolved'`). Requests computed but skipped downstream (`skipped_*`) do NOT consume — the modifier survives for the next tick. Consumption commits in the post-settlement lifecycle phase, not at request creation.
4. **§25 snapshot semantics:** `snapshot` is recaptured on EVERY successful `apply` — including reapply — after source-ownership resolution. The snapshot always belongs to the instance's current `sourceId` (a `per_target` ownership transfer can never leave a stale previous-caster snapshot).
5. **§26 interval multi-crossing:** `onTimePassed(seconds)` emits `floor(elapsed / intervalSeconds)` requests per interval periodic, computed sequentially so `uses`-modifiers marked by earlier crossings don't fold into later same-batch requests; `elapsed %= intervalSeconds` carries the remainder. Requests skipped because an earlier tick killed the target do not consume `uses` (rule 3).
6. **§28 lifecycle ordering under the request bridge:** periodic-capable boundaries run two phases around a settlement barrier — (A) collect+canonical-sort periodics, compute requests, emit `PeriodicRequestsCommitted`, settle (damage/heal ops and consequences resolve); (B) release/commit `uses` marks per rule 3, decrement matching modifier lifetimes, advance conversion bookkeeping, decrement matching buff lifetimes, expire, emit lifecycle domain events, settle again (queued reaction/proc consequences of lifecycle events resolve in the same root transaction). Phase B revalidates every collected instance against the store — an instance removed during the barrier (e.g. target died) is skipped, never mutated through a stale reference.
7. **§37 zero-stack generalization:** ANY stacks mutation landing at 0 removes the instance — `removeStacks`/`setStacks` → reason `'consumed'`; `consumeStacks` → the passed reason (`'consumed' | 'reaction'`). A buff with zero stacks is nothing.
8. **§47 capability payload ownership:** `payload: unknown` is opaque to BuffSystem. Typed payload schemas + validators are owned and registered by the consuming domains (proc/path modules); the buff registry validates each grant through the registered validator — unknown `type` throws at load.

---

## Addendum v1.2 (2026-09-17 — locked via implementation-megaplan review round 3)

1. **`uses` finalization mechanism (supersedes v1.1 rule 3's mechanism, keeps its rule):** a `uses` modifier is still consumed iff the generated periodic op resolves — but finalization is driven by the contract's `PeriodicOperationSettled` event (`requestId` → `status`), handled inside the same settlement tree that resolved the op. This is what makes the rule hold for manual `triggerPeriodic` (whose generated ops settle after the authority call returned, inside the triggering op's own barrier) — not just lifecycle paths.
2. **§26/§28 sequential periodic units:** the periodic phase computes and settles ONE request at a time — collect+canonical-sort → per unit {revalidate instance still exists → compute request → emit `PeriodicRequestsCommitted` (single request) → settle}. `onTimePassed` expands interval crossings into rounds (round r = each periodic's r-th crossing, comparator-ordered within the round); each crossing is its own unit. A request computed after a prior unit's settlement always sees post-settlement state — a `uses` modifier skipped-released by tick 1 CAN fold into tick 2.
3. **§10–22 event emission order for canonical elemental applications:** `ElementalApplicationCommitted` emits BEFORE the generic `buff_applied`/`buff_stacks_changed`/`buff_duration_changed` events — the committed elemental fact (and its reaction consequences, via depth-first settlement) always precedes generic buff observability consequences. Non-canonical applications emit only the generic events.
4. **§25 snapshot capture ownership:** the snapshot is produced by a profile-owned capture port (`capture(damageProfileId, sourceId) → snapshot`), not by BuffSystem reading arbitrary stat keys. The damage profile owns the snapshot's semantic schema; BuffSystem stores the opaque result per periodic (`instance.snapshots[periodicId]`) and recaptures on every successful apply after source-ownership resolution (v1.1 rule 4 unchanged).
5. **`getCapabilities` canonical order:** returned grants sort by `definitionId → sourceId → instanceId → capabilityId` — identical capability sets produce identical order (and identical downstream RNG consumption) regardless of store insertion history.
6. **Post-barrier liveness (§40–41 completeness):** after a periodic settlement barrier, Phase B removes (a) any instance whose `targetId` died → reason `'death'`; (b) any remaining instance whose `sourceId` died AND `lifetime.removeOnSourceDeath` → reason `'source_death'` — both BEFORE modifier/lifetime/conversion/expiry work.

---

## Addendum v1.3 (2026-09-17 — locked via implementation-megaplan review round 4)

1. **Manual `triggerPeriodic` is sequential too (closes the v1.2 gap):** a multi-unit manual trigger computes and emits only the FIRST unit's request and stores the remaining unit list as a pending continuation. Each `PeriodicOperationSettled` handled by BuffSystem (a) finalizes that request's `uses` marks, then (b) revalidates and computes the NEXT unit against post-settlement state and emits its single-request `PeriodicRequestsCommitted` through the event-scoped sink. Rule: no manual request is ever computed before all earlier units' generated ops have settled — a `uses=1` modifier released by a skipped first unit folds into the second unit. Dead instances are skipped mid-continuation exactly as in the lifecycle path.
2. **Pending-mark identity is the runtime modifier ENTRY, not `modifierId`:** each inserted modifier entry gets a per-instance runtime id (`mod.${instanceId}.${ordinal}` — monotonic; reapply `'replace'`/`'max'`/`'min'` overwrites mint a NEW runtime id, `'stack'` appends always mint one). Pending marks record `{instanceId, modifierRuntimeId}`; finalization looks up the exact entry — a same-`modifierId` entry replaced inside the consequence tree is a different generation and is never consumed by an earlier request's reservation (its mark dies with the replaced entry).
3. **`buff_modifier_removed` is emitted on finalization-removal:** the `periodic_operation_settled` handler receives the event-scoped sink; when a `'resolved'` op consumes a `uses:1` modifier to zero, the removal emits `BuffModifierRemoved` through that sink (the uses decrement itself is internal bookkeeping — only the structural removal is an event).
4. **`reactionEligibility` is application-path metadata, not path capability:** a normal elemental application emits `reactionEligibility:'eligible'`; `'suppressed'` is for recursion-suppressed lanes only (reaction payoff applications, `convertsToId` continuation). Whether a reaction actually runs is the ReactionSystem's gate (`elemental_reaction_enabled` capability + canonical-state registry), never the producer's path flag.
5. **Interval crossing order (amends v1.2 rule 2's "rounds" phrasing):** crossings sort by absolute tick time inside the window — crossing `j` of a periodic sits at offset `j*intervalSeconds − prevElapsed`; ties break on the canonical comparator. Sequential per-unit settlement is unchanged.

---

## Addendum v1.4 (2026-09-17 — locked via implementation-megaplan review round 5)

1. **§27/§67 `triggerPeriodic` return type (supersedes the synchronous `PeriodicResolution[]` API):** the method returns `TriggerPeriodicStartResult {started: boolean; firstRequestId?: string; candidateUnitCount: number}` — it reports that a sequential series STARTED, never the resolutions of continuation work that has not happened yet. Lifecycle entry points keep `readonly PeriodicResolution[]` — they genuinely emit+settle every unit inside the call. Per-request outcomes remain observable via `PeriodicRequestsCommitted`/`PeriodicOperationSettled`/combat trace.
2. **Modifier runtime identity on the public surface:** `BuffModifierAdded`/`BuffModifierRemoved` events carry `{instanceId, modifierId, modifierRuntimeId}` — consumers can distinguish same-`modifierId` generations (v1.3 rule 2's entry identity is now observable, not just internal). `addModifier` returns `{applied, modifierRuntimeId?}`. `removeModifier(sel, modifierId)` removes EVERY runtime entry carrying that authored id (`all_matching` semantics — a same-id stack is one logical modifier to its author); each removed entry emits its own `buff_modifier_removed` with its `modifierRuntimeId`, and the result reports `removedRuntimeIds`.

---

## Addendum v1.5 (2026-09-17 — locked via implementation-megaplan review round 6)

1. **§22 `PeriodicDamageDefinition` completed (supersedes the v1.0 field list):** adds `snapshotFields?: readonly string[]` (required iff `scaling:'snapshot'`), `canMiss: boolean`, `hitCount: number`, `tags?: readonly string[]` — matching the contract megaplan's authored shape exactly.
2. **§23 request shape replaced:** `PeriodicDamageRequest` → `BuffPeriodicDamageRequest` (canonical `contracts/periodic.ts` shape): `requestId`, `instanceId`, `periodicId`, `sourceId`, `targetId`, `element?`, `damageProfile`, `coefficient`, `hitCount`, `canCrit`, `canMiss`, `stackCount?`, `tags?`, `snapshot?`. **The request carries NO `origin`/`originId`** — the old `origin:'buff'` fields are deleted. Operation provenance is the scheduler periodic bridge's job: it mints `CombatOperationOrigin{kind:'buff_periodic', originId, sourceId, rootActionId, causationEventId}` when materializing each generated op. The request is pure payload.
3. **`triggerPeriodic` all-dead branch (clarifies v1.4 rule 1):** when the ordered candidate list is non-empty but every unit is dead/invalid at trigger time, the result is `{started:false, candidateUnitCount: <list size>}` — no `firstRequestId`, no `pendingSeries` entry, zero `PeriodicRequestsCommitted`. `started:false` therefore means "no live unit was triggerable" whether the selector matched nothing or only dead units.
4. **Known limitation (recorded, not a defect):** `removeModifier`'s `all_matching` semantics cannot remove one specific generation (e.g. only caster A's entry of a same-id stack). If gameplay ever needs exact-entry removal, add a separate `RemoveBuffModifierEntryOperation {modifierRuntimeId}` — do NOT overload `remove_buff_modifier` (v1.4's authored-id semantics stays stable).

---

## Addendum v1.6 (2026-09-18 — locked via Skill megaplan review v2.1, contract closure)

1. **§42 `cleanse` gains `limit?: number` (contract v1.6 parity):** signature becomes `cleanse(targetId, query, limit?, ctx)`. `undefined` → every matching dispellable instance removed (unchanged default); `N` → at most the first N cleansed in canonical `sortedForTarget` order. `skipped` still reports EVERY non-dispellable match — the scan continues for reporting after the removal limit is reached; only removal halts. Consumer: the skill program's `cleanse` authored op + the legacy `SkillEffect.remove_buff`-by-polarity adapter (`count` max, default 1 → `limit: count ?? 1`).
