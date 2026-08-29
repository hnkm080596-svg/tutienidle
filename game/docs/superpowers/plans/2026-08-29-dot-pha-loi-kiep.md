# Hệ Đột Phá / Bậc Ẩn / Lôi Kiếp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế toàn bộ hệ Độ Kiếp hiện tại bằng framework 3 địa giới: bậc ẩn mỗi gate (Kiến Cơ 4 bậc + Đại Đạo Trúc Cơ mất vĩnh viễn khi thua), hệ Kỳ Kinh Bát Mạch + quái ẩn + 2 đan alchemy mới, và TribulationDirector mới (chương kiếp: Tâm Ma minigame hỏi đáp + tank lôi, không quái Kiếp, bỏ Đột Phá Lệnh).

**Architecture:** 3 lớp độc lập: (1) `BreakthroughGrades` resolver data-driven xét bậc lúc bấm đột phá, (2) `MeridianSystem` (Bát Mạch) + quái ẩn window 1000 kill + 2 recipe alchemy — tiền điều kiện bậc, (3) `TribulationDirector` + chapter profiles + mind-question bank thay TribulationSystem/BattleSystem-mode-tribulation. UI: TribulationScene (Phaser) + overlay Vue mở rộng.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Phaser + Vitest (không dependency mới).

**Spec:** `game/docs/superpowers/specs/2026-08-29-dot-pha-loi-kiep-design.md` — plan lập từ spec này, mọi quyết định thiết kế nằm trong spec.

## Global Constraints

- Mọi lệnh chạy từ `game/` (worktree `.agent-worktrees/dot-pha-loi-kiep`): `npm.cmd run test`, `npm.cmd run type-check`, `npm.cmd run build`.
- KHÔNG dùng `any`. KHÔNG thêm dependency. KHÔNG sửa file ngoài scope task.
- Mana chỉ thuộc Pháp Tu: passive Bát Mạch KHÔNG chạm maxMp/manaRegenPerSecond (chỉ HP/def/attack/crit/main stat/tốc tu).
- Điều kiện bậc KHÔNG hiển thị trước trong UI (chỉ công bố kết quả sau đột phá; flavor hint riêng theo §4.2 spec).
- Số liệu first-pass đánh dấu playtest — KHÔNG tự đổi khi implement.
- Save version bump 53 → 54 một lần duy nhất (Task 10); dev phase không migration.
- Tiếng Việt cho mọi UI copy/comment theo convention codebase.
- Test chạy từng file khi phát triển (`npx.cmd vitest run <path>`), full suite ở task cuối.
- TỔNG kill window quái ẩn: 999 → không eligible; 1000 → eligible; giết quái ẩn → reset 0 (kể cả khi quái ẩn không drop).
- Thua kiếp Đại Đạo → `greatDaoOpportunityLost = true` VĨNH VIỄN (chỉ set, không bao giờ clear).

---

### Task 1: PlayerData fields mới + MeridianSystem (Bát Mạch)

**Files:**
- Modify: `src/core/player/Player.ts` (thêm 4 fields + defaults vào PlayerData + createDefaultPlayer)
- Create: `src/data/realm/Meridians.ts`
- Create: `src/core/realm/MeridianSystem.ts`
- Test: `src/core/realm/MeridianSystem.test.ts`

**Interfaces:**
- Consumes: `PlayerData` (`src/core/player/Player.ts`), `StatModifier` (`src/core/stats/StatCalculator.ts`), pattern `BodyRefinementSystem.ts`.
- Produces:
  - `MERIDIANS: readonly MeridianDefinition[]` (data, 9 entries theo thứ tự Nhâm→Đới→Âm Kiều→Âm Duy→Dương Duy→Dương Kiều→Xung→Đốc→Kỳ Kinh Thiên Địa Chi Kiều)
  - `interface MeridianDefinition { id: string; name: string; description: string; requiredRealmLevel: number; thongMachDanCost: number; requiresThienDiaChiKieu?: boolean; stats: StatType[]; percentAtFullTier: number; }`
  - `investThongMachDan(player: PlayerData, availableAmount: number): number` — tuần tự, trả số đan thật tiêu
  - `applyMeridianModifiers(player: PlayerData): void` — rebuild modifiers (id prefix `bat-mach:`)
  - `getOpenedMeridianCount(player: PlayerData): number`
  - PlayerData fields: `openedMeridianIds: string[]`, `luyenKhiKillsSinceBeast: number`, `mortalPerfectionAchieved: boolean`, `greatDaoOpportunityLost: boolean`

- [ ] **Step 1: Viết test fail**

`src/core/realm/MeridianSystem.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { MERIDIANS, THONG_MACH_DAN_MATERIAL_ID, THIEN_DIA_CHI_KIEU_MATERIAL_ID } from '../../data/realm/Meridians'
import { investThongMachDan, getOpenedMeridianCount, applyMeridianModifiers } from './MeridianSystem'

function createLuyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 18
  return player
}

describe('MeridianSystem — Bát Mạch (spec dot-pha-loi-kiep §4.1a)', () => {
  it('data: 9 đường đúng thứ tự Nhâm → Đốc + Kỳ Kinh tầng 18, cost tăng dần, KHÔNG chạm mana', () => {
    expect(MERIDIANS.map((m) => m.id)).toEqual([
      'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
      'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach', 'ky_kinh_thien_dia_chi_kieu',
    ])
    expect(MERIDIANS[0]!.requiredRealmLevel).toBe(2)
    expect(MERIDIANS[7]!.requiredRealmLevel).toBe(16)
    expect(MERIDIANS[8]!.requiredRealmLevel).toBe(18)
    expect(MERIDIANS[8]!.requiresThienDiaChiKieu).toBe(true)
    // mana bị cấm (Global Constraint) — maxMp/manaRegenPerSecond không được xuất hiện
    const allStats = MERIDIANS.flatMap((m) => m.stats)
    expect(allStats).not.toContain('maxMp')
    expect(allStats).not.toContain('manaRegenPerSecond')
  })

  it('tuần tự: đường 2 không mở khi chưa đủ đường 1 (đủ đan + đủ tầng)', () => {
    const player = createLuyenKhiPlayer()
    player.openedMeridianIds = []
    const consumed = investThongMachDan(player, 10)
    // không có đường nào mở trước tiên -> đường 1 (Nhâm) cost 1
    expect(consumed).toBe(1)
    expect(player.openedMeridianIds).toEqual(['nham_mach'])
  })

  it('gate tầng: đứng tầng 3 (Luyện Khí) không đầu tư đường 2 (mở tầng 4)', () => {
    const player = createLuyenKhiPlayer()
    player.realmLevel = 3
    player.openedMeridianIds = ['nham_mach']
    expect(investThongMachDan(player, 10)).toBe(0)
    expect(player.openedMeridianIds).toEqual(['nham_mach'])
  })

  it('Kỳ Kinh (đường 9) cần cả Thông Mạch Đan lẫn Thiên Địa Chi Kiều', () => {
    const player = createLuyenKhiPlayer()
    player.openedMeridianIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    // có 40 đan nhưng KHÔNG có Thiên Địa Chi Kiều -> không mở
    const consumed = investThongMachDan(player, 40)
    expect(consumed).toBe(0)
    expect(player.openedMeridianIds).toHaveLength(8)
  })

  it('đủ 9/9: mở Kỳ Kinh khi có cả 2 nguyên liệu, passive áp đủ 9 đường', () => {
    const player = createLuyenKhiPlayer()
    player.openedMeridianIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    // hàm nhận số đan + số Thiên Địa Chi Kiều qua 2 tham số riêng
    const consumed = investThongMachDan(player, 40, 1)
    expect(consumed).toBe(40)
    expect(player.openedMeridianIds).toHaveLength(9)
    applyMeridianModifiers(player)
    expect(player.modifiers.filter((m) => m.id.startsWith('bat-mach:')).length).toBe(
      MERIDIANS.reduce((sum, m) => sum + m.stats.length, 0),
    )
  })

  it('rời Luyện Khí (đã vào Trúc Cơ): vẫn được tiêu nốt đan dở (pattern Luyện Th thể)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.openedMeridianIds = ['nham_mach']
    const consumed = investThongMachDan(player, 5)
    expect(consumed).toBe(2) // Đới Mạch cost 2
    expect(getOpenedMeridianCount(player)).toBe(2)
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/core/realm/MeridianSystem.test.ts`
Expected: FAIL — cannot resolve `../../data/realm/Meridians` / `./MeridianSystem`.

- [ ] **Step 3: Implement**

`src/data/realm/Meridians.ts`:

```ts
import type { StatType } from '../../core/stats/StatTypes'

// Kỳ Kinh Bát Mạch (spec dot-pha-loi-kiep §4.1a) — hệ song song Luyện
// Th thể, độc quyền Luyện Khí. 8 đường mở mỗi 2 tầng (2/4/.../16),
// Kỳ Kinh Thiên Địa Chi Kiều mở tầng 18. Passive KHÔNG chạm mana
// (mana chỉ thuộc Pháp Tu — Global Constraint spec).
export const THONG_MACH_DAN_MATERIAL_ID = 'thong_mach_dan'
export const THIEN_DIA_CHI_KIEU_MATERIAL_ID = 'thien_dia_chi_kieu'

export interface MeridianDefinition {
  id: string
  name: string
  description: string
  requiredRealmLevel: number
  thongMachDanCost: number
  requiresThienDiaChiKieu?: boolean
  stats: StatType[]
  percentAtFullTier: number
}

export const MERIDIANS: readonly MeridianDefinition[] = [
  { id: 'nham_mach', name: 'Nhâm Mạch', description: 'Kinh mạch chính phía trước, nền气血 của thân thể.', requiredRealmLevel: 2, thongMachDanCost: 1, stats: ['maxHp'], percentAtFullTier: 0.05 },
  { id: 'doi_mach', name: 'Đới Mạch', description: 'Đai lưng kinh mạch, ôm trọn eo thắt.', requiredRealmLevel: 4, thongMachDanCost: 2, stats: ['defense'], percentAtFullTier: 0.05 },
  { id: 'am_kieu_mach', name: 'Âm Kiều Mạch', description: 'Kiều đạo phía âm, dẫn huyết nuôi thân.', requiredRealmLevel: 6, thongMachDanCost: 4, stats: ['hpRegenPerSecond'], percentAtFullTier: 0.08 },
  { id: 'am_duy_mach', name: 'Âm Duy Mạch', description: 'Duy trì mặt âm của toàn kinh lạc.', requiredRealmLevel: 8, thongMachDanCost: 7, stats: ['maxHp'], percentAtFullTier: 0.05 },
  { id: 'duong_duy_mach', name: 'Dương Duy Mạch', description: 'Duy trì mặt dương của toàn kinh lạc.', requiredRealmLevel: 10, thongMachDanCost: 11, stats: ['attack'], percentAtFullTier: 0.05 },
  { id: 'duong_kieu_mach', name: 'Dương Kiều Mạch', description: 'Kiều đạo phía dương, tráo_dyn uy lực tiến công.', requiredRealmLevel: 12, thongMachDanCost: 16, stats: ['criticalRate'], percentAtFullTier: 0.04 },
  { id: 'xung_mach', name: 'Xung Mạch', description: 'Hải huyết chi mạch — kho huyết lớn của thân.', requiredRealmLevel: 14, thongMachDanCost: 22, stats: ['maxHp'], percentAtFullTier: 0.08 },
  { id: 'doc_mach', name: 'Đốc Mạch', description: 'Kinh mạch chính phía sau, trụ cột của đạo.', requiredRealmLevel: 16, thongMachDanCost: 30, stats: ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'], percentAtFullTier: 0.05 },
  { id: 'ky_kinh_thien_dia_chi_kieu', name: 'Kỳ Kinh — Thiên Địa Chi Kiều', description: 'Cửa kiều nối trời đất, đỉnh của bát mạch.', requiredRealmLevel: 18, thongMachDanCost: 40, requiresThienDiaChiKieu: true, stats: ['maxHp', 'hpRegenPerSecond'], percentAtFullTier: 0.1 },
]
```

(Không dùng ký tự tiếng Trung trong description — sửa "nền气血" thành "nền huyết khí", "tráo_dyn" thành "táo bạo" khi viết file thật — giữ copy thuần Việt.)

`src/core/realm/MeridianSystem.ts`:

```ts
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import { MERIDIANS } from '../../data/realm/Meridians'

// Bát Mạch không có progress từng phần như Luyện Th thể — mỗi đường
// chỉ CHƯA MỞ / ĐÃ MỞ (đủ nguyên liệu là thông hoàn toàn). Tuần tự
// bắt buộc: đường N cần đủ N-1 trong openedMeridianIds.
function nextMeridian(player: PlayerData) {
  return MERIDIANS[player.openedMeridianIds.length]
}

export function getOpenedMeridianCount(player: PlayerData): number {
  return player.openedMeridianIds.length
}

function modifierId(meridianId: string, stat: string): string {
  return `bat-mach:${meridianId}:${stat}`
}

export function applyMeridianModifiers(player: PlayerData): void {
  const opened = new Set(player.openedMeridianIds)
  const rebuilt: StatModifier[] = []

  for (const meridian of MERIDIANS) {
    if (!opened.has(meridian.id)) continue
    for (const stat of meridian.stats) {
      rebuilt.push({
        id: modifierId(meridian.id, stat),
        sourceId: meridian.id,
        sourceType: 'realm',
        stat,
        percent: meridian.percentAtFullTier,
      })
    }
  }

  player.modifiers = player.modifiers.filter((m) => !m.id.startsWith('bat-mach:'))
  player.modifiers.push(...rebuilt)
}

/**
 * Đầu tư Thông Mạch Đan vào đường kế tiếp. Trả về số đan THẬT SỰ đã
 * tiêu (0 nếu không đủ điều kiện/không còn đường). thienDiaChiKieuOwned
 * chỉ có ý nghĩa với đường cuối (Kỳ Kinh) — các đường khác bỏ qua.
 */
export function investThongMachDan(
  player: PlayerData,
  availableDan: number,
  thienDiaChiKieuOwned = 0,
): number {
  const next = nextMeridian(player)

  if (!next || availableDan < next.thongMachDanCost) {
    return 0
  }

  // Gate tầng chỉ pace tiến độ TRONG Luyện Khí (pattern
  // BodyRefinementSystem.isTierRequiredRealmLevelMet)
  if (player.realmId === 'qi_refining' && player.realmLevel < next.requiredRealmLevel) {
    return 0
  }

  if (next.requiresThienDiaChiKieu && thienDiaChiKieuOwned < 1) {
    return 0
  }

  player.openedMeridianIds.push(next.id)
  applyMeridianModifiers(player)

  return next.thongMachDanCost
}
```

`src/core/player/Player.ts` — thêm vào interface (sau `bossKillCount`, cùng khu comment Kiếm Ý):

```ts
  // Bát Mạch (spec dot-pha-loi-kiep §4.1a) — id các đường Kỳ Kinh đã
  // thông (tuần tự, xem core/realm/MeridianSystem.ts).
  openedMeridianIds: string[]

  // Quái ẩn (spec §4.1c) — đếm kill quái Luyện Khí từ lần giết quái
  // ẩn gần nhất; đủ 1000 mở cửa sổ quái ẩn trà trộn pool spawn.
  luyenKhiKillsSinceBeast: number

  // Đại Đạo Trúc Cơ (spec §4.2/§4.3) — snapshot "hoàn hảo Phàm Nhân"
  // (5/5 main stat 10/10 + Luyện Th thể 6/6) chốt lúc bấm Quán Khí.
  mortalPerfectionAchieved: boolean

  // Thua kiếp Đại Đạo → mất VĨNH VIỄN cơ hội (spec §4.3) — chỉ set,
  // không bao giờ clear. Resolver cap ở Thiên Đạo khi true.
  greatDaoOpportunityLost: boolean
```

Và vào `createDefaultPlayer()` (sau `bossKillCount: 0,`):

```ts
    openedMeridianIds: [],
    luyenKhiKillsSinceBeast: 0,
    mortalPerfectionAchieved: false,
    greatDaoOpportunityLost: false,
```

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/core/realm/MeridianSystem.test.ts`
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/core/player/Player.ts src/data/realm/Meridians.ts src/core/realm/MeridianSystem.ts src/core/realm/MeridianSystem.test.ts
git commit -m "feat(dot-pha): PlayerData fields moi + MeridianSystem — Bat Mach 9 duong tuan tu, khong cham mana"
```

---

### Task 2: Caps Luyện Th thể cấp số nhân + BreakthroughGrades resolver (4 bậc Kiến Cơ)

**Files:**
- Modify: `src/data/realm/BodyRefinement.ts` (caps mới)
- Create: `src/data/breakthrough/BreakthroughGrades.ts`
- Delete: `src/core/breakthrough/FoundationResolver.ts` + `FoundationResolver.test.ts`
- Test: `src/data/breakthrough/BreakthroughGrades.test.ts`

**Interfaces:**
- Consumes: `PlayerData` (fields Task 1), `BODY_REFINEMENT_TIERS`, `FoundationType` (`FoundationType.ts` giữ nguyên — các nơi khác còn dùng `highestFoundationAchieved`).
- Produces:
  - `type KienCoGrade = FoundationType` (alias, 'human' | 'earth' | 'heaven' | 'great_dao')
  - `interface BreakthroughGradeCondition { hasTrucCoDan?: boolean; bodyRefinementTiers?: number; openedMeridians?: number; talentPhamCot?: boolean; mortalPerfection?: boolean; luyenKhiMainStatsMaxed?: boolean }`
  - `KIEN_CO_GRADE_ORDER: readonly KienCoGrade[]` = `['great_dao', 'heaven', 'earth', 'human']` (xét từ cao xuống)
  - `resolveKienCoGrade(player: PlayerData, hasTrucCoDan: boolean): KienCoGrade`
  - `BODY_REFINEMENT_EXPONENTIAL_CAPS: readonly number[]` — tham chiếu test caps mới

- [ ] **Step 1: Viết test fail**

`src/data/breakthrough/BreakthroughGrades.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { BODY_REFINEMENT_TIERS } from '../realm/BodyRefinement'
import { resolveKienCoGrade } from './BreakthroughGrades'
import { MERIDIANS } from '../realm/Meridians'

function createReadyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  return player
}

// Helper full mọi điều kiện Đại Đào
function createGreatDaoPlayer(): PlayerData {
  const player = createReadyPlayer()
  player.realmLevel = 18
  player.selectedTalentIds = ['pham_cot']
  player.bodyRefinementCompletedTiers = 6
  player.mortalPerfectionAchieved = true
  player.openedMeridianIds = MERIDIANS.map((m) => m.id) // 9/9 gồm Kỳ Kinh
  // 5/5 main stat 30/30 (cap Luyện Khí — StatCap.ts)
  player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
  return player
}

describe('BodyRefinement caps cấp số nhân (spec §3.1)', () => {
  it('caps mới theo hệ số ×3.5 từ 50', () => {
    expect(BODY_REFINEMENT_TIERS.map((t) => t.cap)).toEqual([50, 175, 615, 2150, 7500, 26300])
  })
})

describe('resolveKienCoGrade — 4 bậc Kiến Cơ (spec §4.2)', () => {
  it('không đủ gì → Nhân Đạo (baseline)', () => {
    expect(resolveKienCoGrade(createReadyPlayer(), false)).toBe('human')
  })

  it('Địa Đạo: Trúc Cơ Đan + Luyện Th thể full 3 tầng đầu', () => {
    const player = createReadyPlayer()
    player.bodyRefinementCompletedTiers = 3
    expect(resolveKienCoGrade(player, true)).toBe('earth')
    // thiếu đan → rơi về Nhân
    expect(resolveKienCoGrade(player, false)).toBe('human')
    // chỉ 2 tầng → không đủ
    const thin = createReadyPlayer()
    thin.bodyRefinementCompletedTiers = 2
    expect(resolveKienCoGrade(thin, true)).toBe('human')
  })

  it('Thiên Đạo: đan + Luyện Th thể 6/6 + 6/8 kinh mạch', () => {
    const player = createReadyPlayer()
    player.bodyRefinementCompletedTiers = 6
    player.openedMeridianIds = MERIDIANS.slice(0, 6).map((m) => m.id)
    expect(resolveKienCoGrade(player, true)).toBe('heaven')
    // chỉ 5 đường → Địa
    const thin = createReadyPlayer()
    thin.bodyRefinementCompletedTiers = 6
    thin.openedMeridianIds = MERIDIANS.slice(0, 5).map((m) => m.id)
    expect(resolveKienCoGrade(thin, true)).toBe('earth')
  })

  it('Đại Đạo: đủ MỌI điều kiện (Kỳ Kinh 9/9 + Phàm Cốt + hoàn hảo Phàm Nhân + 30/30)', () => {
    const player = createGreatDaoPlayer()
    expect(resolveKienCoGrade(player, true)).toBe('great_dao')
  })

  it('Đại Đạo thiếu TỪNG điều kiện → rơi về Thiên', () => {
    // thiếu Kỳ Kinh (8/9)
    const noKyKinh = createGreatDaoPlayer()
    noKyKinh.openedMeridianIds = MERIDIANS.slice(0, 8).map((m) => m.id)
    expect(resolveKienCoGrade(noKyKinh, true)).toBe('heaven')
    // thiếu Phàm Cốt
    const noTalent = createGreatDaoPlayer()
    noTalent.selectedTalentIds = []
    expect(resolveKienCoGrade(noTalent, true)).toBe('heaven')
    // thiếu hoàn hảo Phàm Nhân
    const noPerfect = createGreatDaoPlayer()
    noPerfect.mortalPerfectionAchieved = false
    expect(resolveKienCoGrade(noPerfect, true)).toBe('heaven')
    // thiếu 30/30 (một stat 29)
    const noStats = createGreatDaoPlayer()
    noStats.baseStats = { ...noStats.baseStats, strength: 29 }
    expect(resolveKienCoGrade(noStats, true)).toBe('heaven')
  })

  it('greatDaoOpportunityLost: cap Thiên Đạo mọi lần xét sau (vĩnh viễn, spec §4.3)', () => {
    const player = createGreatDaoPlayer()
    player.greatDaoOpportunityLost = true
    expect(resolveKienCoGrade(player, true)).toBe('heaven')
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/data/breakthrough/BreakthroughGrades.test.ts`
Expected: FAIL — caps cũ `[50, 90, 160, 290, 520, 940]` không khớp + không resolve module.

- [ ] **Step 3: Implement**

`src/data/realm/BodyRefinement.ts` — đổi 6 giá trị `cap`: `50 → 175 → 615 → 2150 → 7500 → 26300`; thêm comment dòng đầu khu caps:

```ts
// Caps cấp số nhân (spec dot-pha-loi-kiep §3.1 — hệ số ×3.5/tầng,
// first-pass: đối chiếu tổng nguồn Tinh Hoa farm được trong 18 tầng
// Phàm Nhân khi playtest; đổi 1 hằng số LUYEN_THE_CAP_GROWTH này để
// retune).
```

`src/data/breakthrough/BreakthroughGrades.ts`:

```ts
import type { PlayerData } from '../../core/player/Player'
import type { FoundationType } from '../../core/breakthrough/FoundationType'
import { MERIDIANS } from '../realm/Meridians'
import { MAIN_STAT_KEYS } from '../../core/stats/StatTypes'
import { getMainStatCap } from '../../core/stats/StatCap'
import { BODY_REFINEMENT_TIERS } from '../realm/BodyRefinement'

// 4 bậc Kiến Cơ (spec §4.2) — điều kiện ẨN, KHÔNG hiển thị trước;
// công bố SAU khi đạt. great_dao chỉ người chơi hội tụ đủ mọi điều
// kiện (kể cả talent Phàm Cốt) mới được xét — UI gate công khai chỉ
// bậc 'human' (tầng 12 + Linh Thạch).
export type KienCoGrade = FoundationType

// Số đường tối thiểu từng bậc — Thiên cần 6/8 (KHÔNG gồm Kỳ Kinh,
// spec ghi chú điều kiện), Đại Đạo cần 9/9.
const HEAVEN_MERIDIAN_COUNT = 6
const GREAT_DAO_MERIDIAN_COUNT = MERIDIANS.length // 9

const EARTH_BODY_TIERS = 3
const HEAVEN_BODY_TIERS = BODY_REFINEMENT_TIERS.length // 6

function hasEveryMainStatAtCap(player: PlayerData): boolean {
  const cap = getMainStatCap(player.realmId)

  return MAIN_STAT_KEYS.every((stat) => player.baseStats[stat] >= cap)
}

/**
 * Xét bậc Kiến Cơ lúc bấm đột phá (spec §2.1 — chỉ từ đầu tư TRƯỚC
 * kiếp, trận kiếp không cộng/trừ). `hasTrucCoDan` = Trúc Cơ Đan có
 * trong túi đồ lúc bấm (bậc Địa trở lên cần, KHÔNG tiêu — vật chứng).
 */
export function resolveKienCoGrade(player: PlayerData, hasTrucCoDan: boolean): KienCoGrade {
  // Vĩnh viễn: thua kiếp Đại Đạo → cap Thiên (spec §4.3)
  const greatDaoBlocked = player.greatDaoOpportunityLost

  // Bậc thấp cần trước khi xét bậc cao (thang lũy tiến)
  const earthReady = hasTrucCoDan && player.bodyRefinementCompletedTiers >= EARTH_BODY_TIERS
  const heavenReady =
    earthReady && player.bodyRefinementCompletedTiers >= HEAVEN_BODY_TIERS && player.openedMeridianIds.length >= HEAVEN_MERIDIAN_COUNT

  if (!greatDaoBlocked && heavenReady && player.openedMeridianIds.length >= GREAT_DAO_MERIDIAN_COUNT) {
    const hasPhamCot = player.selectedTalentIds.includes('pham_cot')

    if (
      hasPhamCot &&
      player.mortalPerfectionAchieved &&
      player.realmId === 'qi_refining' &&
      player.realmLevel >= MERIDIANS[MERIDIANS.length - 1]!.requiredRealmLevel &&
      hasEveryMainStatAtCap(player)
    ) {
      return 'great_dao'
    }
  }

  if (heavenReady) {
    return 'heaven'
  }

  if (earthReady) {
    return 'earth'
  }

  return 'human'
}
```

Xóa `src/core/breakthrough/FoundationResolver.ts` + `FoundationResolver.test.ts` (`git rm`) — thay bởi resolver tổng quát; cập nhật imports ở `useTribulation.ts` (comment refs) nếu type-check báo. Kiểm tra: `grep -r "FoundationResolver" src/` phải về 0 sau khi dọn (trừ comment lịch sử trong các file khác không cần đổi).

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/data/breakthrough/BreakthroughGrades.test.ts`
Expected: 8 test PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/data/realm/BodyRefinement.ts src/data/breakthrough/BreakthroughGrades.ts src/data/breakthrough/BreakthroughGrades.test.ts
git rm src/core/breakthrough/FoundationResolver.ts src/core/breakthrough/FoundationResolver.test.ts
git commit -m "feat(dot-pha): caps Luyen The cap so nhan x3.5 + resolver 4 bac Kien Co (Dai Dao vinh vien khi thua)"
```

---

### Task 3: Materials + quái ẩn + Yêu Đan boss + recipes alchemy

**Files:**
- Modify: `src/data/materials/materials.ts` (thêm 3 materials)
- Modify: `src/data/enemy/Enemies.ts` (quái ẩn + boss drop Yêu Đan)
- Modify: `src/data/alchemy/alchemyRecipes.ts` (công thức Thông Mạch Đan riêng + Trúc Cơ Đan)
- Modify: `src/core/alchemy/AlchemySystem.ts` (nếu type cần mở rộng cho recipe đặc biệt)
- Test: `src/data/enemy/HiddenBeastDrops.test.ts`

**Interfaces:**
- Consumes: `Material` type (`src/core/material/Material.ts`), `defineEnemy` + `EnemyItemDrop` (`src/core/enemy/Enemy.ts`), `AlchemyRecipe` (`src/core/alchemy/AlchemySystem.ts`), `PillSystem` (`src/core/pill/PillBag.ts`).
- Produces:
  - Materials: `yeu_dan_hung_giao` (Yêu Đan), `thien_dia_chi_kieu` (đã định nghĩa id ở Task 1 — chỉ thêm vào danh sách materials), `truc_co_dan` (pill — Trúc Cơ Đan là PILL trong túi đan, không phải material)
  - Enemy: `huyet_mong` (Huyết Mông — quái ẩn)
  - `TRUC_CO_DAN_PILL_ID = 'truc_co_dan'`, `THONG_MACH_DAN_PILL_ID = 'thong_mach_dan'` (cả hai là PILL — Thông Mạch Đan tiêu qua investThongMachDan nhưng nguồn từ alchemy; "có trong túi" của Trúc Cơ Đan kiểm tra qua PillBag)

- [ ] **Step 1: Viết test fail**

`src/data/enemy/HiddenBeastDrops.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ENEMIES } from './Enemies'
import { MATERIALS } from '../materials/materials'

describe('Quái ẩn + Yêu Đan + Thiên Địa Chi Kiều (spec §4.1c)', () => {
  it('Huyết Mông tồn tại, realm Luyện Khí, KHÔNG nằm trong enemyPool stage nào', () => {
    const beast = ENEMIES.find((e) => e.id === 'huyet_mong')
    expect(beast).toBeDefined()
    expect(beast!.realmId).toBe('qi_refining')
    expect(beast!.isElite).toBeUndefined()
    expect(beast!.isBoss).toBeUndefined()
  })

  it('Huyết Mông rơi Thiên Địa Chi Kiều 5%', () => {
    const beast = ENEMIES.find((e) => e.id === 'huyet_mong')!
    const drop = beast.rewards.itemDrops?.find((d) => d.itemId === 'thien_dia_chi_kieu')
    expect(drop).toBeDefined()
    expect(drop!.chance).toBe(0.05)
  })

  it('mọi material mới khai báo trong MATERIALS (không mồ côi)', () => {
    const ids = new Set(MATERIALS.map((m) => m.id))
    expect(ids.has('yeu_dan_hung_giao')).toBe(true)
    expect(ids.has('thien_dia_chi_kieu')).toBe(true)
  })

  it('Hung Giao Xà (boss LK t10) rơi Yêu Đan qua bossRewards', () => {
    const boss = ENEMIES.find((e) => e.id === 'ferocious_flood_serpent')!
    const drop = boss.bossRewards?.itemDrops?.find((d) => d.itemId === 'yeu_dan_hung_giao')
    expect(drop).toBeDefined()
    expect(drop!.chance).toBe(1)
    expect(drop!.amount).toBe(1)
  })

  it('recipe Thông Mạch Đan + Trúc Cơ Đan tồn tại với nguyên liệu Yêu Đan', () => {
    // Grep convention: alchemyRecipes flatMap — recipe đặt biệt phải được
    // append ngoài mảng generated theo PILL_FAMILIES
    const { SPECIAL_ALCHEMY_RECIPES } = await import('./alchemy/alchemyRecipes')
    const thongMach = SPECIAL_ALCHEMY_RECIPES.find((r) => r.pillId === 'thong_mach_dan')
    expect(thongMach).toBeDefined()
    const trucCo = SPECIAL_ALCHEMY_RECIPES.find((r) => r.pillId === 'truc_co_dan')
    expect(trucCo).toBeDefined()
  })
})
```

(Lưu ý: dynamic import trong test — nếu bất tiện thì import tĩnh đầu file. Sửa khi viết.)

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/data/enemy/HiddenBeastDrops.test.ts`
Expected: FAIL — `huyet_mong` undefined, materials thiếu.

- [ ] **Step 3: Implement**

`src/data/materials/materials.ts` — thêm 2 Material (theo pattern hiện có):

```ts
  {
    id: 'yeu_dan_hung_giao',
    name: 'Yêu Đan',
    category: 'beast_core',
    sourceType: 'drop',
    description: 'Đan核 của Hung Giao Xà — nguyên liệu chính luyện Thông Mạch Đan.',
    stackLimit: 100,
  },
  {
    id: 'thien_dia_chi_kieu',
    name: 'Thiên Địa Chi Kiều',
    category: 'beast_core',
    sourceType: 'drop',
    description: 'Nguyên liệu ẩn chỉ quái ẩn mang theo — cửa kiều nối trời đất.',
    stackLimit: 10,
  },
```

(Sửa "đan核" → "đan hạch" khi viết file — copy thuần Việt.)

`src/data/enemy/Enemies.ts` — thêm quái ẩn + drop boss (đặt cuối file, trước ENEMIES export):

```ts
  // Quái ẩn (spec dot-pha-loi-kiep §4.1c) — KHÔNG thuộc enemyPool
  // stage nào; chỉ trà trộn pool spawn qua HiddenBeastSystem khi cửa
  // sổ 1000 kill mở (xem core/game/HiddenBeastSystem.ts).
  defineEnemy({
    id: 'huyet_mong',
    name: 'Huyết Mông',
    level: 10,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'melee',
    family: 'hidden_beast',
    statsInput: {
      maxHp: 2600,
      attack: 130,
      attackSpeed: 4,
      movementSpeed: 1.6,
      attackRangeRanks: 1,
      criticalRate: 0.1,
      criticalDamage: 2.2,
      armor: 45,
      evasionRate: 10,
      resistances: { water: 10, fire: 10 },
      elemental: { element: 'water', power: 18 },
    },
    rewards: {
      techniqueInsight: 500,
      spiritStone: 150,
      itemDrops: [
        { kind: 'material', itemId: 'thien_dia_chi_kieu', amount: 1, chance: 0.05 },
        { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 12, chance: 1 },
      ],
    },
  }),
```

Boss `ferocious_flood_serpent` — thêm vào `bossRewards.itemDrops` (giữ drop cũ):

```ts
    bossRewards: {
      techniqueInsight: 1815,
      spiritStone: 525,
      itemDrops: [
        { kind: 'equipment', itemId: 'base_truy', chance: 0.4 },
        { kind: 'material', itemId: 'yeu_dan_hung_giao', amount: 1, chance: 1 },
      ],
    },
```

`src/data/alchemy/alchemyRecipes.ts` — append recipe đặc biệt (ngoài mảng generated):

```ts
// Đan đặc biệt (spec dot-pha-loi-kiep §4.1b) — 2 đan của gate Trúc Cơ,
// ngoài hệ 8-đan-phẩm theo PILL_FAMILIES. Nguyên liệu chính là Yêu Đan
// (boss Luyện Khí tầng 10) + thảo realm 2 + Linh Thạch.
export const SPECIAL_ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    id: 'alchemy_thong_mach_dan',
    pillId: 'thong_mach_dan',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('green_spirit_herb_qi_refining'),
    herbAmount: 3,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 3,
    spiritStoneCost: 500,
    baseDurationSeconds: 900,
    specialIngredients: [{ materialId: 'yeu_dan_hung_giao', amount: 1 }],
  },
  {
    id: 'alchemy_truc_co_dan',
    pillId: 'truc_co_dan',
    realmId: 'qi_refining',
    herbVariants: grottoVariants('green_spirit_herb_qi_refining'),
    herbAmount: 4,
    fuelWoodRealmId: 'qi_refining',
    fuelWoodAmount: 4,
    spiritStoneCost: 1000,
    baseDurationSeconds: 1200,
    specialIngredients: [{ materialId: 'yeu_dan_hung_giao', amount: 1 }],
  },
]

export const alchemyRecipes: AlchemyRecipe[] = [...generated, ...SPECIAL_ALCHEMY_RECIPES]
```

(Cấu trúc thực tế: giữ mảng generated hiện tại thành biến trung gian rồi spread. Nếu `AlchemyRecipe` chưa có field `specialIngredients`, thêm optional field `specialIngredients?: { materialId: string; amount: number }[]` vào `AlchemySystem.ts` + honor nó trong craft flow — kiểm tra/canCraft phải đếm cả material này; đặt theo cùng pattern `herbVariants`.)

Pills: thêm `thong_mach_dan` + `truc_co_dan` vào `src/data/pill/` theo pattern PILL hiện có (usage: Thông Mạch Đan KHÔNG uống trực tiếp — tiêu qua MeridianSystem; Trúc Cơ Đan KHÔNG uống — vật chứng bậc; 2 pill này cần `usage: 'none'`-equivalent hoặc category riêng để PillSystem.canUse không cho uống — theo pattern pill buff hiện có, thêm guard loại 2 pill này).

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/data/enemy/HiddenBeastDrops.test.ts`
Expected: 5 test PASS. Chạy thêm `npx.cmd vitest run src/data/enemy/EnemyDropSinkInvariant.test.ts src/data/enemy/EnemyAlchemyDrops.test.ts` — không vỡ invariant drop-sink.

- [ ] **Step 5: Commit**

```powershell
git add src/data/materials/materials.ts src/data/enemy/Enemies.ts src/data/alchemy/alchemyRecipes.ts src/core/alchemy/AlchemySystem.ts src/data/pill/ src/data/enemy/HiddenBeastDrops.test.ts
git commit -m "feat(dot-pha): vat lieu Yeu Dan/Thien Dia Chi Kieu + quai an Huyet Mong + recipe Thong Mach Dan/Truc Co Dan"
```

---

### Task 4: HiddenBeastSystem — cửa sổ 1000 kill + trà trộn spawn

**Files:**
- Create: `src/core/game/HiddenBeastSystem.ts`
- Modify: `src/core/game/BattleLootSystem.ts` (đếm kill + drop)
- Modify: `src/core/game/StageWaveSystem.ts` (hook spawn)
- Modify: `src/core/game/GameManager.ts` (wire hệ + register template)
- Test: `src/core/game/HiddenBeastSystem.test.ts`

**Interfaces:**
- Consumes: `PlayerData.luyenKhiKillsSinceBeast` (Task 1), `BattleLootSystem.processDefeatedEnemies` hook point (line ~282-289 hiện tại — sau bossKillCount), `StageWaveSystem.pickEnemyForSpawn` (line ~245).
- Produces:
  - `HIDDEN_BEAST_KILL_THRESHOLD = 1000`
  - `HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN = 0.05`
  - `HIDDEN_BEAST_ENEMY_ID = 'huyet_mong'`
  - `class HiddenBeastSystem { isWindowOpen(player): boolean; maybeReplaceSpawn(stage, player): Enemy | undefined; onEnemyDefeated(player, enemyId): void }` — Enemy return là template thay thế pool pick

- [ ] **Step 1: Viết test fail**

`src/core/game/HiddenBeastSystem.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { HiddenBeastSystem, HIDDEN_BEAST_KILL_THRESHOLD } from './HiddenBeastSystem'
import { createDefaultPlayer, type PlayerData } from '../player/Player'

const system = new HiddenBeastSystem()

function luyenKhiPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  return player
}

describe('HiddenBeastSystem — cửa sổ quái ẩn (spec §4.1c)', () => {
  it('999 kill: cửa sổ ĐÓNG; 1000 kill: MỞ', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD - 1
    expect(system.isWindowOpen(player)).toBe(false)
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    expect(system.isWindowOpen(player)).toBe(true)
  })

  it('giết quái ẩn (kể cả không drop) → reset đếm về 0', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD + 50
    system.onEnemyDefeated(player, 'huyet_mong')
    expect(player.luyenKhiKillsSinceBeast).toBe(0)
  })

  it('giết quái THƯỜNG trong window: KHÔNG reset (vẫn eligible)', () => {
    const player = luyenKhiPlayer()
    player.luyenKhiKillsSinceBeast = HIDDEN_BEAST_KILL_THRESHOLD
    system.onEnemyDefeated(player, 'pool_toad')
    expect(player.luyenKhiKillsSinceBeast).toBe(HIDDEN_BEAST_KILL_THRESHOLD + 1)
  })

  it('không phải Luyện Khí: đếm không tăng (chỉ stage Luyện Khí)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    system.onEnemyDefeated(player, 'foundation_stone_fungus')
    expect(player.luyenKhiKillsSinceBeast).toBe(0)
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/core/game/HiddenBeastSystem.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement**

`src/core/game/HiddenBeastSystem.ts`:

```ts
import type { PlayerData } from '../player/Player'
import type { Enemy } from '../enemy/Enemy'
import { rollChance } from '../reward/DropRoll'

// Quái ẩn (spec dot-pha-loi-kiep §4.1c) — đếm kill quái Luyện Khí từ
// lần giết quái ẩn gần nhất; đủ 1000 mở cửa sổ: quái ẩn có tỉ lệ trà
// trộn mỗi lần spawn; giết quái ẩn reset đếm (kể cả khi không drop).
export const HIDDEN_BEAST_KILL_THRESHOLD = 1000
export const HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN = 0.05
export const HIDDEN_BEAST_ENEMY_ID = 'huyet_mong'

export class HiddenBeastSystem {
  constructor(private readonly deps: { getEnemyTemplate: (id: string) => Enemy | undefined }) {}

  isWindowOpen(player: PlayerData): boolean {
    return player.luyenKhiKillsSinceBeast >= HIDDEN_BEAST_KILL_THRESHOLD
  }

  /** Mỗi lượt spawn stage Luyện Khí: nếu window mở, roll 5% trả Huyết Mông thay quái pool. */
  maybeReplaceSpawn(player: PlayerData, realmId: string): Enemy | undefined {
    if (realmId !== 'qi_refining' || !this.isWindowOpen(player)) {
      return undefined
    }

    if (!rollChance(HIDDEN_BEAST_SPAWN_CHANCE_PER_SPAWN)) {
      return undefined
    }

    return this.deps.getEnemyTemplate(HIDDEN_BEAST_ENEMY_ID)
  }

  /** Gọi từ BattleLootSystem khi 1 quái chết (chỉ đếm quái Luyện Khí). */
  onEnemyDefeated(player: PlayerData, enemyId: string, enemyRealmId: string): void {
    if (enemyRealmId !== 'qi_refining') {
      return
    }

    if (enemyId === HIDDEN_BEAST_ENEMY_ID) {
      player.luyenKhiKillsSinceBeast = 0
      return
    }

    player.luyenKhiKillsSinceBeast += 1
  }
}
```

Wire vào `BattleLootSystem.processDefeatedEnemies` (ngay sau block bossKillCount ~line 287): gọi `this.deps.hiddenBeast.onEnemyDefeated(this.player, battleEnemy.entity.id, enemy.realmId)` — thêm `hiddenBeast: HiddenBeastSystem` vào deps; chỉ gọi khi `this.player` không null.

Wire vào `StageWaveSystem.pickEnemyForSpawn` (cuối hàm, trước return template thường):

```ts
    // Quái ẩn trà trộn (spec §4.1c) — chỉ stage Luyện Khí + window mở
    if (this.activeStagePlayer) {
      const hidden = this.deps.hiddenBeast.maybeReplaceSpawn(
        this.activeStagePlayer,
        stage.requiredRealmId ?? 'qi_refining',
      )
      if (hidden) {
        return applyStageRealm(hidden)
      }
    }
```

(cần thêm `hiddenBeast` vào deps + dùng `activeStagePlayer` field hiện có — lưu ý `pickEnemyForSpawn` là private, hook ở 2 call-site start()/update() hoặc hạ thành internal + inject; chọn cách gọn nhất khi viết — KHÔNG đổi public API khác.)

`GameManager` constructor: khởi tạo `HiddenBeastSystem` với `getEnemyTemplate: (id) => this.enemyTemplates.get(id)`; thêm getter `hiddenBeastSystem` cho UI đọc window state.

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/core/game/HiddenBeastSystem.test.ts src/core/game/GameManager.bossSummon.test.ts`
Expected: PASS + boss summon test cũ không vỡ.

- [ ] **Step 5: Commit**

```powershell
git add src/core/game/HiddenBeastSystem.ts src/core/game/HiddenBeastSystem.test.ts src/core/game/BattleLootSystem.ts src/core/game/StageWaveSystem.ts src/core/game/GameManager.ts
git commit -m "feat(dot-pha): HiddenBeastSystem — cua so 1000 kill + quai an tra tron spawn pool Luyen Khi"
```

---

### Task 5: Data chương kiếp + bank câu hỏi tâm ma

**Files:**
- Create: `src/data/tribulation/TribulationChapters.ts`
- Create: `src/data/tribulation/TribulationMindQuestions.ts`
- Test: `src/data/tribulation/TribulationData.test.ts`

**Interfaces:**
- Consumes: `KienCoGrade` (Task 2), `FoundationType`.
- Produces:
  - `type TribulationChapterKind = 'mind' | 'body' | 'lightning'`
  - `interface MindTrialProfile { questionCount: number; firstQuestionSeconds: number; lastQuestionSeconds: number; restSecondsBetweenQuestions: number }`
  - `interface TankTrialProfile { durationSeconds: number; strikeIntervalSeconds: number; lightningMaxHpDamagePercent: number; finalStrikeMaxHpDamagePercent?: number }`
  - `interface TribulationChapterProfile { kind: TribulationChapterKind; name: string; description: string; mind?: MindTrialProfile; tank?: TankTrialProfile }`
  - `getTribulationChapters(targetRealmId: string): readonly TribulationChapterProfile[]` — Quán Khí 2 chương (mind + lightning), Trúc Cơ 3 chương (mind + body + lightning); realm khác trả undefined (framework)
  - `GRADE_DIFFICULTY_MULTIPLIER: Record<FoundationType, number>` = `{ human: 1, earth: 1.15, heaven: 1.3, great_dao: 1.85 }`
  - `TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM: Record<string, number>` = `{ qi_refining: 0.5, foundation_establishment: 0.4 }` (fallback 0.3, sàn 0.2)
  - `TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM: Record<string, number>` = `{ qi_refining: 50, foundation_establishment: 200 }` (fallback 2000)
  - `interface MindQuestion { id: string; realmId: string; question: string; answers: readonly string[]; correctAnswerIndex: number }`
  - `TRIBULATION_MIND_QUESTIONS: readonly MindQuestion[]` (~15 câu qi_refining + ~20 câu foundation_establishment — viết sẵn thiên văn/đạo lý/kiến thức Thanh Vân, 4 đáp án mỗi câu)

- [ ] **Step 1: Viết test fail**

`src/data/tribulation/TribulationData.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  getTribulationChapters,
  GRADE_DIFFICULTY_MULTIPLIER,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
} from './TribulationChapters'
import { TRIBULATION_MIND_QUESTIONS } from './TribulationMindQuestions'

describe('TribulationChapters (spec §5.2/§5.5/§5.7)', () => {
  it('Quán Khí: 2 chương mind → lightning; Trúc Cơ: 3 chương mind → body → lightning', () => {
    const quanKhi = getTribulationChapters('qi_refining')!
    expect(quanKhi.map((c) => c.kind)).toEqual(['mind', 'lightning'])
    const trucCo = getTribulationChapters('foundation_establishment')!
    expect(trucCo.map((c) => c.kind)).toEqual(['mind', 'body', 'lightning'])
  })

  it('số câu tâm ma theo gate: Quán Khí 3, Trúc Cơ 4 (spec §5.3 — 3, 4, 5...)', () => {
    const quanKhi = getTribulationChapters('qi_refining')!
    expect(quanKhi[0]!.mind!.questionCount).toBe(3)
    const trucCo = getTribulationChapters('foundation_establishment')!
    expect(trucCo[0]!.mind!.questionCount).toBe(4)
  })

  it('mọi chương tank (body/lightning) có đủ duration/interval/percent', () => {
    for (const realmId of ['qi_refining', 'foundation_establishment']) {
      for (const chapter of getTribulationChapters(realmId)!) {
        if (chapter.kind === 'mind') continue
        expect(chapter.tank!.durationSeconds).toBeGreaterThan(0)
        expect(chapter.tank!.strikeIntervalSeconds).toBeGreaterThan(0)
        expect(chapter.tank!.lightningMaxHpDamagePercent).toBeGreaterThan(0)
      }
    }
  })

  it('Lôi Kiếp có đại lôi (finalStrike) — chương lightning', () => {
    const chapters = getTribulationChapters('foundation_establishment')!
    const lightning = chapters[chapters.length - 1]!
    expect(lightning.tank!.finalStrikeMaxHpDamagePercent).toBeGreaterThan(
      lightning.tank!.lightningMaxHpDamagePercent,
    )
  })

  it('hệ số bậc: human 1 / earth 1.15 / heaven 1.3 / great_dao 1.85 (spec §5.5)', () => {
    expect(GRADE_DIFFICULTY_MULTIPLIER).toEqual({ human: 1, earth: 1.15, heaven: 1.3, great_dao: 1.85 })
  })

  it('phạt tu vi giảm dần theo realm + Linh Thạch scale (spec §5.7)', () => {
    expect(TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM.qi_refining).toBe(0.5)
    expect(TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM.foundation_establishment).toBe(0.4)
    expect(TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM.qi_refining).toBe(50)
    expect(TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM.foundation_establishment).toBe(200)
  })
})

describe('TribulationMindQuestions (spec §5.3)', () => {
  it('bank đủ số câu theo realm: qi_refining ≥ 12, foundation_establishment ≥ 16', () => {
    const quanKhi = TRIBULATION_MIND_QUESTIONS.filter((q) => q.realmId === 'qi_refining')
    const trucCo = TRIBULATION_MIND_QUESTIONS.filter((q) => q.realmId === 'foundation_establishment')
    expect(quanKhi.length).toBeGreaterThanOrEqual(12)
    expect(trucCo.length).toBeGreaterThanOrEqual(16)
  })

  it('mọi câu: đúng 4 đáp án, 1 đáp án đúng (index hợp lệ), id duy nhất', () => {
    const ids = new Set<string>()
    for (const q of TRIBULATION_MIND_QUESTIONS) {
      expect(q.answers).toHaveLength(4)
      expect(q.correctAnswerIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctAnswerIndex).toBeLessThan(4)
      expect(ids.has(q.id)).toBe(false)
      ids.add(q.id)
    }
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/data/tribulation/TribulationData.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement**

`src/data/tribulation/TribulationChapters.ts` — đầy đủ types + 2 profiles realm + 2 maps phạt + multiplier (số liệu first-pass từ spec §5.4: Quán Khí lightning 6-8% interval 3s 15s; Trúc Cơ body 8-13% interval 2s ~20s, lightning dồn dập + đại lôi 25-40%). Viết ~12-20 câu hỏi tâm ma thật (tiếng Việt, hương vị tiên hiệp — câu hỏi về thế giới Thanh Vân, đạo lý, thiên văn địa lý đơn giản; câu realm Trúc Cơ khó hơn). Câu hỏi dạng:

```ts
export const TRIBULATION_MIND_QUESTIONS: readonly MindQuestion[] = [
  {
    id: 'mind_qi_01',
    realmId: 'qi_refining',
    question: 'Linh khí của thế giới này chảy về đâu khi trời gần sáng?',
    answers: ['Về Đông Hải', 'Về Thanh Vân Sơn', 'Về tầng更深 của địa mạch', 'Tan vào hư không'],
    correctAnswerIndex: 1,
  },
  // ... (viết đủ ≥ 12 câu qi_refining, ≥ 16 câu foundation_establishment)
]
```

(Không dùng ký tự Trung — "tầng更深" → "tầng sâu hơn". Mỗi câu phải có đáp án đúng rõ ràng, kiến thức chứng trước trong game/wiki.)

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/data/tribulation/TribulationData.test.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```powershell
git add src/data/tribulation/TribulationChapters.ts src/data/tribulation/TribulationMindQuestions.ts src/data/tribulation/TribulationData.test.ts
git commit -m "feat(dot-pha): chapter profiles 2/3 chuong + bank cau hoi tam ma + phat theo realm + he so bac"
```

---

### Task 6: TribulationDirector — engine chương kiếp

**Files:**
- Create: `src/core/tribulation/TribulationDirector.ts`
- Test: `src/core/tribulation/TribulationDirector.test.ts`

**Interfaces:**
- Consumes: `TribulationChapterProfile` + `GRADE_DIFFICULTY_MULTIPLIER` + `TRIBULATION_MIND_QUESTIONS` (Task 5), `resolveKienCoGrade` (Task 2), `CombatEntity` + `playerToCombatEntity` (`src/core/player/Player.ts`), `applyDirectDamage`-pattern (vitals + mitigation `100/(100+def)` — copy từ TribulationSystem cũ vì KHÔNG đi qua BattleSystem), `EventBus`, `rollChance`/seeded RNG pattern hiện có.
- Produces:
  - `type TribulationOutcome = 'ongoing' | 'victory' | 'defeat'`
  - `interface ActiveTribulationState { targetRealmId: string; grade: FoundationType; chapterIndex: number; chaptersTotal: number; state: TribulationOutcome; currentQuestion?: MindQuestion | null; questionSecondsRemaining?: number; secondsRemaining: number; lightningStrikesTaken: number }`
  - `class TribulationDirector { constructor(deps: { eventBus: EventBus }); start(player: PlayerData, hasTrucCoDan: boolean, targetRealmId: string): boolean; update(deltaSeconds: number): void; answerQuestion(answerIndex: number): boolean; getState(): ActiveTribulationState | null; clear(): void; getCooldownSeconds(now?: number): number }`

**Hành vi (từ spec §5):**
- `start`: resolve bậc → build CombatEntity snapshot (maxHp/def/hpRegen thật từ `playerToCombatEntity(player, stats)` — stats do caller truyền như TribulationSystem cũ) → chọn chapters theo realm → shuffle câu hỏi random từ bank đúng realm (số câu theo profile) → set cooldown check như cũ. Phát event `tribulation_started` + `tribulation_grade_resolved` (payload grade — UI hiện sau).
- `update(deltaSeconds)` (gọi từ App.vue tick thay TribulationSystem cũ):
  - Chapter `mind`: tick timer câu hiện tại; hết giờ = sai → apply 1 stack debuff (`mind_fail_stack`: +5% damage taken, -3% def mỗi stack, cộng dồn) → câu kế (restSeconds nghỉ) → hết số câu → chuyển chương.
  - Chapter `body`/`lightning`: strike theo interval × (1 / GRADE_DIFFICULTY_MULTIPLIER[grade]) — bậc cao strike nhanh hơn; damage = `maxHp × percent × multiplier(bậc) × mitigation(100/(100+def))`; áp qua pattern vitals trực tiếp (KHÔNG qua BattleSystem); lightning kết thúc bằng 1 strike `finalStrikeMaxHpDamagePercent` nếu có; hết durationSeconds → chương sau.
  - HP ≤ 0 bất kỳ lúc nào → defeat + cooldown 5 phút (giữ `TRIBULATION_COOLDOWN_SECONDS`).
  - Hết chương cuối còn sống → victory.
  - Buff tâm ma đúng: mỗi câu đúng heal 8% maxHp + giảm 5% damage lôi nhận trong 1 chương (reset mỗi chương mind mới), tự động luân phiên 3 hiệu ứng (heal/giảm ST/kháng lôi) — đơn giản: 1 buff gộp 3 hiệu ứng nhỏ đó.
  - Catch-up window như TribulationSystem cũ: `elapsed = Math.min(delta, secondsRemaining)`, while-loop strikes đóng (không fixed-step 0.1).
- `answerQuestion(index)`: chỉ hợp lệ khi `currentQuestion` active; đúng → buff + event `mind_question_correct`; sai → stack debuff + event `mind_question_wrong`; trả true nếu câu được xử lý.

- [ ] **Step 1: Viết test fail** — kịch bản chính:

```ts
// src/core/tribulation/TribulationDirector.test.ts
import { describe, it, expect, vi } from 'vitest'
import { TribulationDirector } from './TribulationDirector'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { createEventBus } from '../events/EventBus'
import { createBaseStats, type Stats } from '../stats/StatBlock'

function makeDirector() {
  const eventBus = createEventBus()
  return { director: new TribulationDirector({ eventBus }), eventBus }
}

function readyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 12
  return player
}

const stats: Stats = { ...createBaseStats(), maxHp: 1000, defense: 0, hpRegenPerSecond: 0 } as Stats

describe('TribulationDirector (spec §5)', () => {
  it('start Quán Khí: 2 chương, chương 1 là mind với 3 câu', () => {
    const { director } = makeDirector()
    expect(director.start(readyPlayer(), false, 'qi_refining')).toBe(true)
    const state = director.getState()!
    expect(state.chaptersTotal).toBe(2)
    expect(state.chapterIndex).toBe(0)
    expect(state.currentQuestion).not.toBeNull()
  })

  it('trả lời đúng 3/3 câu → hết mind, sang chương tank; HP không mất', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), false, 'qi_refining')
    for (let i = 0; i < 3; i++) {
      const q = director.getState()!.currentQuestion!
      director.answerQuestion(q.correctAnswerIndex)
      director.update(3) // rest giữa câu
    }
    director.update(1)
    expect(director.getState()!.chapterIndex).toBe(1) // lightning
  })

  it('trả lời sai: stack debuff tăng damage taken — chết nhanh hơn khi tank', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), false, 'qi_refining')
    // trả lời SAI hết 3 câu (index khác correct)
    for (let i = 0; i < 3; i++) {
      const q = director.getState()!.currentQuestion!
      director.answerQuestion((q.correctAnswerIndex + 1) % 4)
      director.update(3)
    }
    director.update(1)
    expect(director.getState()!.chapterIndex).toBe(1)
    // capture damage của 1 strike khi có 3 stack vs 0 stack: dùng 2 director
  })

  it('HP về 0 giữa chương → defeat + cooldown', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), false, 'qi_refining')
    // maxHp 1000, defense 0, lightning 6%/strike × nhiều strike
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 500) {
      director.update(1)
      const q = director.getState()!.currentQuestion
      if (q) director.answerQuestion(0) // random đáp án, nhanh chóng qua mind
    }
    expect(director.getState()!.state).not.toBe('ongoing')
  })

  it('sống sót hết chương cuối → victory', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), false, 'qi_refining')
    // answer đúng hết + để trôi thời gian — HP 1000 với lôi 6% + regen 0
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 2000) {
      director.update(1)
      const q = director.getState()!.currentQuestion
      if (q) director.answerQuestion(q.correctAnswerIndex)
    }
    expect(director.getState()!.state).toBe('victory')
  })

  it('grade Đại Đạo (đủ điều kiện + đan): strike nhanh & mạnh hơn human (×1.85)', () => {
    // 2 director cùng stats, 1 player human 1 great_dao-ready (đủ Task 2 điều kiện + truc_co_dan);
    // chạy update với delta đủ để qua chương mind (answer đúng), đo tổng damage nhận
    // sau cùng số giây ở chương lightning — great_dao phải nhận NHIỀU hơn human.
    const { director: humanDirector } = makeDirector()
    const { director: greatDaoDirector } = makeDirector()
    const human = readyPlayer() // không Luyện Th thể/đan → grade human
    const greatDao = createGreatDaoReadyPlayer() // helper dựng đủ điều kiện resolver
    humanDirector.start(human, false, 'foundation_establishment')
    greatDaoDirector.start(greatDao, true, 'foundation_establishment')
    // qua chương mind bằng trả lời đúng, rồi để trôi 10s chương tank
    for (const d of [humanDirector, greatDaoDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 100) {
        const q = d.getState()!.currentQuestion!
        d.answerQuestion(q.correctAnswerIndex)
        d.update(3)
      }
    }
    const humanBefore = snapshotHp(humanDirector)
    const greatDaoBefore = snapshotHp(greatDaoDirector)
    humanDirector.update(10)
    greatDaoDirector.update(10)
    const humanDamage = humanBefore - snapshotHp(humanDirector)
    const greatDaoDamage = greatDaoBefore - snapshotHp(greatDaoDirector)
    expect(greatDaoDamage).toBeGreaterThan(humanDamage)
  })

  it('unknown realm → start false (framework guard)', () => {
    const { director } = makeDirector()
    expect(director.start(readyPlayer(), false, 'golden_core')).toBe(false)
  })

  it('close giữa chừng (không update) — getState vẫn ongoing; App.vue xử lý defeat khi save-load giữa kiếp (spec §5.6: thua)', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), false, 'qi_refining')
    expect(director.getState()!.state).toBe('ongoing')
  })
})
```

(Viết đầy đủ assert khi implement — skeleton trên nêu ý định test; test grade Đại Đạo dùng 2 player thật.)

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/core/tribulation/TribulationDirector.test.ts`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement**

`src/core/tribulation/TribulationDirector.ts` — engine hoàn chỉnh theo Interfaces + hành vi trên. Điểm kỹ thuật:
- KHÔNG đụng BattleSystem/Battle — snapshot `CombatEntity` tự quản (currentHp, maxHp, stats.defense), damage áp qua `EntityVitalsSystem` trực tiếp (instantiate 1 instance như CombatSystem làm) hoặc tự trừ + emit `damage` event (tái dùng event shape cũ `tribulation_lightning` cho VFX).
- `questionSecondsRemaining` co theo `MindTrialProfile` nội suy tuyến tính giữa firstQuestionSeconds → lastQuestionSeconds theo index câu.
- Câu hỏi chọn: shuffle bank realm (Math.random — pattern seeded RNG của repo nếu có sẵn helper, dùng nó).
- Cooldown giữ `TRIBULATION_COOLDOWN_SECONDS = 300` (chép từ TribulationSystem cũ khi xóa ở Task 8).

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/core/tribulation/TribulationDirector.test.ts`
Expected: PASS toàn bộ (~8 test).

- [ ] **Step 5: Commit**

```powershell
git add src/core/tribulation/TribulationDirector.ts src/core/tribulation/TribulationDirector.test.ts
git commit -m "feat(dot-pha): TribulationDirector — engine chuong kiep mind/body/lightning, debuff stack, grade multiplier, khong qua BattleSystem"
```

---

### Task 7: Dọn BattleSystem mode tribulation + TribulationSystem cũ + Đột Phá Lệnh

**Files:**
- Modify: `src/core/battle/BattleSystem.ts` (gỡ startTribulation + mode branch)
- Modify: `src/core/battle/Battle.ts` + `src/core/battle/BattleEvents.ts` (gỡ mode union 'tribulation' nếu chỉ còn combat dùng)
- Delete: `src/core/game/TribulationSystem.ts` + `TribulationSystem.test.ts`, `src/core/breakthrough/TribulationProfile.ts`, `src/data/enemy/Tribulations.ts`
- Modify: `src/core/game/GameManager.ts` (gỡ startTribulation/getActiveTribulation/clearActiveTribulation delegates + canCraftBreakthroughToken/craftBreakthroughToken + BREAKTHROUGH_REQUIREMENTS import)
- Delete: `src/core/breakthrough/BreakthroughRequirement.ts`
- Modify: `src/core/game/BattleLootSystem.ts` (gỡ beginTribulation nếu không còn caller — hoặc giữ nếu Director cần; quyết định: gỡ, Director không cần loot session)
- Test updates: `src/core/game/GameManager.tribulation.test.ts`, `GameManager.tribulationLootSession.test.ts`, `GameManager.progressionScope.test.ts` — chuyển sang test Director qua GameManager mới

**Interfaces:**
- Consumes: TribulationDirector (Task 6), resolver (Task 2), chapters (Task 5).
- Produces: GameManager public API MỚI thay cũ:
  - `startTribulation(player: PlayerData, playerStats: Stats, targetRealmId: string): boolean` — GIỮ SIGNATURE (trừ param foundationType cũ) nhưng delegate sang `tribulationDirector.start` — resolve bậc + hasTrucCoDan nội bộ (đọc PillBag)
  - `getActiveTribulation(): ActiveTribulationState | null` (type mới Task 6)
  - `clearActiveTribulation(): void`
  - `answerTribulationQuestion(index: number): boolean` (mới — cho overlay Vue)
  - `getTribulationCooldownSeconds(): number` giữ nguyên

- [ ] **Step 1: Viết test mới fail trước khi dọn** — `src/core/game/GameManager.dotPha.test.ts`:

```ts
// Kiểm thử GameManager facade mới trên Director thật (không mock)
import { describe, it, expect } from 'vitest'
// setup GameManager như GameManager.tribulation.test.ts cũ (đọc file đó lấy harness)
// 1. startTribulation('qi_refining') → getActiveTribulation() có grade + 2 chương
// 2. startTribulation khi đứng qi_refining tầng 12 → true; tầng 11 → false (gate tầng giữ)
// 3. answerTribulationQuestion(index đúng) → true + state câu kế
// 4. KHÔNG còn craftBreakthroughToken/canCraftBreakthroughToken trên GameManager (type-level: compile fail nếu gọi — kiểm bằng grep trong test sau khi dọn)
```

(Viết harness theo pattern `GameManager.tribulation.test.ts` cũ — có sẵn setup helper; các assert cụ thể viết đầy đủ khi implement.)

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/core/game/GameManager.dotPha.test.ts`
Expected: FAIL — API cũ chưa có answerTribulationQuestion.

- [ ] **Step 3: Implement dọn + wire**

1. `git rm src/core/game/TribulationSystem.ts src/core/game/TribulationSystem.test.ts src/core/breakthrough/TribulationProfile.ts src/data/enemy/Tribulations.ts src/core/breakthrough/BreakthroughRequirement.ts`
2. `BattleSystem.ts`: xóa method `startTribulation` (line 477-516) + branch `mode === 'tribulation'` trong `update()` (line 830-834) + initKiemTuBattleResources call trong startTribulation. `Battle.ts`/`BattleEvents.ts`: bỏ `'tribulation'` khỏi union mode (nếu không còn nơi set — grep 'tribulation' trong core/battle sau khi xóa phải sạch trừ comment).
3. `GameManager.ts`:
   - Gỡ imports BREAKTHROUGH_REQUIREMENTS + TRIBULATION_ENEMY refs, gỡ `canCraftBreakthroughToken`/`craftBreakthroughToken` (line ~1573-1600), gỡ field `tribulation` (TribulationSystem cũ), thay bằng `tribulationDirector: TribulationDirector` khởi tạo trong constructor (deps eventBus).
   - `startTribulation(player, playerStats, targetRealmId)`: check cooldown + active như cũ qua Director; hasTrucCoDan = `this.pillBag.has('truc_co_dan', 1)` (kiểm tra PillBag API thật — `getAmount`/`has` theo pattern MaterialBag); gọi `director.start(...)`. Khi thành công: `battleLoot` KHÔNG còn beginTribulation; surviveLethal guard không áp (kiếp không qua combat) — xóa 2 call đó.
   - `getActiveTribulation`/`clearActiveTribulation`/`getTribulationCooldownSeconds` delegate Director; thêm `answerTribulationQuestion(index)`.
4. `BattleLootSystem.ts`: gỡ `beginTribulation` + test file tương ứng chuyển thành test "beginBattle reset đủ" (hoặc xóa nếu trùng cover).
5. Cập nhật các test cũ bị đụng: `GameManager.tribulation.test.ts` (viết lại theo Director), `GameManager.tribulationLootSession.test.ts` (chuyển/xóa có chủ đích), `GameManager.progressionScope.test.ts` (canTriggerRealmBreakthrough vẫn false — giữ), `BattleSystem.batKiem.test.ts` line ~489-505 (gỡ test startTribulation channel — chuyển thành test start() thường nếu ý giữ).
6. `useTribulation.ts`: gỡ import TRIBULATION_PROFILES/KIEP_THUONG refs cũ nếu compile lỗi; logic chính giữ (resolveVictory/resolveDefeat đổi đọc ActiveTribulationState mới + phạt theo 2 map Task 5 + set `greatDaoOpportunityLost` khi thua grade great_dao; resolveVictory set `player.highestFoundationAchieved = state.grade` khi Trúc Cơ).
7. `BreakthroughRequirementPanel.vue` + `breakthroughRequirement` store: dọn UI craft — panel trở thành confirm đơn giản "Độ Kiếp" (hiện Linh Thạch cost theo realm từ map Task 5; KHÔNG hiện điều kiện bậc). `RealmPanel.vue` giữ flow (mở requirement panel → confirm → start).

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/core/game/GameManager.dotPha.test.ts src/core/game/GameManager.tribulation.test.ts src/core/battle/BattleSystem.batKiem.test.ts`
Expected: PASS. Sau đó `npm.cmd run type-check` — sửa mọi import chết còn sót.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "refactor(dot-pha): go TribulationSystem/BreakthroughRequirement/quai Kiep — GameManager delegate sang TribulationDirector, gos Dhat Pha Lenh"
```

---

### Task 8: Snapshot hoàn hảo Phàm Nhân + Phàm Nhân Chi Cốt + resolveVictory/Defeat mới

**Files:**
- Modify: `src/core/game/GameManager.ts` (`chooseCultivationPath` — chốt snapshot khi Quán Khí)
- Modify: `src/composables/useTribulation.ts` (resolveVictory/resolveDefeat hoàn chỉnh)
- Modify: `src/data/talent/Talents.ts` (thêm `pham_nhan_chi_cot`)
- Modify: `src/core/talent/TalentEffects.ts` (getter đọc talent mới — cultivation_speed +75%)
- Test: `src/composables/useTribulation.dotPha.test.ts`

**Interfaces:**
- Consumes: Task 6 `ActiveTribulationState.grade`, Task 2 resolver, `FOUNDATION_LABELS` (`FoundationType.ts`), `KIEP_THUONG_DEBUFF` (`data/buff/buffs.ts`).
- Produces:
  - `mortalPerfectionAchieved` set trong `chooseCultivationPath` khi: 5/5 main stat ≥ cap mortal (10) + `bodyRefinementCompletedTiers >= 6` (dùng `getMainStatCap('mortal')`)
  - Talent `pham_nhan_chi_cot`: `{ kind: 'cultivation_speed', percent: 0.75 }` (+ hiệu ứng phụ playtest để trống — chỉ 1 effect thật)
  - useTribulation resolveVictory/Defeat mới: victory Trúc Cơ → `highestFoundationAchieved = grade` + world announce `★ {FOUNDATION_LABELS[grade]} TRÚC CƠ ★` + nếu grade === 'great_dao' → chuyển talent pham_cot → pham_nhan_chi_cot (thêm id, bỏ id cũ khỏi `selectedTalentIds`); defeat → phạt theo 2 map + `greatDaoOpportunityLost = true` khi grade === 'great_dao' + announce "Đại đạo đoạn tuyệt..." 

- [ ] **Step 1: Viết test fail**

`src/composables/useTribulation.dotPha.test.ts` — test thuần (pattern test composable hiện có — đọc `useTribulation` test cũ nếu có, hoặc test qua GameManager + store harness như `GameManager.dotPha.test.ts`):

```ts
// 1. chooseCultivationPath khi 5/5 stat 10 + 6/6 Luyện Th thể → mortalPerfectionAchieved = true
//    thiếu 1 stat (9) → false; thiếu 1 tầng (5/6) → false
// 2. resolveVictory grade great_dao → selectedTalentIds đổi ['pham_cot'] → ['pham_nhan_chi_cot'],
//    highestFoundationAchieved = 'great_dao'
// 3. resolveDefeat grade great_dao → greatDaoOpportunityLost = true (và KHÔNG đổi talent)
// 4. resolveDefeat qi_refining: cultivation × 0.5, linh thạch -50 (min owned), KIEP_THUONG áp
// 5. resolveDefeat foundation_establishment: cultivation × 0.6, linh thạch -200
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/composables/useTribulation.dotPha.test.ts`
Expected: FAIL — snapshot chưa set, talent chưa tồn tại.

- [ ] **Step 3: Implement** theo Interfaces trên. Điểm chú ý:
- `chooseCultivationPath` hiện ở GameManager.ts ~line 983-1075 — thêm chốt snapshot ĐẦU hàm (trước khi đổi realmId) vì điều kiện đọc mainStats cap mortal.
- Talent mới đặt cạnh `pham_cot` trong Talents.ts, cùng rarity 'di', weight 0 (KHÔNG roll trong character creation — chỉ chuyển hóa), tags ['mechanic', 'risk_reward'], description: "Phàm nhân chi cốt — đại nạn bất tử, phàm thai hữu đạo. Tốc độ tu luyện tăng 75%." (verbatim style tác giả, KHÔNG liệt vào roll pool vì weight 0).
- `resolveDefeat` đọc 2 map từ Task 5 thay constants cứng cũ; gỡ `TRIBULATION_DEFEAT_CULTIVATION_LOSS_PERCENT`/`TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS` cũ.

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/composables/useTribulation.dotPha.test.ts src/data/talent/Talents.test.ts src/core/talent/TalentEffects.test.ts`
Expected: PASS (test talent cũ không vỡ — pham_cot giữ nguyên).

- [ ] **Step 5: Commit**

```powershell
git add src/core/game/GameManager.ts src/composables/useTribulation.ts src/data/talent/Talents.ts src/core/talent/TalentEffects.ts src/composables/useTribulation.dotPha.test.ts
git commit -m "feat(dot-pha): snapshot hoan hao Pham Nhan + Pham Nhan Chi Cot chuyen hoa + resolveVictory/Defeat theo grade + phat theo realm"
```

---

### Task 9: UI — TribulationOverlay mới (chương + câu hỏi) + dọn BreakthroughRequirementPanel

**Files:**
- Modify: `src/components/game/tribulation/TribulationSceneOverlay.vue` (viết lại — chương, HP, câu hỏi, thanh giờ)
- Modify: `src/components/common/BreakthroughRequirementPanel.vue` (bỏ craft, confirm Linh Thạch trực tiếp)
- Modify: `src/game/scenes/TribulationScene.ts` (VFX theo chương: tâm ma = tối/tím, lôi = chớp trắng — giữ pattern event hiện có)
- Modify: `src/components/panels/RealmPanel.vue` (nếu label/flow đổi)
- Test: `src/components/game/tribulation/TribulationSceneOverlay.test.ts`

**Interfaces:**
- Consumes: `gameManager.getActiveTribulation()` (ActiveTribulationState Task 6 — có `currentQuestion`, `questionSecondsRemaining`, `chapterIndex`, `chaptersTotal`, `lightningStrikesTaken`), `gameManager.answerTribulationQuestion(index)`, chapters name/description (Task 5).
- Produces: overlay render: thanh chương (n/total + tên), HP bar (giữ), khối câu hỏi (question text + 4 nút đáp án + thanh giờ co), số lôi đã đỡ; sau victory/defeat hiển thị khối kết quả + nút thoát (tái dùng pattern exitTribulationScene).

- [ ] **Step 1: Viết test fail** — component test (pattern `@vue/test-utils` như DongFuScene.test.ts):

```ts
// 1. state có currentQuestion → render 4 nút đáp án + text câu hỏi + timer bar
// 2. click nút đáp án đúng index → gọi gameManager.answerTribulationQuestion(index) (spy)
// 3. state không currentQuestion (chương tank) → KHÔNG render khối câu hỏi, hiển thị tên chương + đếm lôi
// 4. state victory → khối kết quả "Vượt Kiếp" + nút thoát gọi exitTribulationScene
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/components/game/tribulation/TribulationSceneOverlay.test.ts`
Expected: FAIL — component chưa có khối câu hỏi.

- [ ] **Step 3: Implement** — overlay mới đọc `ActiveTribulationState`; 4 nút GameButton đáp án; thanh giờ dùng primitive `Bar` (value=questionSecondsRemaining, max=profileFirstSeconds — lấy qua computed từ state); TribulationScene.ts đổi màu nền theo chương qua event `tribulation_chapter_changed` (Director phát thêm — thêm vào Task 6 event list: payload chapterIndex + kind) hoặc đơn giản: Director phát `tribulation_lightning` cũ cho VFX sét (tái dùng handler), chapter mind phát `tribulation_mind_phase` (thêm handler đơn giản đổi màu nền). BreakthroughRequirementPanel: gỡ khối craft/nút Luyện; nút "Độ Kiếp" check + trừ Linh Thạch trực tiếp theo map Task 5 (thêm hàm `consumeTribulationSpiritStones(targetRealmId)` vào GameManager — check đủ + trừ đúng loại Linh Thạch theo realm tier).

Manh mối bậc Địa/Thiên (spec §4.2 — hinted, KHÔNG liệt kê điều kiện): thêm 2 dòng flavor text tĩnh vào `BreakthroughRequirementPanel.vue` dưới nút confirm (hiện cho MỌI người chơi Luyện Khí 12+, không điều kiện, không đếm được): *"Tương truyền người có Trúc Cơ Đan tại thân, căn cốt lại vững..."* + *"...kinh mạch thông suốt, thiên kiếp cũng phải nhường ba phần."* — không mô tả số/tên điều kiện cụ thể nào khác. Great_Dao: KHÔNG thêm gì (ẩn hoàn toàn).

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest run src/components/game/tribulation/TribulationSceneOverlay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/game/tribulation/ src/components/common/BreakthroughRequirementPanel.vue src/game/scenes/TribulationScene.ts src/core/game/GameManager.ts
git commit -m "feat(dot-pha): TribulationOverlay moi — chuong kiep + minigame tam ma 4 dap an + confirm Linh Thach truc tiep"
```

---

### Task 10: Save v54 + dọn dọc + docs + full verify

**Files:**
- Modify: `src/services/save/saveVersion.ts` (bump 54 + comment block)
- Modify: `src/services/save/SaveSystem.ts` (comment fields mới)
- Modify: `src/services/save/saveShapeValidation.ts` (shape 4 fields mới — pattern hiện có)
- Modify: `docs/game-guide.md` (mục Độ Kiếp viết lại theo hệ mới)
- Modify: `docs/roadmap.md` (Phase 3 — cập nhật trạng thái Kiến Cơ 4 bậc + lưu ý quái ẩn)
- Test: `src/services/save/SaveRoundTrip.test.ts` (fields mới roundtrip)

**Interfaces:**
- Consumes: 4 fields Task 1, shape validation pattern.
- Produces: `CURRENT_SAVE_VERSION = 54 as const` — save cũ v53 bị từ chối (dev phase).

- [ ] **Step 1: Viết test fail** — SaveRoundTrip thêm case: save với `openedMeridianIds: ['nham_mach', 'doi_mach']`, `luyenKhiKillsSinceBeast: 500`, `mortalPerfectionAchieved: true`, `greatDaoOpportunityLost: false` → serialize → load → đủ 4 fields nguyên vẹn; save thiếu fields (v53-style) → rejected.

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest run src/services/save/SaveRoundTrip.test.ts`
Expected: FAIL — version còn 53.

- [ ] **Step 3: Implement** — bump version + comment mô tả (mô tả spec dot-pha-loi-kiep: 4 fields, gỡ Đột Phá Lệnh/quái Kiếp/Trúc Cơ token materials), shape validation thêm 4 fields theo pattern boolean/array/number check hiện có. Docs: game-guide.md mục Độ Kiếp mô tả: chương kiếp, tâm ma, bậc ẩn KHÔNG lộ điều kiện (chỉ nói "tương truyền chuẩn bị kỹ lắm mới có cơ duyên"), Bát Mạch, quái ẩn (không spoil cụ thể — chỉ "tương truyền nơi sâu nhất Huyền Đàm Trạch có dị thú"), Trúc Cơ Đan/Thông Mạch Đan công thức, Linh Thạch cost. roadmap.md Phase 3: đánh dấu completed phần Kiến Cơ 4 bậc + tribulation rework, note công việc còn lại (UI polish, playtest số liệu).

- [ ] **Step 4: Full verify**

```powershell
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
```
Expected: toàn bộ PASS (số test > 1189 — có test mới), build exit 0. Fix mọi fail do task gây ra (test cũ khóa hành vi removed → update có chủ đích theo spec, KHÔNG xóa).

- [ ] **Step 5: Commit**

```powershell
git add src/services/save/ docs/
git commit -m "feat(dot-pha): save v54 (4 fields moi) + shape validation + docs game-guide/roadmap"
```

---

## Phụ lục: Thứ tự phụ thuộc

```
Task 1 (fields + MeridianSystem) ─┬─► Task 2 (caps + resolver) ─► Task 5 (chapters data)
                                   │        │
                                   │        └─► Task 8 (snapshot/victory/talent)
Task 3 (materials/quái/recipes) ──┴─► Task 4 (HiddenBeastSystem)
Task 5 ─► Task 6 (Director)
Task 6 ─► Task 7 (dọn hệ cũ + wire GameManager)
Task 7 ─► Task 9 (UI overlay)
Task 1-9 ─► Task 10 (save v54 + docs + full verify)
```

Task 2 và Task 3 độc lập nhau (chạy song song được). Task 7 là mốc "game chạy được với hệ mới" — mọi task sau chỉ UI/docs/save.

## Ghi chú thực thi

- Mỗi task chạy trong worktree `.agent-worktrees/dot-pha-loi-kiep` (branch `agent/dot-pha-loi-kiep`), đã có sẵn.
- Test cũ khóa hành vi bị xóa (TribulationSystem/BreakthroughToken/progressionScope...) phải UPDATE CÓ CHỦ ĐỊCH theo hành vi mới — spec là nguồn sự thật, không phải test cũ.
- `finalDamagePercent`/FRACTION convention, edit tool thay regex PowerShell, KHÔNG dùng `-replace` cho file code (gotcha từ session trước).
- Ctrl: không dùng ký tự tiếng Trung trong copy UI (sửa các placeholder "气血"/"更深"/"核"/"tráo_dyn" trong code sample trên khi viết file thật).
- Kiểm tra cuối: `grep -r "TRIBULATION_ENEMY\|FoundationResolver\|craftBreakthroughToken\|BreakthroughRequirement" src/` phải sạch (trừ comment lịch sử không ảnh hưởng compile).
