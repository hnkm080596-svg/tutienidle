# Reaction System Reimagined — Final Specification

Status: FINAL — **PARKED: lưu trữ, chỉ xử lý sau khi toàn bộ mission hiện tại chạy xong** (user ruling 2026-09-17)
Version: 1.0
Scope: Ngũ Hành Reaction System
Owner gameplay: Pháp Tu Ẩn — Ngộ Đạo
Architecture dependency: Buff System Reimagined v1.0 ([2026-09-17-buff-system-reimagined-spec.md](./2026-09-17-buff-system-reimagined-spec.md))
Compatibility requirement: None
Migration requirement: None

> **Implementation notes (2026-09-17):**
> - Spec này **thay thế** `ELEMENT_REACTIONS`/`TurnReactionManager` hiện tại (pair-table, áp cho mọi elemental application) — xem `docs/systems/elements-reactions.md`. Model mới: same-source board, consume-all, capability-gated.
> - **Gameplay change lớn cần ruling:** reaction hiện kích cho MỌI Pháp Tu elemental application; spec mới gate sau capability `elemental_reaction_enabled` (chỉ Ngộ Đạo) — visible Pháp Tu mất toàn bộ reaction hiện có (Bốc Hơi, Độc Viêm, …). Xác nhận đây là intent trước khi implement.
> - **Ailment rename/rework map (không phải rename thuần):** Hàn Tức ≠ `te_cong` (Tê Cóng hiện là DoT/CC), Liệt Thương ≠ `chay_mau` (Chảy Máu hiện là DoT), Trấn Ấn ≠ `thach_hoa` (Thạch Hóa hiện là CC cứng). Và `Độc Căn` hiện là TÊN mechanic threshold bên trong `trung_doc` (poison root) — name collision cần resolve.
> - Dependencies: yêu cầu buff spec v1.0 landed (per_source instance, `reactionEligible` trên application commit, removal reason `reaction`, modifier `reapply: max`, `buff_lifetime` modifier lifetime); Cấm Công cần action-tagging trên skill (skill spec §7 `tags` cover) + ActionRestriction enforcement ở turn engine; gauge ops cần `ActionGauge` push API (đã tồn tại `core/battle/turn/ActionGauge.ts`).

## 1. Purpose

Reaction System sở hữu: phát hiện, lựa chọn và mô tả một interaction Ngũ Hành từ elemental state đã được Buff System commit.

Reaction System KHÔNG sở hữu:

- elemental ailment state
- stack mutation
- duration mutation
- damage resolution
- gauge mutation
- action restriction state
- skill execution
- multicast scheduling
- stat calculation
- RNG generation
- path progression

Reaction System quyết định:

- Có reaction không?
- Reaction nào?
- Consume state nào?
- Reaction tạo ra các operation gì?

Các system owner khác thực thi operation tương ứng.

## 2. Reaction Is Exclusive To Ngộ Đạo

Visible Pháp Tu:

- fixed element
- route DoT / Nổ
- Thế
- NO automatic Ngũ Hành reaction

Hidden Pháp Tu — Ngộ Đạo:

- NO fixed element
- NO DoT/Nổ route
- NO Thế
- random elemental cast
- multicast
- Ngũ Hành Reaction enabled

Reaction không được hard-code `if (path === 'phap_tu_an')`.

Ngộ Đạo grant generic capability: `elemental_reaction_enabled`.
Reaction System chỉ chạy khi source có capability này.

## 3. Core Gameplay Identity

Ngộ Đạo không phải manual combo path.

Người chơi không điều khiển:

- Hỏa bây giờ
- Mộc tiếp theo
- Khắc hay Sinh

Người chơi xây random elemental machine thông qua:

- elemental weighting
- multicast
- application stacks
- reaction weighting
- Sinh amplification
- Khắc amplification
- reaction-specific bonuses
- retention/echo mechanics

Core fantasy:

```
random cast
→ elemental board
→ Sinh / Khắc
→ board collapse / conversion
→ rebuild
```

Ngộ Đạo là controlled chaos, không phải manual combo.

## 4. Canonical Elemental States

Reaction System làm việc với 5 elemental ailments:

| Element | Ailment |
|---|---|
| Hỏa | Hỏa Ấn |
| Thủy | Hàn Tức |
| Mộc | Độc Căn |
| Kim | Liệt Thương |
| Thổ | Trấn Ấn |

Baseline: `maxStacks = 5` cho cả 5.

Stack semantics khác nhau:

- Hỏa = nhiệt / pressure
- Thủy = slow / tempo pressure
- Mộc = poison growth / sustain
- Kim = wound / penetration
- Thổ = suppression / gauge pressure

## 5. Trấn Ấn Rule

Trấn Ấn KHÔNG tự động biến thành Cấm Công ở 5 stack.

```
Trấn Ấn ×5
≠
auto Attack Seal
```

Trấn Ấn là elemental setup state.
Cấm Công là một control status riêng, chỉ được apply bởi:

- explicit skill payoff
- reaction payoff
- progression mechanic

Điều này cho phép Reaction System đọc đầy đủ Trấn Ấn 1–5.

## 6. Reaction Board

Reaction được evaluate theo `sourceId` + `targetId`.

Canonical board:

```ts
interface ReactionBoard {
  sourceId: CombatEntityId
  targetId: CombatEntityId

  fireStacks: number
  waterStacks: number
  woodStacks: number
  metalStacks: number
  earthStacks: number
}
```

Board chỉ gồm ailments của cùng source.

## 7. Source Ownership

Default: Reaction chỉ dùng elemental ailments của source đang gây application.

Ví dụ:

```
Caster A: Hỏa ×3
Caster B: Kim ×5

A apply Hỏa tiếp:
A's Hỏa không được Khắc B's Kim
```

Reaction identity: same source, same target.

## 8. Reaction Trigger

Reaction evaluation chỉ xảy ra sau một elemental ailment application hợp lệ.

Canonical flow:

```
elemental application
↓
Buff System resolves application
↓
Buff state commits
↓
addedStacks > 0 ?
↓
source has reaction capability?
↓
ReactionSystem evaluates
```

## 9. Pure Refresh Does Not Trigger Reaction

Nếu application thành công nhưng `addedStacks = 0`:

```
Hỏa5
+ incoming Hỏa1
→ still Hỏa5
→ only duration refresh
```

thì NO reaction evaluation.

Reaction cần một thay đổi elemental stack thực sự.

## 10. New Instance Trigger

Nếu instance mới được tạo `0 → N stacks` thì reaction eligible.

## 11. One Application = One Reaction Maximum

Một elemental application: max ONE primary reaction.

Dù operation add `+3 stacks` vẫn chỉ là ONE application, không phải 3 trigger.

## 12. Reaction Is Cast-Order Independent

Ngũ Hành relation được quyết định bởi element law.
Không phụ thuộc element nào xuất hiện trước.

Ví dụ `Mộc → Hỏa` có thể được trigger khi:

- Mộc tồn tại, Hỏa vừa apply
- hoặc Hỏa tồn tại, Mộc vừa apply

miễn sau application cả hai tồn tại.

Tương tự `Thủy khắc Hỏa` không phụ thuộc Thủy hay Hỏa là element mới.

## 13. Sinh Graph

Canonical Sinh:

```
Mộc → Hỏa
Hỏa → Thổ
Thổ → Kim
Kim → Thủy
Thủy → Mộc
```

Semantic: Parent → Child

## 14. Khắc Graph

Canonical Khắc:

```
Mộc → Thổ
Thổ → Thủy
Thủy → Hỏa
Hỏa → Kim
Kim → Mộc
```

Semantic: Attacker → Defender

## 15. Candidate Generation

Sau application, ReactionSystem chỉ build candidates có chứa element vừa được apply.

Ví dụ Hỏa vừa được apply. Possible relations:

```
Mộc → Hỏa
Hỏa → Thổ
Thủy → Hỏa
Hỏa → Kim
```

Do đó tối đa 4 candidates.

Không scan và resolve arbitrary pair không liên quan trigger element.

## 16. Sinh Consumption

Sinh: Parent → Child

Rule:

```
snapshot ALL Parent stacks
↓
consume ALL Parent
↓
Child survives
↓
resolve Sinh payoff
```

Child không bị consume.

## 17. Khắc Consumption

Khắc: Attacker → Defender

Rule:

```
snapshot ALL Attacker stacks
snapshot ALL Defender stacks
↓
consume ALL Attacker
consume ALL Defender
↓
resolve Khắc payoff
```

Baseline không partial-consume.

## 18. No Automatic Residual

Baseline Reaction không tự:

- return 1 stack
- retain 20%
- refund consumed stack

Những mechanic đó phải đến từ explicit progression.

## 19. Reaction Snapshot

Reaction context phải snapshot trước mutation.

```ts
interface ReactionContext {
  reactionId: ReactionId

  relation: 'sinh' | 'khac'

  sourceId: CombatEntityId
  targetId: CombatEntityId

  triggerElement: ElementType

  parentElement?: ElementType
  parentStacks?: number

  childElement?: ElementType
  childStacks?: number

  attackerElement?: ElementType
  attackerStacks?: number

  defenderElement?: ElementType
  defenderStacks?: number

  totalStacks: number

  combatSequence: number
}
```

Payoff dùng snapshot này.
Không consume rồi query lại.

## 20. Candidate Strength — Sinh

Gọi `P = ParentStacks`.

Sinh base strength: `P²`

Range: 1 → 25

```
P1 → 1
P2 → 4
P3 → 9
P4 → 16
P5 → 25
```

Sinh mạnh lên nhanh khi Parent thật sự được build.

## 21. Candidate Strength — Khắc

Gọi `A = AttackerStacks`, `D = DefenderStacks`.

Khắc base strength: `A × D`

Range: 1 → 25

```
1×1 → 1
1×5 → 5
3×3 → 9
4×5 → 20
5×5 → 25
```

Điều này thưởng cho cả hai bên cùng trưởng thành.
Không coi `1 + 5` ngang `3 + 3` như công thức cộng cũ.

## 22. Final Candidate Weight

Conceptually:

```
finalWeight
=
baseStrength
× relationBias
× elementalBias
× reactionSpecificBias
```

Baseline: all biases = 1.
Build/progression có thể thay đổi sau này.

## 23. Candidate Selection

ReactionSystem chọn highest `finalWeight`.
Không dùng RNG.

## 24. Tie Break

Nếu `finalWeight` bằng nhau:

1. Khắc > Sinh
2. canonical ReactionId lexical/order

Không dùng random.
Không dùng expected damage để chọn.

## 25. Selection And Payoff Are Separate

Candidate Selection không được hỏi "reaction này dự kiến gây bao nhiêu damage?".

Selection chỉ dùng:

- board state
- build bias
- relation rules

Sau khi winner được chọn mới resolve payoff.

## 26. Multicast

Multicast luôn resolve sequentially.

Ví dụ random: Mộc, Hỏa, Kim

Resolve:

```
Mộc
→ apply
→ reaction
→ settle

Hỏa
→ read UPDATED board
→ apply
→ reaction
→ settle

Kim
→ read UPDATED board
→ apply
→ reaction
→ settle
```

Không batch apply toàn bộ rồi scan board.

## 27. Subcast Settlement Boundary

Canonical:

```
SUBCAST START
↓
damage
↓
elemental application
↓
Buff commit
↓
Reaction selection
↓
Reaction snapshot
↓
Reaction consumption
↓
Reaction payoff
↓
Reaction settle
↓
SUBCAST END
```

Subcast kế tiếp chỉ bắt đầu sau settlement.

## 28. No Recursive Reaction

Reaction-generated elemental changes mặc định `reactionEligible = false`.

Ví dụ `Mộc → Hỏa` tạo `Hỏa +3` — Hỏa +3 đó không lập tức `Hỏa → Kim` trong cùng transaction.

## 29. Periodic Effects Do Not React

Không trigger Reaction từ:

- Hỏa Ấn tick
- Độc Căn tick
- Hàn Tức periodic processing
- Trấn Ấn processing
- Liệt Thương passive effect

Reaction trigger là qualifying elemental application.

## 30. Secondary Non-Elemental Statuses Do Not React

Ví dụ Bleed / Defense Break / Attack Seal / Vulnerability không phải Ngũ Hành reaction states.

## 31. Sinh Philosophy

Sinh là conversion / investment.

Sinh baseline: NO reaction damage packet.

Sinh có:

- 1 primary conversion
- 1 signature amplifier

Không biến Sinh thành gói stack + duration + potency + damage + control.

## 32. Sinh Modifier Rule

Sinh amplifier phải bounded, non-runaway.

Baseline modifier:

- stable id
- `reapply = max`
- không stack infinitely

## 33. Sinh Modifier Lifetime

Default: lifetime = Child ailment lifetime.
Khi Child ailment mất: Sinh amplifier mất.

## 34. Mộc Sinh Hỏa — Dưỡng Viêm

Consume: ALL Độc Căn `P`

Primary conversion: `Hỏa Ấn + ceil(P / 2)`

Signature amplifier: Hỏa periodic potency `+5% × P`

Modifier:

```
id = duong_viem
reapply = max
lifetime = Hỏa Ấn lifetime
```

Example P5: +3 Hỏa Ấn, +25% burn potency.

Identity: fuel → burn pressure.
Balance numbers provisional.

## 35. Hỏa Sinh Thổ — Luyện Thổ

Consume: ALL Hỏa Ấn `P`

Primary conversion: `Trấn Ấn + ceil(P / 2)`

Signature amplifier: immediate gauge pushback `= 3% × P`

Example P5: +3 Trấn Ấn, -15% gauge.

Không tạo Slow. Không auto-trigger Cấm Công.

Identity: heat → suppression.
Numbers provisional.

## 36. Thổ Sinh Kim — Dưỡng Kim

Consume: ALL Trấn Ấn `P`

Primary conversion: `Liệt Thương + ceil(P / 2)`

Signature amplifier: Kim penetration `+4% × P`

Modifier:

```
id = duong_kim
reapply = max
lifetime = Liệt Thương lifetime
```

Identity: pressure → sharpness.
Numbers provisional.

## 37. Kim Sinh Thủy — Tụ Thủy

Consume: ALL Liệt Thương `P`

Primary conversion: `Hàn Tức + ceil(P / 2)`

Signature amplifier: remaining duration extension `= floor(P / 2)`

Duration phải có authored cap.
Example: base 3, max after Sinh 5. Không infinite extension.

Identity: condensation → persistence.
Numbers provisional.

## 38. Thủy Sinh Mộc — Nhuận Mộc

Consume: ALL Hàn Tức `P`

Primary conversion: `Độc Căn + ceil(P / 2)`

Signature amplifier: poison potency `+5% × P`

Modifier:

```
id = nhuan_moc
reapply = max
lifetime = Độc Căn lifetime
```

Identity: water → growth.
Numbers provisional.

## 39. Khắc Philosophy

Khắc là destruction / cash-out.

Khắc: consume both → create explicit payoff.

Khắc có thể tạo:

- reaction damage
- control
- secondary debuff
- secondary DoT
- gauge manipulation

## 40. Reaction Damage Origin

Khắc damage: `origin = reaction`.

Không phải skill / DoT / basic attack.

Baseline: reaction damage cannot crit unless progression explicitly unlocks it.

## 41. Thủy Khắc Hỏa — Tức Viêm

Let `A = Hàn Tức`, `D = Hỏa Ấn`. Consume ALL A, ALL D.

Payoff:

```
ReactionDamageCoefficient
=
0.20 × (A + D)
+
0.08 × D
```

Gauge pushback: `3% × A`

Interpretation: Thủy stacks → suppression; Hỏa stacks → released thermal energy.

Identity: medium burst + tempo disruption.
Numbers provisional.

## 42. Hỏa Khắc Kim — Dung Kim

Let `A = Hỏa Ấn`, `D = Liệt Thương`. Consume both.

Reaction damage: `0.35 × (A + D)`

Defense Break strength: `4% × A`
Duration: `ceil(D / 2)` cap 3 holder turns.

Identity: highest direct Khắc burst + vulnerability.
Numbers provisional.

## 43. Kim Khắc Mộc — Đoạn Mộc

Let `A = Liệt Thương`, `D = Độc Căn`. Consume both.

Initial damage: `0.15 × (A + D)`

Bleed:

```
stacks = 1 + floor(A / 2)
Bleed potency: +5% × D
```

Bleed là non-elemental secondary DoT. Không trigger Reaction.

Identity: setup → secondary wound DoT.
Numbers provisional.

## 44. Mộc Khắc Thổ — Xuyên Thổ

Let `A = Độc Căn`, `D = Trấn Ấn`. Consume both.

Damage: `0.15 × (A + D)`

Defense Erosion: `4% × A`

Sustain: heal from actual reaction damage `= 5% × D`, cap 25%.

Interpretation: more Mộc → deeper erosion; more Thổ → more earth-energy converted to sustain.

Identity: erosion + sustain.
Numbers provisional.

## 45. Thổ Khắc Thủy — Trấn Thủy

Let `A = Trấn Ấn`, `D = Hàn Tức`. Consume both.

Damage: `0.10 × (A + D)`

Gauge pushback: `4% × A`

Attack Seal:

```
A < 3  → no Cấm Công
A >= 3 → Cấm Công
```

Duration:

```
D 1–3 → 1 holder turn
D 4–5 → 2 holder turns
```

Cấm Công means: cannot use actions tagged `attack`.

Still allowed: buff, heal, cleanse, defend, utility, resource.

No stun.

Identity: strongest offensive denial reaction.
Numbers provisional.

## 46. Reaction Operation Model

ReactionSystem không trực tiếp mutate gameplay state.

Output:

```ts
interface ReactionResolution {
  reactionId: ReactionId

  context: ReactionContext

  operations: readonly ReactionOperation[]
}
```

## 47. Reaction Operations

Conceptual union:

```ts
type ReactionOperation =
  | ConsumeBuffStacksOperation
  | AddBuffStacksOperation
  | AddBuffModifierOperation
  | ExtendBuffDurationOperation

  | DealReactionDamageOperation

  | ApplyBuffOperation
  | ApplyControlOperation

  | PushGaugeOperation
  | HealOperation
```

System owner thực thi từng operation.

## 48. Consumption Execution

ReactionSystem generates consumption intent.
BuffSystem executes `consumeStacks(all)` with removal reason = `reaction`.

Không dùng `consumed` cho elemental stack removal từ Reaction.
Reaction removal semantic riêng: `reaction`.

## 49. Transaction Boundary

Canonical:

```
Reaction candidate selected
↓
snapshot
↓
build ReactionResolution
↓
queue atomic ReactionCommand
↓
execute consumption
↓
execute payoff operations in authored order
↓
commit
↓
publish reaction events
```

Không nested mutation giữa snapshot và commit.

## 50. Reaction Event

```ts
interface ReactionResolvedEvent {
  type: 'reaction_resolved'

  reactionId: ReactionId
  relation: 'sinh' | 'khac'

  sourceId: CombatEntityId
  targetId: CombatEntityId

  consumed: readonly {
    buffId: string
    stacks: number
  }[]

  combatSequence: number
}
```

Damage/status results có thể được log riêng bởi owner systems.

## 51. No ReactionSystem RNG

ReactionSystem sử dụng zero RNG.
Candidate selection deterministic.

Randomness chỉ đến từ upstream: random elemental cast, multicast rolls, application rolls.

Reaction settlement từ board state phải reproducible.

## 52. Multicast And Death

Nếu một reaction kill target giữa multicast, remaining subcasts không thuộc ReactionSystem.
Skill/Targeting System quyết định retarget or skip.

Nếu retarget: new target → new ReactionBoard.

## 53. Invalid Target

Nếu target chết trước Reaction settlement, ReactionCommand phải validate execution state.
Nếu reaction không còn hợp lệ: cancel safely.
Không mutate dead/removed entity blindly.

## 54. Build Bias

Future progression có thể cung cấp:

```ts
interface ReactionBias {
  relationMultiplier?: {
    sinh?: number
    khac?: number
  }

  elementMultiplier?: Partial<Record<ElementType, number>>

  reactionMultiplier?: Partial<Record<ReactionId, number>>
}
```

Baseline: all = 1.

## 55. Bias Must Not Rewrite Relations

Build có thể prefer Sinh / prefer Khắc / prefer Hỏa-related reaction.

Nhưng không được silently đổi `Mộc → Hỏa` thành `Hỏa → Mộc`.
Ngũ Hành graph là canonical rule.

## 56. Build Hooks Allowed Later

Good progression hooks:

- increase elemental weighting
- increase multicast
- increase stack application
- increase Sinh selection weight
- increase Khắc selection weight
- increase reaction payoff
- retain one stack after reaction
- echo reaction
- duplicate-roll bonus
- element-diversity bonus
- reaction crit unlock

Không baseline.

## 57. Forbidden Manual Control

Baseline Ngộ Đạo không cho:

- choose next element
- choose exact reaction
- manually reorder multicast
- pick Sinh/Khắc per cast
- lock permanent element
- use visible DoT/Nổ route
- use Thế

Nếu progression sau này phá rule này thì phải là explicit major mechanic.

## 58. Duplicate Rolls

Random duplicate element không phải dead roll.

Nếu chưa cap: duplicate → build stack → future ReactionStrength rises.
Nếu đã cap: pure refresh only → NO reaction trigger.

Do đó duplicates vẫn có value nhưng không tạo free reaction spam.

## 59. Board Pressure

Max theoretical raw state: `5 elements × 5 stacks = 25 elemental stacks`.

Consume-all Reaction liên tục collapse board.
Reaction System vì vậy còn là state recycler.

Combat rhythm:

```
accumulate
→ collide
→ collapse
→ rebuild
```

## 60. Deterministic Ordering

Nếu nhiều Reaction commands somehow share same sequence boundary, canonical ordering:

```
combatSequence
↓
sourceId
↓
targetId
↓
reactionId
```

Normal multicast flow vẫn sequential nên trường hợp này hiếm.

## 61. Definition Data

Reaction relation và payoff phải data-driven.

Conceptual:

```ts
interface ReactionDefinition {
  id: ReactionId

  relation: 'sinh' | 'khac'

  elements: {
    parent?: ElementType
    child?: ElementType

    attacker?: ElementType
    defender?: ElementType
  }

  selection: ReactionSelectionDefinition

  payoff: ReactionPayoffDefinition
}
```

Không hard-code `if (fire && metal)` trong core ReactionSystem.

## 62. Relation Registry

Canonical relation registry phải validate:

- 5 Sinh relations
- 5 Khắc relations
- Mỗi pair canonical duy nhất
- Không duplicate contradictory relation

## 63. Reaction Validation

At startup validate:

- unique ReactionId
- valid elements
- valid relation shape
- Sinh has Parent + Child
- Khắc has Attacker + Defender
- no self-element relation
- registered elemental buff mappings exist
- all referenced operation profiles valid
- selection rule valid
- reaction graph complete

Development build: throw on invalid configuration.

## 64. Core Reaction API

Conceptual:

```ts
class ReactionSystem {
  evaluateAfterElementalApplication(
    event: ElementalApplicationCommitted,
  ): ReactionEvaluationResult

  buildCandidates(
    board: ReactionBoard,
    triggerElement: ElementType,
    context: ReactionEvaluationContext,
  ): readonly ReactionCandidate[]

  selectCandidate(
    candidates: readonly ReactionCandidate[],
    bias: ReactionBias,
  ): ReactionCandidate | null

  resolveCandidate(
    candidate: ReactionCandidate,
    boardSnapshot: ReactionBoard,
  ): ReactionResolution
}
```

ReactionSystem không trực tiếp execute operations.

## 65. Elemental Application Event

Reaction needs:

```ts
interface ElementalApplicationCommitted {
  sourceId: CombatEntityId
  targetId: CombatEntityId

  buffDefinitionId: BuffDefinitionId
  element: ElementType

  stacksBefore: number
  stacksAfter: number
  addedStacks: number

  reactionEligible: boolean

  combatSequence: number
}
```

If `reactionEligible = false` → stop immediately.

## 66. Reaction Eligibility

- Default external elemental skill application: `reactionEligible = true`
- Reaction-generated elemental application: `reactionEligible = false`
- Periodic effect: `reactionEligible = false`
- Scripted mechanics must explicitly choose

## 67. Architecture Boundary With Buff System

Buff System owns: ailment instance, stacks, duration, modifiers, consume, remove.

ReactionSystem only requests: consume X, add Y, modify Z.

Reaction never `buff.stacks = 0` directly.

## 68. Architecture Boundary With Damage System

ReactionSystem provides `ReactionDamageRequest`.

DamageSystem owns: stats, mitigation, resistance, HP, death, actualDamage.

## 69. Architecture Boundary With Gauge System

ReactionSystem requests `PushGaugeOperation`.

Gauge/Turn System owns: current gauge, min/max clamp, turn scheduling consequences.

## 70. Architecture Boundary With Action Restriction

Cấm Công is represented as generic restriction:

```ts
ActionRestriction {
  forbiddenTags: ['attack']
}
```

ReactionSystem requests status application.
Buff/Control System stores it.
Action validation enforces it.

No hard-coded `if (earthReaction)` inside skill validation.

## 71. Architecture Boundary With Multicast

ReactionSystem knows nothing about how many subcasts / why subcast happened / random roll sequence.
It receives one committed elemental application at a time.

## 72. Architecture Boundary With Path

Reaction System only checks capability/context.

It does not import: Pháp Tu, Ngộ Đạo, DoT route, Nổ route, Thế.

## 73. Locked Design Invariants

| ID | Invariant |
|---|---|
| INV-R01 | Reaction is enabled by explicit capability |
| INV-R02 | Reaction board is same-source / same-target |
| INV-R03 | Reaction evaluates only after committed elemental application |
| INV-R04 | `addedStacks > 0` is required for baseline reaction evaluation |
| INV-R05 | One application resolves at most one Reaction |
| INV-R06 | Relations are independent of cast order |
| INV-R07 | Sinh consumes all Parent stacks |
| INV-R08 | Sinh keeps Child state |
| INV-R09 | Khắc consumes all Attacker and Defender stacks |
| INV-R10 | Candidate selection is deterministic |
| INV-R11 | Sinh base strength = `P²` |
| INV-R12 | Khắc base strength = `A × D` |
| INV-R13 | Khắc wins equal-weight tie over Sinh |
| INV-R14 | Reaction-generated elemental state cannot recursively react by default |
| INV-R15 | Multicast resolves sequentially |
| INV-R16 | Periodic effects cannot trigger Reaction |
| INV-R17 | ReactionSystem uses zero RNG |
| INV-R18 | Sinh creates no baseline reaction damage packet |
| INV-R19 | Sinh amplifier is bounded/non-runaway |
| INV-R20 | Trấn Ấn does not auto-convert to Cấm Công |

## 74. Required Selection Tests

Sinh strength:

```
P1 → 1
P2 → 4
P3 → 9
P4 → 16
P5 → 25
```

Khắc strength:

```
1×5 = 5
3×3 = 9
5×5 = 25
```

Mature Sinh beats weak Khắc:

```
Sinh P4 = 16
Khắc 1×5 = 5
→ Sinh
```

Mature Khắc beats weak Sinh:

```
Sinh P2 = 4
Khắc 4×4 = 16
→ Khắc
```

Equal tie:

```
Sinh P3 = 9
Khắc 3×3 = 9
→ Khắc
```

## 75. Required Trigger Tests

Stack gained:

```
Hỏa4
apply +2
→ Hỏa5
addedStacks1
→ reaction eligible
```

Cap refresh:

```
Hỏa5
apply +2
→ Hỏa5
addedStacks0
→ reaction NOT evaluated
```

Application failed → no reaction.
Periodic tick → no reaction.
Reaction-generated stack → `reactionEligible false` → no recursion.

## 76. Required Source Isolation Test

```
A: Hỏa5
B: Kim5
same target

A applies Hỏa
→ A cannot Dung Kim using B's Kim
```

## 77. Required Sinh Tests

For each Sinh:

- snapshot Parent
- consume all Parent
- Child remains
- conversion applies
- signature amplifier applies
- no reaction damage

Reapply amplifier: weaker amplifier after stronger → max policy keeps stronger.

## 78. Required Khắc Tests

For each Khắc:

- snapshot A/D
- consume all A/D
- removal reason `reaction`
- payoff uses snapshot values
- No remaining consumed elemental instance if stacks reach zero

## 79. Required Multicast Test

Rolls: Mộc, Hỏa, Kim — must resolve Mộc settle, then Hỏa using updated board, then Kim using updated board. Never batch.

## 80. Required No-Recursion Test

```
Mộc → Hỏa creates +Hỏa
Kim already exists
The generated Hỏa must NOT immediately trigger Hỏa → Kim
```

## 81. Required Cấm Công Test

Trấn Thủy with sufficient A → Attack Seal active.

Target:

- attack action → rejected
- heal → allowed
- buff → allowed
- cleanse → allowed

No stun behavior.

## 82. Required Determinism Test

Given same seed, same random cast results, same initial board, same progression modifiers, ReactionSystem must produce:

- same candidates
- same winner
- same consumption
- same operation sequence

## 83. Provisional Values

The following are NOT architecture-locked:

- +5% potency
- +4% penetration
- 3% gauge push
- 0.35 reaction coefficient
- 2-turn Attack Seal
- etc.

They are balance values. They may change without architecture revision.

## 84. Locked Structure Vs Balance

LOCKED:

- who consumes what
- which relation exists
- selection formulas
- reaction eligibility
- one-reaction rule
- same-source rule
- no recursion
- sequential multicast
- payoff identity

TUNABLE:

- damage coefficient
- modifier percentage
- gauge percentage
- duration cap
- stack conversion count

## 85. Definition Of Done

Reaction System is complete when:

- Reaction is capability-gated.
- Five elemental states map correctly.
- Same-source board works.
- Application at cap does not trigger.
- Cast order does not affect relation identity.
- Candidate generation covers all valid relations involving trigger element.
- Sinh uses `P²`.
- Khắc uses `A×D`.
- Selection is deterministic.
- Consume-all semantics work.
- Multicast settles sequentially.
- Reaction cannot recursively trigger itself.
- Sinh amplifier cannot infinitely stack.
- Trấn Ấn remains stable at 5.
- Cấm Công works as attack restriction, not stun.
- All 5 Sinh profiles resolve.
- All 5 Khắc profiles resolve.
- Reaction damage uses DamageSystem.
- Gauge push uses Gauge/Turn authority.
- Buff mutations use BuffSystem only.
- No ReactionSystem RNG exists.
- Full test suite passes with deterministic event order.

## 86. Final Rule

- Buff System owns elemental state.
- Random Cast System creates elemental applications.
- Reaction System interprets the resulting Ngũ Hành board.
- Damage / Gauge / Control Systems execute the consequences.

Ngộ Đạo gameplay must feel like chaos with understandable laws — not manual combo, and not uncontrolled random effects.

The player builds the machine.
The machine resolves the Dao.
