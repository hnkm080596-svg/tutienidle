# M1 — Nội dung Trúc Cơ Thật (Foundation Floor 1-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay 10 stage Trúc Cơ clone của Luyện Khí bằng nội dung thật: 10 loài quái mới prefix `foundation_`, 1 boss 2-phase + enrage, 10 stage `foundation_floor_1..10` authored tường minh, 5 quest Trúc Cơ, cập nhật `game-guide.md` — **không đụng gate Kim Đan** (giữ cho version sau, theo yêu cầu người dùng).

**Architecture:** Thuần data-driven — thêm enemy definitions vào `ENEMY_DEFINITIONS` (`Enemies.ts`), thay `foundationStages` clone-map bằng 10 stage authored tường minh (giữ id `foundation_floor_1..10`), thêm quest entries. Không đổi engine/progression/gate logic. Boss dùng hạ tầng `tribulationPhases` + `enrage` đã generic hóa (BattleSystem đọc chung cho quái Kiếp lẫn Boss thường).

**Tech Stack:** Vue 3 + TypeScript + Vitest (đã có). Không thêm dependency.

**Spec:** [truc-co-kim-dan-content-plan.md](./truc-co-kim-dan-content-plan.md) — **Milestone 1 (mục 4) là phạm vi duy nhất**. Ràng buộc người dùng: **dừng ở Trúc Cơ 18 tầng, Kim Đan thiết kế version sau** → M2/M3 (gate Kim Đan, realm passive Kim Đan, node mới, vật liệu realm 4, stage chương 4) **KHÔNG thuộc plan này**.

## Global Constraints

- Không dùng `any`; không thêm dependency; không đổi architecture (AGENTS.md, `game/CLAUDE.md`).
- **Trúc Cơ là mốc kết thúc progression hiện tại.** Không mở gate Kim Đan, không sửa `realm.ts` golden_core, không sửa `canTriggerRealmBreakthrough`, không thêm realm passive/node/vật liệu realm 4+.
- Giữ **id stage `foundation_floor_1..10`** nguyên vẹn (save an toàn; `Zones.ts` KHÔNG đổi).
- Quy tắc Ngũ Hành Mộc→Hỏa→Thổ→Kim→Thủy theo cặp tầng (1-2, 3-4, 5-6, 7-8, 9-10) — đúng pattern Luyện Khí + Phàm Nhân.
- Tầng chẵn = cùng loài tầng lẻ trong cặp, chỉ tiền tố `Hung ` + stat mạnh hơn; không tự thêm "Vương/Đầu Lĩnh" (engine tự thêm `Tinh Anh `/`Đại Vương ` lúc spawn).
- Enemy author theo `statsInput` gọn; `attackSpeed` theo thang mới 0.8–2.5 đòn/giây; `attackRangeRanks` ≤ 5.
- Boss thường (Stage.bossEnemyId) KHÔNG khai `isBoss: true` trong data — set khi spawn qua `createBossVariant()`. `tribulationPhases`/`enrage` khai trực tiếp trên enemy data.
- Mọi quái mới khai `realmId: 'foundation_establishment'`.
- Verify mỗi task: `npm.cmd run test`, `npm.cmd run type-check`, `npm.cmd run build` từ `game/`.
- Không migration save; không commit nếu không được yêu cầu.

---

### Task 1: 10 loài quái foundation mới

**Files:**
- Modify: `game/src/data/enemy/Enemies.ts` — chèn phân đoạn mới trước `/** Runtime enemy data ... */` (cuối file).
- Test: `game/src/data/enemy/Enemies.test.ts` (file mới)

**Interfaces:**
- Consumes: `defineEnemy()` (`game/src/core/enemy/Enemy.ts`) — tự điền `stats`/`currentHp`/`maxHp`/`alive`.
- Produces: 10 enemy template `foundation_*`, mỗi cặp 1 loài thường + 1 loài boss-eligible.

**Công thức stat (first pass, playtest chỉnh):**
- beast HP(T) = `round(450 * 1.2^(T-1))` → 450, 540, 648, 778, 933, 1120, 1344, 1613, 1936, 2323
- beast ATK(T) = `round(42 * 1.15^(T-1))` → 42, 48, 55, 63, 73, 84, 96, 111, 127, 146
- armor = `18 + 2*T`
- Loài boss-eligible = `×1.6 HP / ×1.4 ATK / ×1.3 armor` (PRE-multiplier; `applyBossMultiplier` ×7/×1.6 áp lúc spawn).
- `attackSpeed: 4`, `movementSpeed: 1.6`, `evasionRate: 20`, `criticalRate: 0.08`, `criticalDamage: 2`, `attackRangeRanks: 1` (melee) / `5` (ranged/caster).
- `elemental.power`: Mộc 10, Hỏa 11, Thổ 12, Kim 12, Thủy 14. `resistances`: hành tương ứng 10–20.
- Rewards: `techniqueInsight = 40 + 6T` (46→100), `spiritStone = 8 + 2T` (10→28). Loài boss-eligible nhân `×2.5 insight / ×6 stone` cho `rewards`; `eliteRewards = ×5 insight / ×6 stone`; `bossRewards = ×12.5 insight / ×15 stone` + `itemDrops: [{ kind: 'equipment', itemId: 'base_kiem', chance: 0.4 }]` (tầng 10 `chance: 0.5`).
- `itemDrops` thường: loài boss-eligible khai `[{ kind: 'material', itemId: 'qi_refining_ore_hoang', amount: 1, chance: 0.3 }]` (sink thật), loài thường bỏ trống. Không thêm material mới.

**Bảng loài (T = tầng):**

| T | Hành | Loài thường (id, tên, archetype, lane) | Loài boss-eligible (id, tên, archetype, lane) |
|---|---|---|---|
| 1 | Mộc | `foundation_wood_ape` Viêm Giáp Viên, melee, ground | `foundation_stone_fungus` Địa Tinh Giám, melee, ground |
| 2 | Mộc | `foundation_ferocious_wood_ape` Hung Viêm Giáp Viên, melee, ground | `foundation_ferocious_stone_fungus` Hung Địa Tinh Giám, melee, ground |
| 3 | Hỏa | `foundation_lava_hound` Dực Hỏa Khuyển, melee, ground | `foundation_sand_scorpion` Sa Hắc, ranged, ground |
| 4 | Hỏa | `foundation_ferocious_lava_hound` Hung Dực Hỏa Khuyển, melee, ground | `foundation_ferocious_sand_scorpion` Hung Sa Hắc, ranged, ground |
| 5 | Thổ | `foundation_rock_tortoise` Thạch Giáp Quy, melee, ground | `foundation_mud_golem` Nê Cự Nhân, caster, ground |
| 6 | Thổ | `foundation_ferocious_rock_tortoise` Hung Thạch Giáp Quy, melee, ground | `foundation_ferocious_mud_golem` Hung Nê Cự Nhân, caster, ground |
| 7 | Kim | `foundation_metal_beetle_swarm` Kim Giáp Trùng Quần, melee, ground | `foundation_blade_hawk_king` Đoạn Nhận Ưng Vương, ranged, air |
| 8 | Kim | `foundation_ferocious_metal_beetle_swarm` Hung Kim Giáp Trùng Quần, melee, ground | `foundation_ferocious_blade_hawk_king` Hung Đoạn Nhận Ưng Vương, ranged, air |
| 9 | Thủy | `foundation_mist_shark` Vụ Cáp, melee, ground | `foundation_flood_dragon_whelp` Giao Sủng, caster, ground |
| 10 | Thủy | `foundation_ferocious_mist_shark` Hung Vụ Cáp, melee, ground | `foundation_ferocious_flood_dragon_whelp` Hung Giao Sủng, caster, ground |

**Lưu ý lane:** loài `blade_hawk_king`/`ferocious_blade_hawk_king` dùng `lane: 'air'`, còn lại `ground`.

- [ ] **Step 1: Viết test thất bại trước**

Tạo `game/src/data/enemy/Enemies.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'

const FOUNDATION_IDS = [
  'foundation_wood_ape',
  'foundation_stone_fungus',
  'foundation_ferocious_wood_ape',
  'foundation_ferocious_stone_fungus',
  'foundation_lava_hound',
  'foundation_sand_scorpion',
  'foundation_ferocious_lava_hound',
  'foundation_ferocious_sand_scorpion',
  'foundation_rock_tortoise',
  'foundation_mud_golem',
  'foundation_ferocious_rock_tortoise',
  'foundation_ferocious_mud_golem',
  'foundation_metal_beetle_swarm',
  'foundation_blade_hawk_king',
  'foundation_ferocious_metal_beetle_swarm',
  'foundation_ferocious_blade_hawk_king',
  'foundation_mist_shark',
  'foundation_flood_dragon_whelp',
  'foundation_ferocious_mist_shark',
  'foundation_ferocious_flood_dragon_whelp',
]

describe('foundation enemy data', () => {
  it('có đủ 20 enemy foundation (10 loài + 10 Hung)', () => {
    const foundation = ENEMIES.filter((enemy) => enemy.id.startsWith('foundation_'))
    expect(foundation.map((enemy) => enemy.id).sort()).toEqual(FOUNDATION_IDS.slice().sort())
  })

  it('mọi enemy foundation thuộc realm foundation_establishment', () => {
    const foundation = ENEMIES.filter((enemy) => enemy.id.startsWith('foundation_'))
    expect(foundation.every((enemy) => enemy.realmId === 'foundation_establishment')).toBe(true)
  })

  it('enemy foundation có stat hợp lệ (HP/ATK > 0, attackSpeed 0.8-2.5)', () => {
    const foundation = ENEMIES.filter((enemy) => enemy.id.startsWith('foundation_'))
    for (const enemy of foundation) {
      expect(enemy.stats.maxHp).toBeGreaterThan(0)
      expect(enemy.stats.attack).toBeGreaterThan(0)
      expect(enemy.stats.attackSpeed).toBeGreaterThanOrEqual(0.8)
      expect(enemy.stats.attackSpeed).toBeLessThanOrEqual(2.5)
    }
  })

  it('enemy foundation tầng cao có stat cao hơn tầng thấp', () => {
    const t1 = ENEMIES.find((enemy) => enemy.id === 'foundation_wood_ape')!
    const t10 = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_mist_shark')!
    expect(t10.stats.maxHp).toBeGreaterThan(t1.stats.maxHp)
    expect(t10.stats.attack).toBeGreaterThan(t1.stats.attack)
  })
})
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npm.cmd run test -- src/data/enemy/Enemies.test.ts`
Expected: FAIL (enemy `foundation_*` chưa tồn tại).

- [ ] **Step 3: Implement — thêm 20 enemy vào `ENEMY_DEFINITIONS`**

Thêm helper `foundationBeast` (cục bộ, trước mảng, không export) để tránh lặp công thức:

```ts
function foundationBeast(params: {
  id: string
  name: string
  t: number
  lane: 'ground' | 'air'
  archetype?: 'melee' | 'ranged' | 'caster'
  bossEligible: boolean
  element: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
  power: number
  resistance: number
}) {
  const hp = Math.round(450 * 1.2 ** (params.t - 1))
  const atk = Math.round(42 * 1.15 ** (params.t - 1))
  const armor = 18 + 2 * params.t

  const mult = params.bossEligible
    ? { hp: 1.6, atk: 1.4, armor: 1.3, insight: 2.5, stone: 6 }
    : { hp: 1, atk: 1, armor: 1, insight: 1, stone: 1 }

  const insight = 40 + 6 * params.t
  const stone = 8 + 2 * params.t

  return defineEnemy({
    id: params.id,
    name: params.name,
    level: params.t,
    realmId: 'foundation_establishment',
    lane: params.lane,
    archetype: params.archetype,
    statsInput: {
      maxHp: Math.round(hp * mult.hp),
      attack: Math.round(atk * mult.atk),
      attackSpeed: 4,
      movementSpeed: 1.6,
      attackRangeRanks: params.archetype === 'melee' ? 1 : 5,
      criticalRate: 0.08,
      criticalDamage: 2,
      armor: Math.round(armor * mult.armor),
      evasionRate: 20,
      resistances: { [params.element]: params.resistance },
      elemental: { element: params.element, power: params.power },
    },
    rewards: {
      techniqueInsight: Math.round(insight * mult.insight),
      spiritStone: Math.round(stone * mult.stone),
      itemDrops: params.bossEligible
        ? [{ kind: 'material' as const, itemId: 'qi_refining_ore_hoang', amount: 1, chance: 0.3 }]
        : undefined,
    },
    bossRewards: params.bossEligible
      ? {
          techniqueInsight: Math.round(insight * 12.5),
          spiritStone: Math.round(stone * 15),
          itemDrops: [
            { kind: 'equipment' as const, itemId: 'base_kiem', chance: params.t === 10 ? 0.5 : 0.4 },
          ],
        }
      : undefined,
    eliteRewards: params.bossEligible
      ? {
          techniqueInsight: Math.round(insight * 5),
          spiritStone: Math.round(stone * 6),
        }
      : undefined,
  })
}
```

Khai mảng `FOUNDATION_ENEMIES` (đặt trước `const ENEMY_DEFINITIONS` hoặc sau rồi spread vào). Ví dụ 2 loài đầu:

```ts
const FOUNDATION_ENEMIES: Enemy[] = [
  foundationBeast({
    id: 'foundation_wood_ape',
    name: 'Viêm Giáp Viên',
    t: 1,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'wood',
    power: 10,
    resistance: 10,
  }),
  foundationBeast({
    id: 'foundation_stone_fungus',
    name: 'Địa Tinh Giám',
    t: 1,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: true,
    element: 'wood',
    power: 10,
    resistance: 12,
  }),
  // ... 18 loài còn lại theo bảng (T tăng dần theo cặp,
  // Hành Mộc→Hỏa→Thổ→Kim→Thủy, tầng chẵn tiền tố "Hung ").
]
```

Nối vào cuối `ENEMY_DEFINITIONS`:

```ts
const ENEMY_DEFINITIONS: Enemy[] = [
  // ... tất cả enemy hiện có ...
  ...FOUNDATION_ENEMIES,
]
```

**Element/resistance theo bảng:** t1-2 wood 10/12 (thường/boss), t3-4 fire 11/14, t5-6 earth 12/16, t7-8 metal 12/16, t9-10 water 14/20.

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npm.cmd run test -- src/data/enemy/Enemies.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add game/src/data/enemy/Enemies.ts game/src/data/enemy/Enemies.test.ts
git commit -m "feat(foundation): add 10 foundation realm enemies + tests"
```

---

### Task 2: Boss `foundation_floor_10` 2-phase + enrage

**Files:**
- Modify: `game/src/data/enemy/Enemies.ts` (thêm phase/enrage cho boss tầng 10)
- Test: `game/src/data/enemy/Enemies.test.ts` (mở rộng)

**Interfaces:**
- Consumes: helper `foundationBeast` từ Task 1; type `TribulationPhase`, `BossEnrage` từ `game/src/core/enemy/TribulationPhase.ts`; `Buff` từ `game/src/core/buff/Buff.ts`.
- Produces: boss `foundation_ferocious_flood_dragon_whelp` có `tribulationPhases` (2 phase) + `enrage`.

**Thiết kế boss:**
- Phase 1 `hpThresholdPercent: 0.5`: `+attack 30%` + `+attackSpeed 10%`.
- Phase 2 `hpThresholdPercent: 0.25`: `+attack 25%` + `+criticalRate 15%`.
- `enrage`: `afterSeconds: 60`, `+attack 50%` + `+attackSpeed 20%` (DPS check — đúng spec §4.1).

**Thay đổi helper:** thêm 2 tham số optional `tribulationPhases?: TribulationPhase[]` và `enrage?: BossEnrage`, truyền vào `defineEnemy`.

```ts
function foundationBeast(params: {
  // ...các field Task 1...
  tribulationPhases?: TribulationPhase[]
  enrage?: BossEnrage
}) {
  // ...
  return defineEnemy({
    // ...
    tribulationPhases: params.tribulationPhases,
    enrage: params.enrage,
  })
}
```

Định nghĩa phase/enrage (đặt trước mảng FOUNDATION_ENEMIES):

```ts
const FLOOD_DRAGON_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.5,
    buff: {
      id: 'foundation_dragon_phase1',
      name: 'Giao Sủng Cuồng Nộ',
      description: 'Giao Sủng bộc phát sát khí khi mất nửa máu.',
      category: 'buff',
      stacks: 1,
      stackMode: 'replace',
      modifiers: [
        { id: 'foundation_dragon_phase1_attack', sourceId: 'foundation_dragon_phase1', sourceType: 'buff', stat: 'attack', percent: 0.3 },
        { id: 'foundation_dragon_phase1_speed', sourceId: 'foundation_dragon_phase1', sourceType: 'buff', stat: 'attackSpeed', percent: 0.1 },
      ],
    },
    message: 'Giao Sủng cuồng nộ — lôi kích bùng nổ!',
  },
  {
    hpThresholdPercent: 0.25,
    buff: {
      id: 'foundation_dragon_phase2',
      name: 'Giao Sủng Tuyệt Mệnh',
      description: 'Giao Sủng liều mạng tăng sát thương.',
      category: 'buff',
      stacks: 1,
      stackMode: 'replace',
      modifiers: [
        { id: 'foundation_dragon_phase2_attack', sourceId: 'foundation_dragon_phase2', sourceType: 'buff', stat: 'attack', percent: 0.25 },
        { id: 'foundation_dragon_phase2_crit', sourceId: 'foundation_dragon_phase2', sourceType: 'buff', stat: 'criticalRate', percent: 0.15 },
      ],
    },
    message: 'Giao Sủng tuyệt mệnh phản công!',
  },
]

const FLOOD_DRAGON_ENRAGE: BossEnrage = {
  afterSeconds: 60,
  buff: {
    id: 'foundation_dragon_enrage',
    name: 'Đại Vương Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Giao Sủng điên cuồng.',
    category: 'buff',
    stacks: 1,
    stackMode: 'replace',
    modifiers: [
      { id: 'foundation_dragon_enrage_attack', sourceId: 'foundation_dragon_enrage', sourceType: 'buff', stat: 'attack', percent: 0.5 },
      { id: 'foundation_dragon_enrage_speed', sourceId: 'foundation_dragon_enrage', sourceType: 'buff', stat: 'attackSpeed', percent: 0.2 },
    ],
  },
}
```

Sửa lời gọi helper cho boss tầng 10 (trong Task 1) thành:

```ts
foundationBeast({
  id: 'foundation_ferocious_flood_dragon_whelp',
  name: 'Hung Giao Sủng',
  t: 10,
  lane: 'ground',
  archetype: 'caster',
  bossEligible: true,
  element: 'water',
  power: 14,
  resistance: 20,
  tribulationPhases: FLOOD_DRAGON_PHASES,
  enrage: FLOOD_DRAGON_ENRAGE,
}),
```

- [ ] **Step 1: Viết test thất bại trước**

Thêm vào `game/src/data/enemy/Enemies.test.ts`:

```ts
describe('foundation_floor_10 boss', () => {
  it('boss tầng 10 có 2 phase + enrage', () => {
    const boss = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_flood_dragon_whelp')!
    expect(boss.tribulationPhases).toHaveLength(2)
    expect(boss.enrage).toBeDefined()
    expect(boss.enrage!.afterSeconds).toBe(60)
  })

  it('phase boss sắp XUỐNG DẦN theo hpThresholdPercent', () => {
    const boss = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_flood_dragon_whelp')!
    const thresholds = boss.tribulationPhases!.map((phase) => phase.hpThresholdPercent)
    expect(thresholds).toEqual([...thresholds].sort((a, b) => b - a))
  })

  it('boss tầng 10 mạnh hơn boss tầng 9', () => {
    const t9 = ENEMIES.find((enemy) => enemy.id === 'foundation_flood_dragon_whelp')!
    const t10 = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_flood_dragon_whelp')!
    expect(t10.stats.maxHp).toBeGreaterThan(t9.stats.maxHp)
    expect(t10.stats.attack).toBeGreaterThan(t9.stats.attack)
  })
})
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npm.cmd run test -- src/data/enemy/Enemies.test.ts`
Expected: FAIL (`tribulationPhases` undefined).

- [ ] **Step 3: Implement**

Áp dụng thay đổi mô tả trên (thêm tham số optional vào helper, 2 const phase/enrage, sửa lời gọi boss tầng 10).

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npm.cmd run test -- src/data/enemy/Enemies.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add game/src/data/enemy/Enemies.ts game/src/data/enemy/Enemies.test.ts
git commit -m "feat(foundation): add floor-10 boss with 2-phase + enrage"
```

---

### Task 3: 10 stage Trúc Cơ authored tường minh (bỏ clone)

**Files:**
- Modify: `game/src/data/stage/Stages.ts` (thay block `foundationStages` clone-map bằng 10 stage authored)
- Test: `game/src/data/stage/Stages.test.ts` (mở rộng)

**Interfaces:**
- Consumes: `Stage` type; enemy id từ Task 1; `STAGES` export.
- Produces: 10 stage `foundation_floor_1..10` — `chapter: 3`, `floor: 1..10`, `requiredRealmId: 'foundation_establishment'`, `requiredRealmLevel` theo tầng, enemyPool riêng, boss stage 10.

**Bảng stage:**

| floor | id | name | enemyPool (thường w5 / boss w3 elite 0.1) | bossEnemyId |
|---|---|---|---|---|
| 1 | `foundation_floor_1` | Màn 3.1 | wood_ape / stone_fungus | stone_fungus |
| 2 | `foundation_floor_2` | Màn 3.2 | ferocious_wood_ape / ferocious_stone_fungus | ferocious_stone_fungus |
| 3 | `foundation_floor_3` | Màn 3.3 | lava_hound / sand_scorpion | sand_scorpion |
| 4 | `foundation_floor_4` | Màn 3.4 | ferocious_lava_hound / ferocious_sand_scorpion | ferocious_sand_scorpion |
| 5 | `foundation_floor_5` | Màn 3.5 | rock_tortoise / mud_golem | mud_golem |
| 6 | `foundation_floor_6` | Màn 3.6 | ferocious_rock_tortoise / ferocious_mud_golem | ferocious_mud_golem |
| 7 | `foundation_floor_7` | Màn 3.7 | metal_beetle_swarm / blade_hawk_king | blade_hawk_king |
| 8 | `foundation_floor_8` | Màn 3.8 | ferocious_metal_beetle_swarm / ferocious_blade_hawk_king | ferocious_blade_hawk_king |
| 9 | `foundation_floor_9` | Màn 3.9 | mist_shark / flood_dragon_whelp | flood_dragon_whelp |
| 10 | `foundation_floor_10` | Màn 3.10 | ferocious_mist_shark / ferocious_flood_dragon_whelp | ferocious_flood_dragon_whelp |

- `name` giữ "Màn 3.N" (StageSelectPanel hiển thị). Mỗi stage có description flavor riêng.
- `totalEnemyCount = 10 + floor - 1` (10→19), `spawnIntervalSeconds: 3`, `requiredRealmLevel: floor`.
- Gate thật qua thứ tự `zone.stageIds` (Zones.ts không đổi).

Thay toàn bộ block `foundationStages` (comment "temporarily reuses" + map) bằng:

```ts
// Trúc Cơ (2026-08-29) — 10 stage authored tường minh (bỏ clone Luyện
// Khí). Ngũ Hành Tương Sinh Mộc(1-2)->Hỏa(3-4)->Thổ(5-6)->Kim(7-8)->
// Thủy(9-10). Quái `foundation_*` xem data/enemy/Enemies.ts. Stage 10
// có boss 2-phase + enrage (`foundation_ferocious_flood_dragon_whelp`).
const foundationStages: Stage[] = [
  {
    id: 'foundation_floor_1',
    name: 'Màn 3.1',
    description: 'Hậu sơn Thanh Vân, yêu thú gỗ quấn quanh tán cổ thụ — chặng thử thách đầu tiên cho tu sĩ Trúc Cơ.',
    requiredRealmId: 'foundation_establishment',
    requiredRealmLevel: 1,
    enemyPool: [
      { enemyId: 'foundation_wood_ape', weight: 5 },
      { enemyId: 'foundation_stone_fungus', weight: 3, eliteChance: 0.1 },
    ],
    totalEnemyCount: 10,
    spawnIntervalSeconds: 3,
    bossEnemyId: 'foundation_stone_fungus',
  },
  // ... floor 2-10 theo bảng ...
]
```

`export const STAGES: Stage[] = [...normalizedStages, ...foundationStages]` giữ nguyên.

- [ ] **Step 1: Viết test thất bại trước**

Mở rộng `game/src/data/stage/Stages.test.ts`:

```ts
import { ENEMIES } from '../enemy/Enemies'

describe('foundation stages', () => {
  it('stage chương 3 không còn clone enemy pool chương 2', () => {
    const foundation = STAGES.filter((stage) => stage.chapter === 3)
    const qi = STAGES.filter((stage) => stage.chapter === 2)
    const foundationIds = new Set(foundation.flatMap((stage) => [
      ...stage.enemyPool.map((entry) => entry.enemyId),
      stage.bossEnemyId ?? '',
    ]))
    const qiIds = new Set(qi.flatMap((stage) => [
      ...stage.enemyPool.map((entry) => entry.enemyId),
      stage.bossEnemyId ?? '',
    ]))
    for (const id of foundationIds) {
      expect(qiIds.has(id)).toBe(false)
    }
  })

  it('mọi enemyId/bossEnemyId của chương 3 tồn tại trong ENEMIES', () => {
    const ids = new Set(ENEMIES.map((enemy) => enemy.id))
    for (const stage of STAGES.filter((s) => s.chapter === 3)) {
      for (const entry of stage.enemyPool) {
        expect(ids.has(entry.enemyId)).toBe(true)
      }
      if (stage.bossEnemyId) expect(ids.has(stage.bossEnemyId)).toBe(true)
    }
  })

  it('stage chương 3 mỗi tầng có requiredRealmLevel bằng floor', () => {
    for (const stage of STAGES.filter((s) => s.chapter === 3)) {
      expect(stage.requiredRealmLevel).toBe(stage.floor)
    }
  })

  it('foundation_floor_10 có boss đúng', () => {
    const boss = STAGES.find((stage) => stage.id === 'foundation_floor_10')!
    expect(boss.bossEnemyId).toBe('foundation_ferocious_flood_dragon_whelp')
  })
})
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npm.cmd run test -- src/data/stage/Stages.test.ts`
Expected: FAIL (test "không còn clone" — hiện chapter 3 dùng enemy chapter 2; test enemy tồn tại FAIL vì chapter 3 chưa có `foundation_*`).

- [ ] **Step 3: Implement — thay block `foundationStages`**

Thay toàn bộ block `foundationStages` bằng mảng 10 stage authored ở trên.

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npm.cmd run test -- src/data/stage/Stages.test.ts`
Expected: PASS. Test hiện có "tăng tuyến tính số quái" vẫn pass (mỗi chapter 10 stage, totalEnemyCount 10..19).

- [ ] **Step 5: Commit**

```bash
git add game/src/data/stage/Stages.ts game/src/data/stage/Stages.test.ts
git commit -m "feat(foundation): author 10 real foundation stages (drop qi clone)"
```

---

### Task 4: 5 quest Trúc Cơ mới

**Files:**
- Modify: `game/src/data/quest/quests.ts` (thêm 5 quest)
- Test: `game/src/data/quest/quests.test.ts` (file mới)

**Interfaces:**
- Consumes: `Quest` type (`game/src/core/quest/Quest.ts`); enemy id từ Task 1; material `qi_refining_ore_hoang` (tồn tại).
- Produces: 5 quest `once`, có `requiredRealmId: 'foundation_establishment'`.

**Ghi chú equipment:** spec §4.3 muốn quest thưởng equipment lần đầu, nhưng `QuestItemReward` chỉ hỗ trợ `kind: 'material' | 'pill'` (không có `equipment`). GLOBAL CONSTRAINT: không đổi `QuestItemReward` để tránh mở rộng scope → quest thưởng tài nguyên (spiritStone/techniqueInsight/cultivation). Equipment lần đầu dời sau, ghi chú trong guide.

**Bảng quest:**

| id | name | condition | reward | requiredRealmId |
|---|---|---|---|---|
| `kill_foundation_stone_fungus_15` | Diệt Địa Tinh Giám | kill `foundation_stone_fungus`, 15 | techniqueInsight 120 | foundation_establishment |
| `kill_foundation_floor_10_boss_1` | Chinh Phục Hậu Sơn | kill `foundation_ferocious_flood_dragon_whelp`, 1 | spiritStone 800 | foundation_establishment |
| `collect_foundation_ore_30` | Thu Thập Linh Khoáng Hậu Sơn | collect `qi_refining_ore_hoang`, 30 | cultivation 4000 | foundation_establishment |
| `kill_foundation_flood_dragon_whelp_10` | Diệt Giao Sủng | kill `foundation_flood_dragon_whelp`, 10 | techniqueInsight 200 | foundation_establishment |
| `kill_foundation_any_50` | Thanh Lý Yêu Thú Hậu Sơn | kill (bỏ trống enemyId), 50 | spiritStone 500 | foundation_establishment |

**Ví dụ 2 quest:**

```ts
{
  id: 'kill_foundation_stone_fungus_15',
  name: 'Diệt Địa Tinh Giám',
  description: 'Yêu thú Địa Tinh Giám quấy phá hậu sơn Thanh Vân — diệt 15 con.',
  condition: { kind: 'kill', enemyId: 'foundation_stone_fungus', amount: 15 },
  reward: { reward: { techniqueInsight: 120 } },
  cadence: 'once',
  requiredRealmId: 'foundation_establishment',
},
{
  id: 'kill_foundation_floor_10_boss_1',
  name: 'Chinh Phục Hậu Sơn',
  description: 'Đánh bại Giao Sủng hung hãn nơi đáy hậu sơn — trùm cuối Trúc Cơ.',
  condition: { kind: 'kill', enemyId: 'foundation_ferocious_flood_dragon_whelp', amount: 1 },
  reward: { reward: { spiritStone: 800 } },
  cadence: 'once',
  requiredRealmId: 'foundation_establishment',
},
```

**Lưu ý kill quest:** QuestSystem `onKill` chỉ increment đúng `enemyId` khớp. Boss spawn qua `createBossVariant()` giữ nguyên `enemy.id` gốc → quest `kill_foundation_ferocious_flood_dragon_whelp` đếm đúng khi đánh boss tầng 10 (bản thường cùng id cũng đếm — chấp nhận, spec không yêu cầu phân biệt boss/non-boss).

- [ ] **Step 1: Viết test thất bại trước**

Tạo `game/src/data/quest/quests.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { ENEMIES } from '../enemy/Enemies'

describe('foundation quests', () => {
  it('có đúng 5 quest Trúc Cơ', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    expect(foundation).toHaveLength(5)
  })

  it('mọi kill quest tham chiếu enemy tồn tại', () => {
    const ids = new Set(ENEMIES.map((enemy) => enemy.id))
    for (const quest of QUESTS) {
      if (quest.condition.kind === 'kill' && quest.condition.enemyId) {
        expect(ids.has(quest.condition.enemyId)).toBe(true)
      }
    }
  })

  it('quest Trúc Cơ không có id trùng', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    const ids = foundation.map((quest) => quest.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npm.cmd run test -- src/data/quest/quests.test.ts`
Expected: FAIL (0 quest foundation).

- [ ] **Step 3: Implement — thêm 5 quest**

Thêm 5 entry vào mảng `QUESTS` trong `game/src/data/quest/quests.ts` theo bảng, tất cả `cadence: 'once'`, `requiredRealmId: 'foundation_establishment'`.

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npm.cmd run test -- src/data/quest/quests.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add game/src/data/quest/quests.ts game/src/data/quest/quests.test.ts
git commit -m "feat(foundation): add 5 foundation quests + data integrity tests"
```

---

### Task 5: Cập nhật game-guide.md

**Files:**
- Modify: `game/docs/game-guide.md` (mục Tu luyện/Cảnh giới — phần Trúc Cơ)

**Interfaces:**
- Consumes: nội dung đã implement ở Task 1-4.

- [ ] **Step 1: Đọc guide hiện tại**

Run: `Select-String -Path "game\docs\game-guide.md" -Pattern "Trúc Cơ|Thanh Vân|Màn 3"`

- [ ] **Step 2: Cập nhật**

Sửa mô tả cho khớp hiện thực:
- Chương 3 (Trúc Cơ) giờ có 10 stage authored riêng với quái `foundation_*`, không còn clone Luyện Khí.
- Boss chương 3 (`Giao Sủng Hung`) có 2-phase + enrage sau 60 giây.
- Thêm 5 quest Trúc Cơ (`requiredRealmId: 'foundation_establishment'`).
- **Ghi rõ giới hạn scope:** progression dừng ở Trúc Cơ tầng 18; Kim Đan chưa mở trong version này (khớp yêu cầu người dùng).

- [ ] **Step 3: Chạy type-check**

Run: `npm.cmd run type-check` từ `game/` — đảm bảo không có gì vỡ.

- [ ] **Step 4: Commit**

```bash
git add game/docs/game-guide.md
git commit -m "docs: update guide for real foundation content (scope ends at truc co 18)"
```

---

### Task 6: Verify toàn cục + cập nhật roadmap

**Files:**
- Modify: `game/docs/roadmap.md`

**Interfaces:**
- Consumes: mọi thay đổi Task 1-5.

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm.cmd run test` từ `game/`
Expected: PASS (toàn bộ suite, gồm `Stages.test.ts`, `Enemies.test.ts`, `quests.test.ts` mới).

- [ ] **Step 2: Type-check**

Run: `npm.cmd run type-check` từ `game/`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm.cmd run build` từ `game/`
Expected: PASS.

- [ ] **Step 4: Cập nhật roadmap**

Trong `game/docs/roadmap.md`, mục Phase 1 — dòng "Nội dung Trúc Cơ thật + pass Kim Đan tối thiểu" đổi trạng thái thành:
`🟡 M1 xong (2026-08-29) — 10 stage Trúc Cơ thật + 20 enemy + boss 2-phase/enrage + 5 quest; M2 gate Kim Đan / M3 đời sống Kim Đan giữ cho version sau (yêu cầu người dùng)`.

- [ ] **Step 5: Commit**

```bash
git add game/docs/roadmap.md
git commit -m "docs(roadmap): mark foundation M1 done, scope ends at truc co 18"
```

---

## Self-Review

**1. Spec coverage (mục 4 truc-co-kim-dan-content-plan.md):**
- §4.1 5-6 loài quái Trúc Cơ → Task 1 (10 loài, phủ dư); boss có phase + enrage → Task 2. ✅
- §4.2 stage chương 3 thật, giữ id `foundation_floor_1..10`, xóa comment "temporarily reuses" → Task 3. ✅
- §4.3 quest 3-5 quest → Task 4 (5 quest). Ghi chú: `QuestItemReward` chỉ hỗ trợ `material | pill` — equipment không nằm trong type; để giữ scope, quest thưởng tài nguyên, equipment lần đầu dời sau. Đã ghi rõ trong plan.
- §4.4 kiểm chứng M1 → Task 3 test "không clone chương 2" + "enemy tồn tại"; Task 6 verify. ✅

**2. Placeholder scan:** Không có TBD/TODO. Chỗ duy nhất cần quyết định (equipment quest reward) đã ghi rõ lý do + hướng xử lý. ✅

**3. Type consistency:**
- `foundationBeast` helper: Task 1 không có `tribulationPhases`/`enrage`; Task 2 thêm optional — Task 1 không vỡ (optional). ✅
- Id boss xuyên suốt `foundation_ferocious_flood_dragon_whelp` (Task 2 data, Task 3 stage 10, Task 4 quest) — nhất quán. ✅
- Import `ENEMIES` trong `Stages.test.ts` dùng top-level import ESM (không dùng `require`) — nhất quán codebase ESM. ✅

**Lưu ý rủi ro (không chặn):**
- Công thức stat first pass — playtest chỉnh sau (spec đồng ý).
- Enemy mới dùng art mortal + tint/đổi tên tạm (spec §3.2 cho phép ở M1; art thật vào sau).
- Quái `foundation_*` rơi `qi_refining_ore_hoang` — vì M1 không có vật liệu realm 4 (đúng yêu cầu), đây vẫn là sink thật.
- `kill_foundation_any_50` (enemyId bỏ trống) đếm mọi quái — đúng pattern `QuestSystem.onKill` (enemyId optional).
