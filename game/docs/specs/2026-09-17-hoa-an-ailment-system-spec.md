# Hỏa Ấn — Ailment System Specification

Status: Ready for Implementation — **PARKED: lưu trữ, chỉ xử lý sau khi toàn bộ mission hiện tại chạy xong** (user ruling 2026-09-17)
Version: 1.1
Domain: Pháp Tu — Hỏa
System Owner: Ailment System
Consumers: Skill System, Damage System, Reaction System, Route System, Combat UI, Combat Log, Progression System

> **Implementation note (2026-09-17):** Hiện tại không có `AilmentSystem` riêng — ailment là debuff/DoT trong `BuffSystem`/`TurnBuffSystem` (R4 canonical authority, xem `docs/systems/buffs.md`). Spec này giả định một ailment authority chuyên trách; khi implement phải quyết định map "Ailment System" lên `TurnBuffSystem` hiện hữu hay tách subsystem mới. `bong` (fire DoT) đã tồn tại — cần ruling: Hỏa Ấn thay thế `bong` hay tồn tại song song.

## 1. Design Intent

`Hỏa Ấn` là ailment nguyên tố Hỏa chuẩn của Pháp Tu.

Nó đại diện cho hỏa lực đang bám trên mục tiêu và là trạng thái cơ sở để Hỏa vận hành theo cả hai route:

| Route | Cách dùng Hỏa Ấn |
|---|---|
| DoT | duy trì, tăng stack, tăng potency, kéo dài, kích hoạt thêm tick |
| Nổ | dùng stack làm điều kiện/scaling rồi consume để tạo burst |

Hỏa Ấn không phải resource riêng của Hỏa.

Không tồn tại:

- Hỏa Thế
- Nhiệt
- Thanh Nộ
- Hỏa Năng

Resource chiến đấu của Pháp Tu vẫn là `Thế`.
Hỏa Ấn là state trên target.

## 2. Architecture Boundary

Ailment System là authority duy nhất của:

- stack
- duration
- application
- application RNG
- tick timing
- tick lifecycle
- modifier lifetime
- consume
- cleanse
- expire
- removal
- source ownership

Skill System được phép:

- apply
- query
- trigger tick
- extend
- add modifier
- consume

nhưng không được tự sửa ailment state.

Forbidden:

```ts
ailment.stacks += 1
ailment.turnsRemaining += 2
ailment.potency *= 1.5
```

Required:

```ts
ailmentSystem.apply(...)
ailmentSystem.extendDuration(...)
ailmentSystem.addModifier(...)
ailmentSystem.consume(...)
```

Reaction System và Progression System cũng tuân theo cùng boundary.

## 3. Three-Layer Model

Hỏa Ấn phải được chia thành ba lớp.

### Definition

Immutable configuration.

`AilmentDefinition`

Chứa:

- max stack
- base duration
- tick timing
- damage channel
- tags
- default behavior

Không chứa battle state.

### Instance

Mutable battle state của một Hỏa Ấn đang tồn tại.

`AilmentInstance`

Chứa:

- source
- target
- stacks
- duration
- modifiers
- lifecycle metadata

### Operation

Mọi thay đổi state đi qua request/result.

Ví dụ:

```ts
ApplyAilmentRequest
ApplyAilmentResult

ConsumeAilmentRequest
ConsumeAilmentResult

TriggerTickRequest
TriggerTickResult
```

Không để consumer nhận mutable instance reference.

## 4. Identity

```ts
id: 'hoa_an'
name: 'Hỏa Ấn'

category: 'ailment'
element: 'fire'
damageKind: 'dot'
```

Tags:

```ts
[
  'ailment',
  'elemental',
  'fire',
  'damage_over_time',
  'stackable',
  'dispellable',
  'reaction_source'
]
```

## 5. Base Definition

```ts
const HOA_AN_DEFINITION = {
  id: 'hoa_an',

  maxStacks: 5,
  baseDuration: 3,

  stackMode: 'additive',
  reapplyDurationMode: 'refresh',

  tickTiming: 'target_turn_end',
  tickOnApplication: false,

  dynamicScaling: true,

  canCrit: false,
  dispellable: true,
  reactionEligible: true,

  tickPriority: 100,
}
```

`baseDamageCoefficient` phải tồn tại trong data nhưng được xem là balance parameter, không phải architecture invariant.

```ts
baseDamageCoefficient: TBD_BALANCE
```

## 6. Instance Identity

Instance không chỉ được xác định bằng:

```
target + ailment
```

mà bằng:

```
target + ailment + source
```

Canonical key:

```ts
AilmentInstanceKey = {
  targetId,
  ailmentId,
  sourceId,
}
```

Ví dụ:

```
Player → Enemy A → Hỏa Ấn
Summon → Enemy A → Hỏa Ấn
```

là hai instance độc lập.

Điều này tránh lỗi:

> caster B apply một stack và đột nhiên toàn bộ 5 stack trước đó được tính theo stat caster B.

## 7. Current Hỏa Skill Scope

Các skill Hỏa của một caster mặc định chỉ tương tác với Hỏa Ấn do chính caster đó sở hữu.

Ví dụ:

```ts
getAilmentStacks({
  targetId,
  ailmentId: 'hoa_an',
  sourceId: casterId,
})
```

- Xích Viêm Xuyên Tâm: scale theo Hỏa Ấn của caster
- Cửu Tiêu Viêm Bạo: consume Hỏa Ấn của caster
- không mặc định consume Hỏa Ấn của summon, đồng đội hoặc source khác.

Reaction System có thể query nhiều source nếu reaction rule yêu cầu, nhưng phải chỉ định scope rõ ràng.

## 8. Instance Model

Conceptual structure:

```ts
interface HoaAnInstance {
  key: {
    targetId: CombatEntityId
    sourceId: CombatEntityId
    ailmentId: 'hoa_an'
  }

  stacks: number
  turnsRemaining: number

  modifiers: ReadonlyMap<ModifierKey, AilmentModifierState>

  createdSequence: number
  lastApplicationSequence: number

  createdBySkillId?: SkillId
  lastAppliedBySkillId?: SkillId
}
```

Không lưu:

- resolved tick damage
- resolved Fire Power
- resolved Intelligence
- resolved Attunement

vì Hỏa Ấn dùng dynamic scaling.

## 9. Stack Rules

Base:

```
maxStacks = 5
```

Apply mới:

```
incoming +1

0 → 1
duration → 3
```

Reapply:

```
current = 3
incoming = 1

result = 4
```

Overcap:

```
current = 4
incoming = 3

accepted = 1
overflow = 2
final = 5
```

Overflow không tự chuyển thành:

- damage
- duration
- potency
- Thế

## 10. Apply At Maximum Stack

Nếu target đã:

```
Hỏa Ấn ×5
```

và application thành công:

- stack vẫn = 5
- nhưng duration vẫn được refresh.

Do đó:

```
5 stacks / 1 turn
↓
successful application
↓
5 stacks / 3 turns
```

Không emit `stack_added` vì thực tế không có stack được thêm.

Application result phải cho biết:

```ts
{
  requestedStacks: 1,
  addedStacks: 0,
  overflowStacks: 1,
  durationRefreshed: true
}
```

## 11. Application Failure

Failed application không được thay đổi bất kỳ state nào.

Không:

- add stack
- refresh duration
- change modifier
- change ownership
- trigger reaction

Result:

```ts
{
  success: false
}
```

## 12. Application Chance

Skill cung cấp base application chance.

Ví dụ: 70%

Route/stat/effect resolution tạo resolved application request.

Conceptual:

```
finalChance =
baseChance
× routeApplicationFactor
× sourceApplicationModifier
× targetApplicationResistance
```

Clamp: 0% → 100%

Ailment System sở hữu RNG roll cuối cùng.

Không được gọi `Math.random()` trực tiếp.
Phải dùng deterministic combat RNG service.

Điều này cần thiết cho:

- tests
- replay
- debugging
- seed reproduction
- automation

## 13. Duration

Base: 3 target turns

Duration không tính theo lượt của caster.
Nó tính theo turn lifecycle của target.

## 14. Refresh

Default reapplication: refresh

Formula:

```
newRemaining =
max(
  currentRemaining,
  resolvedApplicationDuration
)
```

Ví dụ: 1 → 3

Nếu current duration đang là 5:

```
5 + new base 3
→ vẫn 5
```

Không được làm duration giảm.

## 15. Extend

`extend` khác hoàn toàn `refresh`.

```ts
extendDuration({
  turns: 2
})
```

Ví dụ: 3 → 5

Baseline không có maximum duration cap.
Nếu sau này cần `maxDuration`, phải là definition/modifier riêng.

## 16. Fractional Duration

Route hiện có thể tạo: duration +20%

Duration turn-based không được lưu `3.6 turns`.

Resolved duration dùng `ceil`.

Ví dụ:

```
3 × 1.20
= 3.6
→ 4 turns
```

Rounding thuộc generic duration resolver.

## 17. Natural Tick

Natural Hỏa Ấn tick tại: target turn end

Sequence:

```
Target turn reaches ailment tick phase
↓
Hỏa Ấn tick
↓
resolve damage
↓
target death check
↓
nếu target còn sống:
    duration -1
↓
nếu duration <= 0:
    expire
```

## 18. First Tick Semantics

`tickOnApplication = false` nghĩa là apply Hỏa Ấn không lập tức gây DoT damage.

Application:

```
skill damage
→ apply Hỏa Ấn
```

không trở thành:

```
skill damage
→ Hỏa Ấn instant damage
```

Natural tick đầu tiên xảy ra ở `target_turn_end` kế tiếp mà instance đủ điều kiện tham gia tick phase.

Nếu Hỏa Ấn được apply trong chính lượt của target trước ailment tick phase, nó có thể tick ở cuối lượt đó.

Đây được xem là natural turn-end tick, không phải tick-on-apply.

## 19. Tick Does Not Mean One Hit Per Stack

5 Hỏa Ấn không tạo 5 separate DamageEvents.

Mà tạo:

```
1 AilmentTick DamageEvent
```

với stack count được dùng trong damage calculation.

Ví dụ:

```
Hỏa Ấn ×5
→ one tick event
→ damage scales by 5
```

Điều này tránh:

- proc spam
- combat log spam
- 5 lần resistance calculation
- 5 lần on-damage trigger

## 20. Tick Damage Formula

Conceptually:

```
TickDamage =
BaseCoefficient
× CurrentStacks
× SourceElementScaling
× SourceAilmentScaling
× InstancePotencyModifiers
× NextTickModifiers
```

Final damage vẫn phải đi qua Damage System.
Ailment System không tự trừ HP.

## 21. Dynamic Scaling

Hỏa Ấn không snapshot offensive stats khi được apply.

Khi tick:

```
Damage System
→ query current source combat stats
```

Ví dụ caster sau đó nhận `Fire Power +20%` thì Hỏa Ấn đang tồn tại được hưởng bonus đó ở tick tiếp theo.

Dynamic:

- Intelligence
- Attunement
- Fire Power
- Ailment Potency
- generic damage modifiers

theo Damage System contract.

## 22. Source Death

Source chết không xóa Hỏa Ấn.

Combatant record phải tiếp tục tồn tại và query được cho đến battle cleanup.

Hỏa Ấn tiếp tục tick.
Không chuyển ownership.
Không snapshot lại stat khi source chết.

Các modifier yêu cầu source còn sống phải do chính modifier/Damage System xử lý.

## 23. Tick Combat Classification

Hỏa Ấn tick là damage nhưng không phải skill hit.

Damage event phải có classification tương đương:

```ts
origin: 'ailment'
originId: 'hoa_an'

element: 'fire'
damageKind: 'dot'

isSkillCast: false
isBasic: false
isSpecial: false
isUltimate: false

isAilmentTick: true
```

Không nên dựa vào một boolean mơ hồ như `countsAsHit`.
Proc System phải đọc tags/origin.

## 24. Tick Accuracy / Crit / Defense Interaction

Sau khi Hỏa Ấn đã được apply:

- tick không roll accuracy
- tick không evade
- tick không parry
- tick không block
- tick không crit

Baseline: `canCrit: false`

Damage mitigation đi qua Damage System's DoT/elemental pipeline.
Ailment System không tự implement:

- fire resistance
- dot resistance
- generic damage reduction

## 25. Resistance Responsibilities

Ba khái niệm phải tách biệt:

- ailment resistance
- fire resistance
- dot resistance

`ailment resistance` → ảnh hưởng khả năng apply Hỏa Ấn.
`fire resistance` → ảnh hưởng Fire damage.
`dot resistance` → ảnh hưởng damage-over-time.

Không dùng một stat để xử lý cả ba.

## 26. Modifier System

Hỏa Ấn không nên lưu đơn giản `potencyMultiplier = 1.5` vì không biết multiplier đó đến từ đâu và sống bao lâu.

Phải dùng modifier object.

Conceptual:

```ts
interface AilmentModifier {
  key: ModifierKey

  channel:
    | 'potency'
    | 'next_tick'

  operation:
    | 'multiply'
    | 'add'

  value: number

  stacking:
    | 'replace'
    | 'max'
    | 'stack'

  lifetime: ModifierLifetime
}
```

## 27. Modifier Key

Modifier key phải phân biệt effect và source khi cần.

Ví dụ:

```
xich_viem_xuyen_tam:player_01
phan_thien_hoa_vuc:player_01
reaction_cong_minh:player_01
```

Do đó effect từ caster A không vô tình replace effect cùng tên của caster B.

## 28. Same Modifier Reapplication

Baseline Hỏa mechanics dùng `stacking = replace`.

Ví dụ Phần Thiên Hỏa Vực +50% potency:

```
apply lần đầu:
1.0 × 1.5
apply lại cùng modifier:
vẫn ×1.5
```

không:

```
×1.5 ×1.5
= ×2.25
```

Đây là invariant quan trọng.

## 29. Distinct Modifiers

Hai modifier khác key có thể coexist.

Ví dụ:

```
Phần Thiên Hỏa Vực ×1.5
Cộng Minh ×1.2
```

Final:

```
1.5 × 1.2
= 1.8
```

nếu cả hai đều dùng multiplicative channel.

Stacking policy phải explicit, không dựa vào insertion order.

## 30. Modifier Lifetime

Modifier lifetime độc lập với lifetime của Hỏa Ấn.

Supported conceptual forms:

- `untilInstanceRemoved`
- `uses: N`
- `targetTurns: N`
- `battle`
- `explicitRemoval`

Điều này giải quyết một lỗi rất quan trọng:

> Nếu Ultimate cho Hỏa Ấn potency +50% và modifier chỉ sống "đến khi Hỏa Ấn mất" thì người chơi có thể refresh Hỏa Ấn liên tục và giữ +50% gần như vĩnh viễn. Không được làm như vậy.

## 31. Phần Thiên Hỏa Vực Modifier

Recommended current behavior:

- Potency +50%
- duration: 2 target turns

Nó không phụ thuộc duration hiện tại của Hỏa Ấn.

Ví dụ:

```
Hỏa Ấn còn 5 turns
Phần Thiên Hỏa Vực applied
↓
potency ×1.5 trong 2 target turns
↓
sau đó potency trở lại bình thường
```

Nếu Hỏa Ấn được refresh trong khoảng đó:

- Hỏa Ấn duration có thể tăng/refresh
- nhưng potency modifier lifetime không được refresh trừ khi Ultimate được cast lại.

## 32. Next Tick Modifier

Xích Viêm Xuyên Tâm — DoT sử dụng: next Hỏa Ấn tick +50%

Representation:

```ts
channel: 'next_tick'
value: 1.5
lifetime: {
  uses: 1
}
```

Tick kế tiếp:

```
damage ×1.5
↓
modifier consumed
```

## 33. Manual Tick

Generic API:

```ts
triggerTick({
  instanceKey,
  reason: 'skill'
})
```

Manual tick:

- gây Hỏa Ấn damage ngay

nhưng không:

- decrement duration
- simulate target turn end

## 34. Manual Tick and Next-Tick Modifier

Manual tick vẫn là một Hỏa Ấn tick hợp lệ.

Nếu `nextTick ×1.5` đang tồn tại và skill gọi manual tick:

```
manual tick hưởng ×1.5
→ modifier consumed
```

Natural và manual tick không có hai hệ modifier riêng.

## 35. Target-Turn Modifier Lifetime and Manual Tick

Modifier dạng `targetTurns: 2` không bị manual tick làm giảm lifetime.

Ví dụ Phần Thiên Hỏa Vực:

```
potency ×1.5
for 2 target turns
```

Manual tick xảy ra giữa hai target turn:

- vẫn hưởng ×1.5
- nhưng không mất một turn duration của modifier.

## 36. Recommended Empowered DoT Sequence

Phần Thiên Hỏa Vực nên gọi Ailment System theo thứ tự:

1. apply Hỏa Ấn
2. trigger bonus tick
3. add potency modifier ×1.5 / 2 target turns
4. extend Hỏa Ấn duration +2

Điều này có nghĩa bonus tick tức thì không hưởng potency +50%.
Hai lượt sau mới là giai đoạn Hỏa Vực được cường hóa.

## 37. Consume

API:

```ts
consume({
  instanceKey,
  stacks: number | 'all',
  reason,
})
```

Partial:

```
5
consume 2
→ 3
```

Full:

```
consume all
→ remove instance
```

## 38. Consume Is Not Expire

Consume phải emit lifecycle reason riêng: `consumed`, không phải `expired`.

Passive nghe `onExpire` không được chạy khi Ultimate consume Hỏa Ấn.

## 39. Partial Consume

Partial consume:

- không refresh duration
- không reset modifier
- không reset ownership

Ví dụ:

```
5 stacks
4 turns
potency modifier còn 1 turn
↓
consume 2
↓
3 stacks
4 turns
potency modifier còn 1 turn
```

## 40. Expire

Expire xảy ra khi `turnsRemaining <= 0`.

Expire:

- remove instance
- emit `expired`

Không mặc định:

- deal damage
- explode
- spread
- leave stack

## 41. Reapply After Expire

Nếu progression như `Hỏa Chủng` muốn "Hỏa Ấn hết hạn có chance để lại 1 stack" thì sequence là:

```
old instance expires
↓
old instance destroyed
↓
progression effect requests NEW application
↓
new instance created
```

Instance mới không được inherit:

- old potency modifiers
- old next-tick modifiers
- old duration extensions

trừ khi effect explicit yêu cầu.

## 42. Cleanse

Hỏa Ấn: `dispellable = true`

Full cleanse:

- remove instance
- reason = `cleansed`

Partial cleanse: remove N stacks.

Cleanse không emit expire.
Cleanse không emit consume.

## 43. Target Death

Nếu Hỏa Ấn tick giết target:

```
tick resolves
↓
target death resolves
↓
ailment cleanup
```

Không tiếp tục:

- duration decrement
- expire proc
- additional tick

Death cleanup: reason = `death_cleanup`, không phải natural expire.

## 44. Battle End

Tất cả Hỏa Ấn là battle-scoped.

Battle end:

- remove all instances
- remove all modifiers

Không carry sang:

- auto-repeat
- scene transition
- next battle
- save outside battle

## 45. Reaction Contract

Hỏa Ấn:

```ts
reactionEligible = true
reactionTags = ['fire']
```

Reaction System được:

- query
- consume
- modify
- replace

nhưng qua public Ailment API.

Forbidden:

```ts
instance.stacks = 0
```

## 46. Reaction Transaction Timing

Reaction không được chen vào giữa quá trình apply.

Application phải hoàn tất atomically:

```
resolve chance
↓
mutate stacks
↓
refresh duration
↓
commit state
↓
publish application result
↓
Reaction System may respond
```

Reaction listener luôn nhìn thấy một state hoàn chỉnh.

Không bao giờ:

- stack đã tăng nhưng duration chưa refresh
- hoặc state nửa chừng tương tự.

## 47. Khắc Chế

Nếu reaction rule yêu cầu consume participating ailments:

```
reaction detects Hỏa Ấn
↓
reaction resolves payoff
↓
consume chosen Hỏa Ấn instance
```

Instance scope phải explicit. Ví dụ:

- same source
- specific source
- all eligible sources

Reaction System sở hữu lựa chọn này.
Hỏa Ấn không tự quyết.

## 48. Cộng Minh

Nếu reaction không consume mà tăng potency thì dùng `addModifier(...)` với modifier key, stacking policy, lifetime đầy đủ.

Không chỉ `potency *= 1.2`.

Điều này ngăn lỗi potency compounding khi reaction được refresh nhiều lần.

## 49. Route Interaction

Không tồn tại `hoa_an_dot` / `hoa_an_no`.
Chỉ tồn tại `hoa_an`.

Route thay đổi resolved effect request.

Ví dụ DoT:

```
application ×1.25
+1 stack
potency +30%
duration +20%
```

Nổ:

```
application ×0.50
```

Ailment System không cần biết `route = dot` hay `route = no`.
Nó chỉ nhận resolved request.

## 50. Core Separation of Responsibilities

Recommended flow:

```
Skill Definition
↓
Combat Effect Resolver
↓
Route / Stat modifiers
↓
Resolved Ailment Request
↓
Ailment System
↓
Target resistance + deterministic RNG
↓
Ailment mutation
```

Không để mỗi skill tự viết công thức application riêng.

## 51. Thế

Core Hỏa Ấn không tự tạo Thế.

Baseline:

```
apply       → 0 Thế
add stack   → 0 Thế
natural tick→ 0 Thế
manual tick → 0 Thế
expire      → 0 Thế
consume     → 0 Thế
cleanse     → 0 Thế
```

Nếu progression muốn "Hỏa Ấn tick → +Thế" thì progression modifier sở hữu mechanic đó.

## 52. Atomic Mutation

Mọi public mutation operation phải atomic.

Ví dụ `apply()`:

```
validate
resolve
mutate
commit
emit
```

Subscriber không được chạy giữa mutate steps.

Điều này đặc biệt quan trọng với:

- reaction
- passive
- UI
- combat log
- analytics

## 53. Event Reentrancy

Event listener không nên mutate cùng instance trực tiếp trong cùng mutation frame.

Nếu listener tạo effect mới:

- queue command
- hoặc đưa qua combat effect scheduler.

Ví dụ:

```
Hỏa Ấn expires
↓
Hỏa Chủng listener requests apply
↓
expire transaction finishes
↓
new apply transaction begins
```

Tránh `expire → apply → expire → apply` nested mutation không kiểm soát.

## 54. Event Contract

Recommended events:

```
ailment_application_attempted
ailment_application_failed
ailment_applied
ailment_stacks_changed
ailment_duration_changed

ailment_tick_started
ailment_tick_resolved

ailment_modifier_added
ailment_modifier_removed

ailment_consumed
ailment_cleansed
ailment_expired
ailment_removed
```

Không nhất thiết public mọi internal micro-event.

## 55. Event Payload

Các event chính cần có:

```ts
{
  ailmentId,
  instanceKey,

  sourceId,
  targetId,

  reason,

  before?,
  after?,

  originatingSkillId?,
  originatingEffectId?,

  combatSequence
}
```

Mọi event cần deterministic `combatSequence`.

## 56. Natural Tick Event Ordering

```
ailment_tick_started
↓
Damage System resolution
↓
ailment_tick_resolved
↓
target death resolution
↓
if alive:
    modifier lifetime update
    duration decrement
↓
optional expire
```

## 57. Application Event Ordering

Successful new application:

```
application_attempted
↓
RNG success
↓
state commit
↓
ailment_applied
```

Successful reapplication:

```
application_attempted
↓
RNG success
↓
stack/duration commit
↓
ailment_stacks_changed if needed
↓
ailment_duration_changed if needed
↓
application result published
```

Reaction occurs only after commit.

## 58. Deterministic Ordering

Nếu nhiều ailments tick ở cùng target-turn boundary, thứ tự không được phụ thuộc vào:

- JavaScript Map insertion accident
- object key order
- render order

Ailment processing phải có deterministic ordering.

Recommended:

```
tickPriority
then createdSequence
```

Hỏa Ấn: `tickPriority = 100`

## 59. Damage Resolution Ownership

Ailment System tạo damage request.

Ví dụ:

```ts
damageSystem.resolve({
  sourceId,
  targetId,

  origin: 'ailment',
  originId: 'hoa_an',

  element: 'fire',
  damageKind: 'dot',

  coefficient: resolvedCoefficient,

  canCrit: false,
})
```

Damage System sở hữu:

- damage reduction
- resistance
- HP mutation
- death
- damage event

## 60. Public Query API

Minimum:

```
hasAilment()

getAilment()

getAilmentStacks()

getAilmentDuration()

getAilmentModifiers()

findAilments()
```

Queries trả readonly snapshot.
Không trả mutable object reference.

## 61. Public Mutation API

Minimum:

```
applyAilment()

addStacks()
removeStacks()

refreshDuration()
extendDuration()

addModifier()
removeModifier()

triggerTick()

consumeAilment()
cleanseAilment()
expireAilment()
```

Mọi method cần explicit source / target / ailment / scope / reason khi applicable.

## 62. Skill Integration

**Dẫn Hỏa Quyết**

```
damage
↓
apply Hỏa Ấn
```

Không tự xử lý stack / duration / RNG.

**Xích Viêm Xuyên Tâm — shared**

Query same-source Hỏa Ấn stacks để tính direct damage scaling.
Không consume.

**Xích Viêm Xuyên Tâm — DoT**

```
add next-tick modifier
×1.5
uses = 1
```

**Xích Viêm Xuyên Tâm — Nổ**

Chỉ đọc `stackCount` và scale direct damage.
Không modify Hỏa Ấn.

**Phần Thiên Hỏa Vực**

```
apply
→ manual tick
→ potency modifier
→ duration extension
```

**Cửu Tiêu Viêm Bạo**

```
query same-source stacks
↓
calculate burst
↓
consume same-source Hỏa Ấn
```

Skill không tự `stacks = 0`.

## 63. UI Read Model

Combat UI không cần access internal modifier structure đầy đủ.

Expose read model:

```ts
{
  id: 'hoa_an',
  name: 'Hỏa Ấn',

  stacks,
  maxStacks,

  turnsRemaining,

  effectivePotencyMultiplier,

  sourceId,
}
```

## 64. UI Presentation

Default:

```
Hỏa Ấn ×4
3 lượt
```

Tooltip:

> Hỏa lực bám trên mục tiêu. Gây sát thương Hỏa vào cuối lượt của mục tiêu dựa trên số tầng Hỏa Ấn. Tối đa 5 tầng.

Nếu potency modifier active:

> Sát thương Hỏa Ấn +50%

Không hiển thị internal key như `phan_thien_hoa_vuc:player_001`.

## 65. Multiple Sources UI

Nếu tương lai nhiều source cùng tạo Hỏa Ấn, internal instances vẫn riêng biệt.

UI có thể aggregate presentation hoặc hiển thị theo source nếu gameplay cần.

UI aggregation không được thay đổi combat state model.

## 66. Combat Log

Examples:

```
Target nhận 1 tầng Hỏa Ấn. Tổng: 4.

Hỏa Ấn gây 128 sát thương Hỏa cho Target.

Hỏa Ấn của Target được kéo dài thêm 2 lượt.

5 tầng Hỏa Ấn bị thiêu rụi.

Hỏa Ấn trên Target đã tan biến.
```

Combat log không in raw engine event names.

## 67. Persistence

Hỏa Ấn là battle-scoped.
Không persist trong normal save.

Nếu tương lai có mid-battle save, serialize:

- instance key
- stacks
- turnsRemaining
- modifier states
- modifier lifetimes
- created sequence

Không serialize resolved tick damage.

## 68. Core Invariants

| Invariant | Rule |
|---|---|
| Stack | `1 <= stacks <= maxStacks` cho active instance |
| Zero stack | phải remove instance |
| Duration | active instance phải có `turnsRemaining > 0` |
| Ownership | source-scoped |
| Mutation | chỉ Ailment System |
| Tick damage | qua Damage System |
| RNG | deterministic |
| Crit | false mặc định |
| Route | không tạo ailment type mới |
| Modifier | có key + lifetime |
| Same-key reapply | không compound ngoài policy |
| Refresh | không refresh modifier lifetime |
| Manual tick | không giảm ailment duration |
| Target death | cleanup, không expire |
| Source death | không remove ailment |
| Battle end | clear toàn bộ |

## 69. Important Edge Cases

| Case | Expected |
|---|---|
| Apply vào target chưa có | tạo instance, 1 stack |
| Apply +2 | tạo 2 stacks |
| Apply 1 vào ×4 | thành ×5 |
| Apply 2 vào ×4 | ×5, overflow 1 |
| Apply khi đã ×5 | ×5, refresh duration |
| Failed application | không đổi state |
| Refresh 1 turn | về ít nhất resolved base duration |
| Refresh khi đang 5 turns | vẫn 5 |
| Extend +2 | cộng chính xác 2 |
| Manual tick | damage, duration không giảm |
| Natural tick | damage rồi duration giảm |
| Tick giết target | death cleanup, không expire |
| Partial consume | stack giảm, state còn lại giữ nguyên |
| Full consume | remove reason=consumed |
| Cleanse | remove reason=cleansed |
| Natural timeout | reason=expired |
| Source chết | ailment vẫn tồn tại |
| Battle kết thúc | clear |
| Same modifier reapplied | replace/refresh theo policy |
| Refresh Hỏa Ấn | không refresh modifier lifetime |
| Next-tick modifier + manual tick | manual tick consume modifier |
| Modifier 2 target turns + manual tick | manual tick không giảm modifier lifetime |

## 70. Required Automated Tests

**Application**

- new apply
- failed apply
- stack accumulation
- overcap
- apply-at-cap refresh
- deterministic RNG

**Duration**

- base duration
- refresh
- refresh does not shorten
- extend
- fractional-duration resolution
- natural decrement
- expire

**Tick**

- natural tick
- manual tick
- manual tick no duration loss
- stack scaling
- dynamic source scaling
- non-crit
- correct damage tags

**Modifier**

- add potency modifier
- same-key replace
- different-key coexist
- modifier lifetime targetTurns
- modifier lifetime uses
- ailment refresh does not refresh modifier
- modifier cleanup with instance

**Next Tick**

- natural tick consumes
- manual tick consumes
- same-key reapply does not compound

**Ownership**

- same target + same ailment + different source → separate instances
- caster A skill query → does not read caster B stacks unless requested
- caster A consume → does not remove caster B Hỏa Ấn

**Removal**

- partial consume
- full consume
- cleanse
- expire
- target death cleanup
- battle cleanup

**Event Ordering**

- apply transaction
- natural tick
- tick-caused death
- consume
- cleanse
- expire

**Reaction**

- reaction observes committed ailment state
- Khắc Chế uses consume API
- Cộng Minh uses modifier API
- no direct mutation

## 71. Forbidden Implementations

Không tạo Hỏa-specific subsystems nếu generic primitives xử lý được.

Avoid:

- `HoaAnManager`
- `FireDotSystem`
- `FireStackService`
- `HoaAnDamageService`
- `HoaAnDurationController`

nếu chúng duplicate trách nhiệm của:

- Ailment System
- Damage System
- Combat Effect Resolver

Hỏa Ấn lý tưởng phải chủ yếu là:

```
AilmentDefinition
+
generic Ailment operations
+
data parameters
```

## 72. Locked v1 Decisions

| Property | Decision |
|---|---|
| Name | Hỏa Ấn |
| Type | Ailment |
| Element | Fire |
| Damage type | DoT |
| Max stacks | 5 |
| Base duration | 3 target turns |
| Natural tick | target turn end |
| Tick on application | No |
| Scaling | Dynamic |
| Crit | No |
| Hit/evade roll after application | No |
| Source model | source-scoped instance |
| Reapply stack | additive |
| Reapply duration | refresh |
| Overcap | discarded |
| Manual tick | supported |
| Manual tick duration loss | No |
| Potency modifiers | keyed |
| Modifier lifetime | independent |
| Same-key default | replace |
| Next-tick modifier | supported |
| Dispellable | Yes |
| Reaction eligible | Yes |
| Core Thế generation | None |
| Route-specific ailment | No |
| Source death removal | No |
| Target death removal | Yes |
| Battle persistence | No |
| Direct external mutation | Forbidden |

## 73. Balance Parameters

Các giá trị sau được phép thay đổi mà không đổi architecture:

- maxStacks
- baseDuration
- baseDamageCoefficient
- application chance
- route application factor
- route stack bonus
- route potency bonus
- route duration bonus
- skill next-tick multiplier
- skill potency multiplier
- modifier lifetime
- consume scaling
- reaction scaling

Tất cả phải nằm trong data/config.

## 74. Hỏa-Specific Balance Draft

Current intended interaction:

**Dẫn Hỏa Quyết**

- base application: 1 Hỏa Ấn
- DoT route: application mạnh hơn, +1 stack through route profile
- Nổ route: application yếu hơn

**Xích Viêm Xuyên Tâm DoT**

- next tick ×1.5
- uses = 1

**Phần Thiên Hỏa Vực**

- manual tick ×1
- extend +2 turns
- potency ×1.5
- lifetime = 2 target turns

Các con số này là balance knobs, không architecture constants.

## 75. Definition of Done

Hỏa Ấn chỉ được coi là hoàn thiện khi Ailment System có thể xử lý toàn bộ lifecycle:

- apply
- fail
- stack
- overcap
- refresh
- extend
- natural tick
- manual tick
- modifier
- modifier expiration
- partial consume
- full consume
- cleanse
- reaction interaction
- expire
- death cleanup
- battle cleanup

mà không cần skill trực tiếp mutate ailment state.

- Damage luôn đi qua Damage System.
- Application RNG luôn deterministic.
- Modifier có identity và lifetime riêng.
- Refresh Hỏa Ấn không thể vô tình kéo dài temporary potency modifier.
- Các source khác nhau không cướp ownership của nhau.
- Reaction luôn chạy trên committed state.
- Toàn bộ invariants quan trọng có automated tests.

## 76. Final Architecture Principle

- Skill quyết định: "tôi muốn làm gì với Hỏa Ấn"
- Ailment System quyết định: "Hỏa Ấn thay đổi như thế nào"
- Damage System quyết định: "tick này thực sự gây bao nhiêu damage"
- Reaction System quyết định: "sự kết hợp ailment tạo phản ứng gì"
- Route System quyết định: "cùng skill đó được biến đổi ra sao"

Không system nào làm thay công việc của system khác.
