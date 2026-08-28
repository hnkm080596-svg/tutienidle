# Kiếm Tu — Huy Kiếm / Kiếm Trận / Bạt Kiếm Implementation Plan

> Implement this plan sequentially in its own task branch and linked worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Huy Kiếm thành đòn cày vĩnh viễn (+1 flat dmg/10 cast, 3 level), dựng 2 đường Kiếm Tu — Kiếm Trận (thang 9 trận theo cảnh giới, AoE nhịp tốc đánh, scale theo Kiếm Ý combat) và Bạt Kiếm (ẩn, gate Huy Kiếm Lv3 + 9999 cast, tụ lực AoE toàn màn mỗi x giây).

**Architecture:** Tái dùng tối đa hạ tầng có sẵn: `ProgressionNode`/`NodeSystem` (aggregator idempotent) cho 2 cây node mới; `SkillExecutionPolicy` thêm kind `'channel'` cho tụ lực; `LavaZone` làm khuôn cho `SwordZone`; `totalExperience` của skill `tram` làm bộ đếm cast vĩnh viễn (không cần field save mới). Slot Kiếm Trận = loadout slot 4 với auto-replace.

**Tech Stack:** Vue 3, TypeScript, Vitest, Pinia, Phaser.

**Spec:** `docs/superpowers/specs/2026-08-28-kiem-tu-design.md`

## Global Constraints

- Không dùng `any` trừ khi bất khả kháng (AGENTS.md).
- Không thêm dependency, không đổi architecture ngoài phạm vi plan.
- Development phase: KHÔNG cần save migration (AGENTS.md).
- Mọi hiệu lực node đi qua aggregator `(registry, nodeLevels)` — KHÔNG push modifier vĩnh viễn lúc mua (NodeSystem.ts §6.8).
- Validation data chạy lúc khởi động: data sai phải throw lỗi rõ (pattern NodeRegistry).
- Sau MỖI task: `npm.cmd run test` (targeted), rồi `npm.cmd run type-check`; commit task (repo cho phép commit thường — KHÔNG push).
- Phạm vi code: chỉ Lưỡng Nghi + Tam Tài + Vạn Kiếm gate + toàn bộ Bạt Kiếm + Huy Kiếm rework. Tứ Tượng→Vô Cực: ghi data + chain node, khóa sau gate Kim Đan (PRODUCT SCOPE `data/realms/realm.ts`).
- Cây Bạt Kiếm TUYỆT ĐỐI không có node giảm thời gian tụ (spec §4.3) — validation phải bắt được.

---

### Task 1: Huy Kiếm rework — bộ đếm cast vĩnh viễn, +1 flat damage/10 cast, 3 level

**Files:**
- Modify: `game/src/core/skill/SkillSystem.ts` (hằng số + `getHuyKiemExperienceToNextLevel` + `gainCastExperience` + `getEffectiveSkill`)
- Modify: `game/src/data/skill/Skills.ts` (skill `tram`: `maxLevel` 10→3)
- Test: `game/src/core/skill/SkillSystem.huyKiem.test.ts` (viết lại theo hành vi mới)

**Interfaces:**
- Consumes: `Skill.totalExperience` (đã có, đã lưu save), `SkillSystem.getEffectiveSkill(skill, levelOverride?)` → `EffectiveSkill { effects, passiveModifiers, passiveTrigger }`.
- Produces: `getHuyKiemFlatDamageBonus(totalExperience: number): number` (export từ SkillSystem.ts) — Task 4 (gate Bạt Kiếm) đọc `totalExperience` trực tiếp, không qua hàm này.

- [ ] **Step 1: Viết test fail cho flat damage mới**

Thay nội dung `SkillSystem.huyKiem.test.ts` bằng:

```typescript
import { describe, expect, it } from 'vitest'
import { SkillManager } from './SkillManager'
import { SkillSystem, getHuyKiemFlatDamageBonus } from './SkillSystem'
import { SKILLS } from '@/data/skill/Skills'
import type { CombatEntity } from '../combat/CombatEntity'

function makeEntity(): CombatEntity {
  return {
    realmIndex: 0,
    currentMp: 0,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
  } as CombatEntity
}

describe('Huy Kiếm — flat damage vĩnh viễn theo cast', () => {
  it('mỗi 10 cast +1 flat damage, không trần', () => {
    expect(getHuyKiemFlatDamageBonus(0)).toBe(0)
    expect(getHuyKiemFlatDamageBonus(9)).toBe(0)
    expect(getHuyKiemFlatDamageBonus(10)).toBe(1)
    expect(getHuyKiemFlatDamageBonus(9999)).toBe(999)
  })

  it('getEffectiveSkill cộng flat bonus vào effect damage của tram', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!
    skill.totalExperience = 150

    const effective = system.getEffectiveSkill(skill)

    const damage = effective.effects.find((effect) => effect.type === 'damage')
    expect(damage?.value).toBe(1 + 15)
  })

  it('skill khác KHÔNG nhận flat bonus', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'hoa_cau_thuat')!
    system.learn(template)
    const skill = manager.get('hoa_cau_thuat')!
    skill.totalExperience = 150

    const effective = system.getEffectiveSkill(skill)

    const damage = effective.effects.find((effect) => effect.type === 'damage')
    expect(damage?.value).toBe(1)
  })
})

describe('Huy Kiếm — 3 level mốc 1000/10000 cast', () => {
  it('Lv1→2 tại 1000 cast, Lv2→3 tại 10000 cast, không bao giờ Lv4', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    system.equipToSlot('tram', 0)
    const entity = makeEntity()
    const skill = manager.get('tram')!

    for (let cast = 0; cast < 999; cast++) system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(1)

    system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(2)

    for (let cast = 0; cast < 9000; cast++) system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(3)

    for (let cast = 0; cast < 5000; cast++) system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(3)
    expect(skill.totalExperience).toBe(15000)
  })

  it('không thể nâng Huy Kiếm bằng Cảm Ngộ', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(SKILLS.find((skill) => skill.id === 'tram')!)
    expect(system.upgradeSkill('tram', { skillInsight: 999 } as never)).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail đúng lý do**

Run: `npm.cmd test -- --run src/core/skill/SkillSystem.huyKiem.test.ts`
Expected: FAIL — `getHuyKiemFlatDamageBonus` không tồn tại / `maxLevel` vẫn 10.

- [ ] **Step 3: Implement trong SkillSystem.ts**

Xóa `getHuyKiemExperienceToNextLevel` (dòng 24-26) và thay bằng:

```typescript
export const HUY_KIEM_CASTS_PER_LEVEL = 10

/** Mỗi 10 cast vĩnh viễn +1 flat damage cho Huy Kiếm — KHÔNG trần. */
export function getHuyKiemFlatDamageBonus(totalExperience: number): number {
  return Math.floor(Math.max(0, totalExperience) / HUY_KIEM_CASTS_PER_LEVEL)
}

/** Mốc level tuyến tính: Lv2 tại 1000 cast, Lv3 tại 10000 cast. */
const HUY_KIEM_LEVEL_CAST_THRESHOLDS = [0, 1000, 10000] as const

export function getHuyKiemLevelForCasts(totalExperience: number): number {
  let level = 1
  for (const threshold of HUY_KIEM_LEVEL_CAST_THRESHOLDS) {
    if (totalExperience >= threshold) level = Math.min(3, level + 1)
  }
  return level
}
```

Sửa `getEffectiveSkill()` — sau khối `const effects = baseEffects.map(...)` hiện có, đổi điều kiện map để CỘNG FLAT cho `tram` thay vì nhân %:

```typescript
const isHuyKiem = skill.id === 'tram'

const effects = baseEffects.map((effect) => {
  if (effect.type !== 'damage' || effect.value === undefined) {
    return effect
  }

  if (isHuyKiem) {
    return { ...effect, value: effect.value + getHuyKiemFlatDamageBonus(skill.totalExperience ?? 0) }
  }

  return { ...effect, value: effect.value * levelMultiplier }
})
```

Sửa `gainCastExperience()` (dòng ~413):

```typescript
private gainCastExperience(skill: Skill): void {
  if (skill.id !== 'tram') return

  skill.experience = (skill.experience ?? 0) + 1
  skill.totalExperience = (skill.totalExperience ?? 0) + 1

  const targetLevel = getHuyKiemLevelForCasts(skill.totalExperience)

  if (targetLevel > skill.level) {
    const levelsGained = targetLevel - skill.level
    skill.level = targetLevel
    this.onLevelUp?.(skill, levelsGained)
  }
}
```

Sửa `Skills.ts` skill `tram`: `maxLevel: 10` → `maxLevel: 3`.

- [ ] **Step 4: Chạy test pass + các test liên quan**

Run: `npm.cmd test -- --run src/core/skill`
Expected: PASS toàn bộ (kể cả `SkillSystem.level.test.ts` — nếu fail vì giả định cũ về `tram`, sửa test theo hành vi mới).

- [ ] **Step 5: type-check + commit**

```bash
npm.cmd run type-check
git add game/src/core/skill/SkillSystem.ts game/src/data/skill/Skills.ts game/src/core/skill/SkillSystem.huyKiem.test.ts
git commit -m "feat(kiem-tu): huy kiem flat +1 dmg/10 cast, 3-level thresholds 1000/10000"
```

---

### Task 2: Prereq node mới `skillCastCount` + validation cây Bạt Kiếm

**Files:**
- Modify: `game/src/core/progression/ProgressionNode.ts` (thêm union member)
- Modify: `game/src/core/progression/NodeSystem.ts` (`hasPrerequisite` case mới)
- Modify: `game/src/core/skill/SkillManager.ts` (cần tra `totalExperience` theo skillId — NodeSystem không giữ registry skill → truyền qua PlayerData.skills nếu có, xem Step 3)
- Test: `game/src/core/progression/NodeSystem.test.ts` (thêm describe)

**Interfaces:**
- Consumes: `PlayerData` (field `skills?: Skill[]` — KIỂM TRA thực tế: Player.ts có `skills` không; nếu skill nằm ngoài PlayerData thì prereq đọc qua tham số mở rộng).
- Produces: `{ kind: 'skillCastCount'; skillId: string; level?: number; count?: number }` — Task 5 dùng gate root Bạt Kiếm `{ kind: 'skillCastCount', skillId: 'tram', level: 3, count: 9999 }`.

- [ ] **Step 1: Kiểm tra chỗ ở của skill instance trong PlayerData**

Run: `Select-String -Path game/src/core/player/Player.ts -Pattern "skills"`
Nếu `PlayerData` KHÔNG chứa mảng skill (skill sống trong `SkillManager` của GameManager), thì prereq `skillCastCount` phải đọc từ `player.skillCastCounts: Record<string, number>` — thêm field save mới này, và `SkillSystem.gainCastExperience` (Task 1) đồng bộ `player.skillCastCounts[skill.id] = skill.totalExperience` qua callback `onLevelUp` hoặc tham số player. **Chốt phương án TRƯỚC khi code, ghi kết quả vào commit message.**

- [ ] **Step 2: Viết test fail**

Thêm vào `NodeSystem.test.ts`:

```typescript
describe('prerequisite skillCastCount', () => {
  it('thoả khi level skill đạt ngưỡng VÀ cast count đạt ngưỡng', () => {
    const player = createTestPlayer({
      skillCastCounts: { tram: 9999 },
      skillLevels: { tram: 3 },
    })

    expect(
      hasPrerequisite(player, { kind: 'skillCastCount', skillId: 'tram', level: 3, count: 9999 }),
    ).toBe(true)

    expect(
      hasPrerequisite(player, { kind: 'skillCastCount', skillId: 'tram', level: 3, count: 10000 }),
    ).toBe(false)

    expect(
      hasPrerequisite(player, { kind: 'skillCastCount', skillId: 'tram', level: 4, count: 9999 }),
    ).toBe(false)
  })
})
```

(`createTestPlayer` = helper có sẵn trong file test — thêm 2 field mới vào factory nếu thiếu.)

- [ ] **Step 3: Implement**

`ProgressionNode.ts` — thêm vào union `NodePrerequisite`:

```typescript
// Kiếm Tu (2026-08-28) — gate Bạt Kiếm: skill `skillId` phải đạt
// `level` VÀ tích lũy `count` cast (đọc PlayerData.skillCastCounts,
// mirror Skill.totalExperience — nguồn sự thật save).
| { kind: 'skillCastCount'; skillId: string; level?: number; count?: number }
```

`Player.ts` — thêm field save:

```typescript
// Mirror totalExperience của từng skill (đọc lúc gate node, không cần
// SkillManager) — ghi mỗi lần cast trong SkillSystem.gainCastExperience.
skillCastCounts?: Record<string, number>
```

`NodeSystem.ts` — case mới trong `hasPrerequisite`:

```typescript
case 'skillCastCount': {
  const counts = player.skillCastCounts ?? {}
  const levels = player.skillLevels ?? {}
  const castOk = prerequisite.count === undefined || (counts[prerequisite.skillId] ?? 0) >= prerequisite.count
  const levelOk = prerequisite.level === undefined || (levels[prerequisite.skillId] ?? 1) >= prerequisite.level
  return castOk && levelOk
}
```

`SkillSystem.gainCastExperience` — nhận thêm `player?: PlayerData` qua constructor callback HOẶC đồng bộ trong `useInSlot`/`beginCastInSlot` nơi có player; đơn giản nhất: thêm setter `SkillSystem.setCastCountSink(sink: (skillId: string, total: number) => void)` và GameManager nối sink ghi `player.skillCastCounts`.

- [ ] **Step 4: Chạy test pass, type-check, commit**

```bash
npm.cmd test -- --run src/core/progression src/core/skill
npm.cmd run type-check
git add -A game/src/core/progression game/src/core/player/Player.ts game/src/core/skill/SkillSystem.ts
git commit -m "feat(kiem-tu): skillCastCount prerequisite + skillCastCounts save mirror"
```

---

### Task 3: `SkillExecutionPolicy` kind `'channel'` + state tụ lực trên CombatEntity

**Files:**
- Modify: `game/src/core/skill/Skill.ts` (union + doc)
- Modify: `game/src/core/combat/CombatEntity.ts` (thêm `tuLucElapsed`, `tuLucDamageTakenPercent`, `tuLucActive`)
- Modify: `game/src/core/enemy/Enemy.ts` + `game/src/core/player/Player.ts` (init field mới = 0/false)
- Modify: `game/src/core/skill/SkillSystem.ts` (`usesCooldownClock` — channel KHÔNG dùng cooldown clock)
- Test: `game/src/core/skill/SkillSystem.channel.test.ts` (mới)

**Interfaces:**
- Produces: `execution: { kind: 'channel'; tickSeconds: number }` — Task 6 BattleSystem đọc để tick; Task 7 UI slider đọc/ghi `tickSeconds` runtime.
- Consumes: không.

- [ ] **Step 1: Viết test fail**

```typescript
import { describe, expect, it } from 'vitest'
import { usesCooldownClockForTest } from './SkillSystem'

describe("execution policy 'channel'", () => {
  it('channel KHÔNG dùng cooldown clock (không CDR, không CD)', () => {
    expect(usesCooldownClockForTest({ kind: 'channel', tickSeconds: 3 })).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy fail** — Run: `npm.cmd test -- --run src/core/skill/SkillSystem.channel.test.ts` → FAIL (không có export).

- [ ] **Step 3: Implement**

`Skill.ts` union thêm:

```typescript
// Kiếm Tu Bạt Kiếm (2026-08-28) — TỤ LỰC: không cooldown, không cast
// time; nhân vật ở trạng thái channel liên tục, MỖI tickSeconds gây 1
// phát theo effects/target của skill (BattleSystem.updateChanneling).
// tickSeconds chỉnh được bằng UI trong trận (3–9s, spec §4.2).
| {
    kind: 'channel'
    tickSeconds: number
  }
```

`SkillSystem.ts`: `usesCooldownClock` trả `false` cho `channel`; export wrapper test-only `usesCooldownClockForTest` (hoặc đặt test import trực tiếp nếu đã export).

`CombatEntity.ts` thêm:

```typescript
// Kiếm Tu Bạt Kiếm — trạng thái tụ lực (reset mỗi kỳ sau mỗi phát
// quạt; tuLucActive=false khi chết/khống chế cứng).
tuLucActive: boolean
tuLucElapsed: number
// % maxHP đã MẤT trong kỳ tụ hiện tại — nền cho amp "nhận càng
// nhiều gây càng nhiều" (spec §4.2), đọc lúc resolve phát quạt.
tuLucDamageTakenPercent: number
```

Init `false, 0, 0` trong `Player.ts:createDefaultPlayer` (entity combat) và `Enemy.ts` factory.

- [ ] **Step 4: test + type-check + commit**

```bash
npm.cmd test -- --run src/core/skill
npm.cmd run type-check
git add -A game/src/core/skill game/src/core/combat game/src/core/player game/src/core/enemy
git commit -m "feat(kiem-tu): channel execution policy + tu luc combat state"
```

---

### Task 4: BattleSystem — auto-channel, tick AoE toàn màn, amp nhận→gây

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts` (vòng update: `updateChanneling()`; resolve hit reuse `all_lanes`)
- Modify: `game/src/core/combat/CombatSystem.ts` (hook cộng amp vào damage của phát quạt — hoặc reuse multiplier path sẵn có, KHÔNG sửa pipeline)
- Test: `game/src/core/battle/BattleSystem.batKiem.test.ts` (mới)

**Interfaces:**
- Consumes: Task 3 (`execution.kind === 'channel'`, `tuLucElapsed`, `tuLucDamageTakenPercent`), `targetingForSkill` (`CombatAction.ts:44` — `all_enemies` → `all_lanes`), `collectAffected`, `actionImpact.beginSkillBatch`.
- Produces: `BattleSystem.setChannelTickSeconds(skillId: string, seconds: number): void` — Task 7 UI slider gọi.

- [ ] **Step 1: Viết test fail** (pattern dựng BattleSystem tối giản như `BattleSystem.hoaThe.test.ts`):

```typescript
it('vào trận với skill channel: mỗi tickSeconds gây 1 phát trúng MỌI hàng', () => {
  // player loadout slot 0 = bat_kiem_thuat (execution channel 3s),
  // 3 enemy 3 hàng khác nhau.
  system.update(3.0)
  expect(vitalsEvents.filter((e) => e.reason === 'damage')).toHaveLength(3)

  system.update(2.9)
  expect(system.getBattle()!.player.tuLucElapsed).toBeCloseTo(2.9, 5)

  system.update(0.1)
  expect(vitalsEvents.filter((e) => e.reason === 'damage')).toHaveLength(6)
})

it('amp: mất 20% maxHP trong kỳ → phát quạt +20% damage (hệ số 1.0)', () => {
  // gây 20% maxHP damage lên player, rồi tick đủ 3s.
  const before = enemy.currentHp
  system.update(3.0)
  expect(before - enemy.currentHp).toBeGreaterThan(baseDamage * 1.19)
})

it('chết/khống chế cứng cắt tụ: stun → tuLucActive=false, không tick tiếp', () => {
  // áp ailment 'troi_chan'/stun rồi update 10s — không thêm damage.
})

it('setChannelTickSeconds đổi nhịp từ kỳ tụ KẾ TIẾP', () => {
  system.setChannelTickSeconds('bat_kiem_thuat', 9)
  // 3s đầu chưa nổ, 9s nổ.
})
```

- [ ] **Step 2: Chạy fail** — Run: `npm.cmd test -- --run src/core/battle/BattleSystem.batKiem.test.ts` → FAIL.

- [ ] **Step 3: Implement `updateChanneling(battle, deltaSeconds)`**

Trong `BattleSystem.update()` (cạnh `updateHoaThe`/`updateKimThe`):

```typescript
private updateChanneling(battle: Battle, deltaSeconds: number) {
  const player = battle.player

  if (!player.tuLucActive) {
    return
  }

  player.tuLucElapsed += deltaSeconds

  const skill = this.skillSystem.getManager().get(this.channelSkillId!)
  const tickSeconds = this.channelTickSeconds ?? (skill?.execution?.kind === 'channel' ? skill.execution.tickSeconds : 0)

  while (player.tuLucElapsed >= tickSeconds) {
    player.tuLucElapsed -= tickSeconds

    this.resolveChannelTick(battle, skill!, player.tuLucDamageTakenPercent)

    player.tuLucDamageTakenPercent = 0
  }
}
```

`resolveChannelTick` reuse đúng đường cast hiện có (`castSkill` với target = enemy đầu tiên, `targetingForSkill` tự lo `all_lanes`), multiplier phát quạt = `1 + ampPercent × hệ số` (hằng số `BAT_KIEM_AMP_PER_DAMAGE_TAKEN = 1.0` đặt trong BattleSystem.ts, chỉnh qua playtest). `tuLucDamageTakenPercent` cộng dồn trong `applyActionHit`/vitals khi player nhận damage lúc `tuLucActive`.

Kích hoạt: đầu trận, nếu skill channel đang equip → `tuLucActive = true`. Cắt: chết, hoặc ailment stun/`thach_hoa`/`troi_chan` (check trong AilmentSystem apply hook — reuse event bus `ailment_applied`).

- [ ] **Step 4: test pass + regression battle**

```bash
npm.cmd test -- --run src/core/battle
npm.cmd run type-check
git add -A game/src/core/battle game/src/core/combat
git commit -m "feat(kiem-tu): auto-channel tick AoE + damage-taken amp"
```

---

### Task 5: Data — 2 cây node Kiếm Tu + skill Bạt Kiếm + 9 chiêu trận + gate path

**Files:**
- Create: `game/src/data/progression/KiemTuNodes.ts`
- Modify: `game/src/data/skill/Skills.ts` (thêm `bat_kiem_thuat` + 9 skill `kiem_tran_*`; sửa `van_kiem_trieu_tong`: `requiredRealmId: 'foundation_establishment'`, `unreleased` giữ nguyên trạng thái; bỏ 2 skill khỏi kit ở Task 6)
- Modify: `game/src/App.vue` (dòng ~123: `gameManager.registerProgressionNodes(KIEM_TU_NODES)`)
- Test: `game/src/data/progression/KiemTuNodes.test.ts` (mới — validation khởi động)

**Interfaces:**
- Consumes: Task 2 prereq `skillCastCount`, Task 3 `execution: 'channel'`.
- Produces: `KIEM_TU_NODES: ProgressionNode[]` (branchTag `kiem_tran` | `bat_kiem`); skill ids: `bat_kiem_thuat`, `kiem_tran_luong_nghi` … `kiem_tran_vo_cuc`.

- [ ] **Step 1: Viết test validation fail**

```typescript
import { describe, expect, it } from 'vitest'
import { KIEM_TU_NODES } from './KiemTuNodes'

describe('KiemTuNodes data validation', () => {
  it('chain Kiếm Trận đủ 9 trận đúng thứ tự realm', () => {
    const tran = KIEM_TU_NODES.filter((node) => node.role === 'keystone' && node.branchTag === 'kiem_tran')
    expect(tran.map((node) => node.id)).toEqual([
      'kiem_tran_luong_nghi', 'kiem_tran_tam_tai', 'kiem_tran_tu_tuong',
      'kiem_tran_ngu_hanh', 'kiem_tran_luc_dao', 'kiem_tran_that_tinh',
      'kiem_tran_bat_quai', 'kiem_tran_cuu_cung', 'kiem_tran_vo_cuc',
    ])
  })

  it('cây Bạt Kiếm KHÔNG chứa node giảm thời gian tụ', () => {
    const forbidden = KIEM_TU_NODES.filter(
      (node) => node.branchTag === 'bat_kiem' &&
        JSON.stringify(node.effect).includes('tickSeconds') &&
        /"flat":\s*-/.test(JSON.stringify(node.effect)),
    )
    expect(forbidden).toHaveLength(0)
  })

  it('root Bạt Kiếm gate Lv3 + 9999 cast', () => {
    const root = KIEM_TU_NODES.find((node) => node.id === 'bat_kiem_an')!
    expect(root.prerequisites).toContainEqual({
      kind: 'skillCastCount', skillId: 'tram', level: 3, count: 9999,
    })
  })
})
```

- [ ] **Step 2: Chạy fail** → FAIL (file chưa tồn tại).

- [ ] **Step 3: Tạo `KiemTuNodes.ts`**

Cấu trúc (dùng builder riêng gọn hơn PhapTuNodes vì 2 cây khác shape):

```typescript
const TRAN_SEQUENCE: Array<{ id: string; name: string; realmId: string; skillId: string; swordCount: number }> = [
  { id: 'kiem_tran_luong_nghi', name: 'Lưỡng Nghi Kiếm Trận', realmId: 'qi_refining', skillId: 'kiem_tran_luong_nghi', swordCount: 2 },
  { id: 'kiem_tran_tam_tai', name: 'Tam Tài Kiếm Trận', realmId: 'foundation_establishment', skillId: 'kiem_tran_tam_tai', swordCount: 3 },
  { id: 'kiem_tran_tu_tuong', name: 'Tứ Tượng Kiếm Trận', realmId: 'golden_core', skillId: 'kiem_tran_tu_tuong', swordCount: 4 },
  { id: 'kiem_tran_ngu_hanh', name: 'Ngũ Hành Kiếm Trận', realmId: 'nascent_soul', skillId: 'kiem_tran_ngu_hanh', swordCount: 5 },
  { id: 'kiem_tran_luc_dao', name: 'Lục Đạo Kiếm Trận', realmId: 'soul_transformation', skillId: 'kiem_tran_luc_dao', swordCount: 6 },
  { id: 'kiem_tran_that_tinh', name: 'Thất Tinh Kiếm Trận', realmId: 'void_refinement', skillId: 'kiem_tran_that_tinh', swordCount: 7 },
  { id: 'kiem_tran_bat_quai', name: 'Bát Quái Kiếm Trận', realmId: 'body_integration', skillId: 'kiem_tran_bat_quai', swordCount: 8 },
  { id: 'kiem_tran_cuu_cung', name: 'Cửu Cung Kiếm Trận', realmId: 'mahayana', skillId: 'kiem_tran_cuu_cung', swordCount: 9 },
  { id: 'kiem_tran_vo_cuc', name: 'Vô Cực Kiếm Trận', realmId: 'tribulation', skillId: 'kiem_tran_vo_cuc', swordCount: 9 },
]
```

Mỗi trận node: `role: 'keystone'`, `insightCost: 2`, `prerequisites: [realm gate, node trận trước (trừ Lưỡng Nghi)]`, `effect: { unlocksSkillIds: [skillId] }`. Growth phụ Kiếm Trận (`branchTag: 'kiem_tran'`): `minor_tran_pierce` (+kiếm xuyên), `minor_tran_intent_gain` (+Ý mỗi hit — statModifier `swordIntentPerHit`? KHÔNG — dùng `skillModifiers` gắn thẳng skill trận gần nhất; đơn giản: statModifier `elementApplicationPercent`-style mới `swordIntentGainPercent` — CHỈ dùng stat đã tồn tại; nếu chưa có, growth chỉ gồm các stat có thật: `attackSpeedPercent`, `metalPower`, `skillDamagePercent`).

Cây Bạt Kiếm: root `bat_kiem_an` (gate Task 2, `effect: { unlocksSkillIds: ['bat_kiem_thuat'] }`), growth: `minor_bat_charge_cap` (tăng trần x — `skillModifiers` stat mới `batKiemMaxTickSeconds`), `minor_bat_tick_damage` (+% dmg theo x — `batKiemDamagePerTickSecond`), `minor_bat_ward` (ward trong tụ — statModifier `wardMax`), `minor_bat_tenacity` (giảm gián đoạn — `ailmentResistPercent`), keystone `bat_kiem_thuc` (mở đường Bạt Kiếm — `effect: { unlocksSkillIds: [] }` + flag node mới `setsKiemTuRoute: 'bat_kiem'` HOẶC đơn giản: keystone chỉ là gate UI, route đổi qua nút đổi đường).

- [ ] **Step 4: Skill data mới trong `Skills.ts`**

```typescript
{
  id: 'bat_kiem_thuat',
  name: 'Bạt Kiếm Thuật',
  description: 'Tụ lực kiếm ý, mỗi vài giây quạt một kiếm khí xuyên thiên địa, sát thương toàn màn hình.',
  type: 'active',
  level: 1,
  maxLevel: 10,
  cooldown: 0,
  remainingCooldown: 0,
  target: 'all_enemies',
  execution: { kind: 'channel', tickSeconds: 3 },
  effects: [
    {
      type: 'damage',
      value: 2,
      components: [{ kind: 'element', element: 'metal', ratio: 1 }],
      attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
    },
  ],
  resourceType: 'none',
  buildTag: 'burst',
  unlocked: false,
  equipped: false,
},
```

9 skill `kiem_tran_*`: `execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 }`, `target: 'all_enemies'`, damage metal `value: 0.5 + swordCount * 0.1`, `swordIntentDamageRatio: 0.0002 * swordCount`, `requiredRealmId` = realm gate tương ứng, `unlocked: false, equipped: false`.

- [ ] **Step 5: Đăng ký + test pass**

`App.vue` thêm `import { KIEM_TU_NODES } from './data/progression/KiemTuNodes'` + `gameManager.registerProgressionNodes(KIEM_TU_NODES)`.

```bash
npm.cmd test -- --run src/data/progression src/core/progression
npm.cmd run type-check
git add -A game/src/data/progression game/src/data/skill/Skills.ts game/src/App.vue
git commit -m "feat(kiem-tu): KiemTuNodes 2 trees + bat kiem/9 tran skills data"
```

---

### Task 6: Slot Kiếm Trận (slot 4) + auto-replace + route đổi đường

**Files:**
- Modify: `game/src/core/skill/SkillLoadoutSlots.ts` (slot 4 dành riêng Kiếm Trận — KHÔNG đổi hàm đếm, chỉ thêm helper)
- Modify: `game/src/core/game/GameManager.ts` (`purchaseNode()` hook: node có `unlocksSkillIds` là skill trận → auto-equip slot 4 thay skill cũ; `setKiemTuRoute(route)` mới; `chooseCultivationPath('kiem_tu')` bỏ cấp `kiem_khai_thien_mon`/`van_kiem_trieu_tong` khỏi kit — kit còn `['tram', 'kiem_khai_thien_mon', 'van_kiem_trieu_tong']` → `['tram', 'kiem_khai_thien_mon']` + Lưỡng Nghi auto qua node root)
- Modify: `game/src/core/player/CultivationPathKit.ts` (kit kiem_tu `skillIds` tuple 2 phần? — GIỮ tuple 3, slot 2 = `van_kiem_trieu_tong` nhưng `requiredRealmId` gate đã chặn cast tới Trúc Cơ; KHÔNG đổi tuple)
- Modify: `game/src/core/player/Player.ts` (`kiemTuRoute?: 'kiem_tran' | 'bat_kiem'`)
- Test: `game/src/core/game/GameManager.kiemTuRoute.test.ts` (mới)

**Interfaces:**
- Produces: `GameManager.setKiemTuRoute(player, route): boolean` (chặn trong combat — copy guard `setArtifactPath` `GameManager.ts:1045-1059`); `KIEM_TRAN_SLOT_INDEX = 4`.
- Consumes: Task 5 node ids/skill ids.

- [ ] **Step 1: Viết test fail**

```typescript
it('mở Tam Tài tự thay Lưỡng Nghi ở slot Kiếm Trận', () => {
  // player kiem_tu, đã mua Lưỡng Nghi → slot 4 = kiem_tran_luong_nghi
  player.realmId = 'foundation_establishment'
  expect(gameManager.purchaseNode('kiem_tran_tam_tai', player)).toBe(true)
  expect(gameManager.skillManager.getEquippedInSlot(4)?.id).toBe('kiem_tran_tam_tai')
  expect(gameManager.skillManager.get('kiem_tran_luong_nghi')!.equipped).toBe(false)
})

it('đổi route bat_kiem: chặn trong combat, ngoài combat OK, cần keystone', () => {
  expect(gameManager.setKiemTuRoute(player, 'bat_kiem')).toBe(false) // chưa mua keystone
  // mua bat_kiem_an + bat_kiem_thuc → true; giữa battle → false
})
```

- [ ] **Step 2: Chạy fail** → FAIL.

- [ ] **Step 3: Implement**

`GameManager.purchaseNode()` — sau `learnSkill(skillId)` cho `unlocksSkillIds`: nếu `skillId.startsWith('kiem_tran_')` → `equipToSlot(skillId, KIEM_TRAN_SLOT_INDEX)` (equipToSlot tự dời skill cũ — kiểm chứng `SkillSystem.equipToSlot` có dời; nếu không, unequip skill trận cũ trước).

`setKiemTuRoute`: guard combat y hệt `setArtifactPath`; route `bat_kiem` cần `getNodeLevel(player, 'bat_kiem_thuc') >= 1`. Route đổi → slot 0 vẫn `tram`; Bạt Kiếm equip slot 1 (thay `kiem_khai_thien_mon` — skill cũ giữ unlocked).

- [ ] **Step 4: test + type-check + commit**

```bash
npm.cmd test -- --run src/core/game
npm.cmd run type-check
git add -A game/src/core/game game/src/core/player game/src/core/skill/SkillLoadoutSlots.ts
git commit -m "feat(kiem-tu): kiem tran slot auto-replace + route switch gate"
```

---

### Task 7: UI — slider tụ lực trong trận + panel chọn đường Kiếm Tu

**Files:**
- Modify: `game/src/components/game/combat/CombatControlBar.vue` (slider 3–9s, chỉ hiện khi `kiemTuRoute === 'bat_kiem'`)
- Modify: `game/src/components/panels/QuanKhiPanel.vue` (Kiếm Tu: 2 nút chọn đường — Kiếm Trận mặc định, Bạt Kiếm hiện khi đạt gate Task 2)
- Modify: `game/src/composables/useCombatSkillPresentation.ts` (hiện `tuLucElapsed/tickSeconds` trên HUD Bạt Kiếm)
- Test: component test theo pattern `useEquipmentTooltip.test.ts` nếu panel có logic tách được; còn lại verify bằng build.

**Interfaces:**
- Consumes: `GameManager.setChannelTickSeconds` (Task 4), `setKiemTuRoute` (Task 6), `player.skillCastCounts` (Task 2).

- [ ] **Step 1: Slider trong CombatControlBar** — `v-if` route bat_kiem; `input type="range" min="3" max="9" step="1"`; `@input` gọi `setChannelTickSeconds('bat_kiem_thuat', value)` + lưu `player.channelTickSeconds` (thêm field save nhỏ vào Player.ts nếu muốn nhớ giữa trận — dev phase, đơn giản: không nhớ, mặc định 3 mỗi trận).

- [ ] **Step 2: Panel chọn đường** — điều kiện Bạt Kiếm: `skillCastCounts.tram >= 9999 && skillLevels.tram >= 3` (hoặc đọc `skillCastCounts` + level đã mirror). Nút đổi đường ngoài combat.

- [ ] **Step 3: Verify**

```bash
npm.cmd run type-check
npm.cmd run build
```

- [ ] **Step 4: Commit**

```bash
git add -A game/src/components game/src/composables game/src/core/player/Player.ts
git commit -m "feat(kiem-tu): channel tick slider + route selection UI"
```

---

### Task 8: SwordZone (keystone Kiếm Trận) + VFX + verification toàn phần

**Files:**
- Create: `game/src/core/battle/SwordZone.ts` (clone `LavaZone.ts`, element metal, `remainingCharges` thay `remainingTime`)
- Modify: `game/src/core/battle/Battle.ts` (`swordZones: SwordZone[]`), `BattleSystem.ts` (`spawnSwordZone`/`updateSwordZones` — mirror `updateLavaZones` `BattleSystem.ts:1477`)
- Modify: `game/src/data/vfx/CombatVfxPresets.ts` + `CombatAction.ts` (preset `tu_luc`, `bat_kiem_quat`, `kiem_tran_zone`)
- Modify: keystone node Kiếm Trận cao nhất trong scope (Tam Tài) — `effect` thêm `grantsSwordZone: true` flag mới trên SkillEffect HOẶC đơn giản: growth node `minor_tran_pierce` đủ cho scope này; SwordZone để milestone sau nếu phình — **quyết định tại chỗ: nếu >150 dòng, tách Task 8b, ghi chú vào plan.**
- Test: `game/src/core/battle/BattleSystem.swordZone.test.ts` (mirror `BattleSystem.lavaZone.test.ts`)

- [ ] **Step 1: Test fail cho SwordZone spawn/tick/expire-theo-charge.**
- [ ] **Step 2: Chạy fail.**
- [ ] **Step 3: Implement clone LavaZone + hook keystone.**
- [ ] **Step 4: VFX presets mới (id + color + duration — art sau, engine đủ).**
- [ ] **Step 5: Full gate**

```bash
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```

- [ ] **Step 6: Commit**

```bash
git add -A game/src/core/battle game/src/data/vfx game/src/core/battle/CombatAction.ts
git commit -m "feat(kiem-tu): sword zone keystone + vfx presets"
```

---

## Self-Review (đã chạy khi viết plan)

1. **Spec coverage**: Huy rework ✓ (T1); gate Bạt ✓ (T2/T5/T7); channel + x 3–9 + UI slider ✓ (T3/T4/T7); amp nhận→gây ✓ (T4); 9 trận + realm prereq ✓ (T5); slot riêng auto-replace ✓ (T6); Vạn Kiếm ultimate Trúc Cơ ✓ (T5 sửa requiredRealmId); SwordZone ✓ (T8); validation khởi động ✓ (T5 Step 1).
2. **Placeholders**: Task 5 growth node `swordIntentGainPercent` có ghi chú chốt dùng stat có thật — executor phải kiểm kê `StatTypes.ts` trước khi thêm stat mới.
3. **Type consistency**: `skillCastCounts` (T2) dùng nhất quán T5/T7; `KIEM_TRAN_SLOT_INDEX = 4` (T6) khớp `MAX_SKILL_LOADOUT_SLOTS = 5`; `setChannelTickSeconds` (T4→T7).
