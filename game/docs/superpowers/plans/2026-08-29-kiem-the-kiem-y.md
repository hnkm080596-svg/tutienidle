# Kiếm Thế / Kiếm Ý — Hệ Tài Nguyên 2 Route Kiếm Tu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chốt route Kiếm Tu vĩnh viễn lúc chọn path (tram Lv3), đưa 2 tài nguyên mới (Kiếm Thế pool trận cho Kiếm Trận; Kiếm Ý tầng vĩnh viễn + pool tạm cho Bạt Kiếm), mỗi route 1 active skill duy nhất, 2 ult manual, chuyển skill cũ thành node, gỡ Nộ.

**Architecture:** Mô hình theo các hệ resource hiện có: pool combat trên `CombatEntity` + MAX constant trong `CombatTypes.ts` (pattern hoaThe/kimThe), tick trong 1 system riêng (`KiemTuResourceSystem.ts` pattern `PhapTuBattleResourceSystem.ts`), tầng vĩnh viễn qua counter PlayerData (pattern `totalCultivationGained`), node data trong `KiemTuNodes.ts`. Route chốt trong `chooseCultivationPath`. Ult là action manual mới ngoài scheduler.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Phaser + Vitest (không dependency mới).

**Spec:** `game/docs/superpowers/specs/2026-08-29-kiem-the-kiem-y-design.md` (worktree `.agent-worktrees/kiem-the-kiem-y`)

## Global Constraints

- Tất cả đường dẫn tính từ `game/` trong task worktree `.agent-worktrees/kiem-the-kiem-y`.
- Dev phase: KHÔNG migration save — bump thẳng `CURRENT_SAVE_VERSION` 52 → 53, save cũ bị từ chối ("incompatible") là hành vi đúng.
- Tiếng Việt cho mọi UI text/label node; comment code theo convention hiện tại (giải thích "tại sao", dẫn file:line).
- TUYỆT ĐỐI không node nào chỉnh `tickSeconds` của channel (constraint KiemTuNodes.ts:18-33).
- On-hit chạy qua ModifierSystem/StatBlock + damage pipeline hiện có — không hack sát thương trực tiếp.
- Hằng số khởi điểm (đánh dấu "tinh chỉnh playtest" trong comment): MAX_KIEM_THE=100, KIEM_THE_PER_ULT_SWORD=10, KIEM_Y_PER_TIER=10, boss tầng 1 = 10 / +5 mỗi tầng, KKTM ngưỡng auto 500, overkill tràn 50%, hồi sinh 100 kiếm ý / 50% HP, base BKT `0.6+0.02×tầng`, AMP 0.3.
- Lệnh test: `npm.cmd run test -- src/<file>` (vitest single file), type-check: `npm.cmd run type-check`, build: `npm.cmd run build`.
- Không dùng `any`.

---

### Task 1: Hằng số + CombatEntity fields (Kiếm Thế, Kiếm Ý tạm)

**Files:**
- Modify: `src/core/combat/CombatTypes.ts`
- Modify: `src/core/combat/CombatEntity.ts:42-60`
- Test: `src/core/combat/CombatEntity.kiemTuResource.test.ts` (create)

**Interfaces:**
- Produces: `MAX_KIEM_THE = 100`, `MAX_KIEM_Y_TEMP_CAP = 900` (cap tạm, chưa cộng vĩnh viễn), `KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT = 5` (1 kiếm ý mỗi 5% maxHP mất), `currentKiemThe: number`, `currentKiemYTemp: number`, `kiemYPerTier = 10` (export từ `KiemYSystem` — Task 4). CombatEntity gain 2 pool field mới, khởi tạo 0.

- [ ] **Step 1: Viết test fail**

```typescript
// src/core/combat/CombatEntity.kiemTuResource.test.ts
import { describe, expect, it } from 'vitest'
import { MAX_KIEM_THE, MAX_KIEM_Y_TEMP_CAP } from './CombatTypes'

describe('Kiếm Tu resource constants + CombatEntity fields', () => {
  it('MAX_KIEM_THE = 100, MAX_KIEM_Y_TEMP_CAP = 900', () => {
    expect(MAX_KIEM_THE).toBe(100)
    expect(MAX_KIEM_Y_TEMP_CAP).toBe(900)
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npm.cmd run test -- src/core/combat/CombatEntity.kiemTuResource.test.ts`
Expected: FAIL — import MAX_KIEM_THE không tồn tại.

- [ ] **Step 3: Implement**

`src/core/combat/CombatTypes.ts` — thêm sau `MAX_HUYET_PHA` (giữ comment giải thích nguồn gốc spec):

```typescript
// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y) — route Kiếm
// Trận: pool KIEM THE trong trận, reset mỗi trận, tích = số kiếm/cast.
// Route Bạt Kiếm: KIEM Y tạm (cap cứng 900 cộng thêm lên nền vĩnh
// viễn đầu trận, xem KiemTuResourceSystem), vĩnh viễn KHÔNG nằm đây.
export const MAX_KIEM_THE = 100
export const MAX_KIEM_Y_TEMP_CAP = 900

// +1 Kiếm Ý tạm mỗi lần mất 5% maxHP (spec mục 3.2 — "tinh chỉnh
// playtest").
export const KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT = 5
```

`src/core/combat/CombatEntity.ts` — trong interface, cạnh `currentSwordIntent` (khoảng line 51): thêm `currentKiemThe: number` và `currentKiemYTemp: number` với comment dẫn spec; trong phần khởi tạo entity (nơi gán `currentSwordIntent = 0`): gán cả 2 field = 0. Grep `currentSwordIntent =` trong file để tìm mọi vị trí gán runtime (spawn/reset) và thêm 2 gán tương ứng cạnh mỗi chỗ.

- [ ] **Step 4: Chạy test pass**

Run: `npm.cmd run test -- src/core/combat/CombatEntity.kiemTuResource.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/combat/CombatTypes.ts src/core/combat/CombatEntity.ts src/core/combat/CombatEntity.kiemTuResource.test.ts
git commit -m "feat(kiem-tu): add Kiếm Thế / Kiếm Ý temp pools on CombatEntity + MAX constants"
```

---

### Task 2: KiemTuResourceSystem — gain/tick/tiêu hao (temp-first)

**Files:**
- Create: `src/core/battle/KiemTuResourceSystem.ts`
- Test: `src/core/battle/KiemTuResourceSystem.test.ts`

**Interfaces:**
- Consumes: `CombatEntity` fields Task 1, `KiemTuRoute` (`src/core/player/Player.ts:19`), `getKiemTuRoute` injection pattern (`BattleSystem.ts:254`).
- Produces:
  - `initKiemTuBattleResources(player: CombatEntity, route: KiemTuRoute | undefined, kiemYPermanent: number): void` — reset Kiếm Thế=0; Kiếm Ý tạm = vĩnh viễn (BK) hoặc 0.
  - `gainKiemTheOnFormationCast(player: CombatEntity, swordCount: number): void` — `currentKiemThe = min(MAX_KIEM_THE, +swordCount)`.
  - `gainKiemYTempOnChannelTick(player: CombatEntity, amount = 1): void`
  - `gainKiemYTempOnDamageTaken(player: CombatEntity, maxHpPercentLost: number): void` — `+floor(maxHpPercentLost / 5)`.
  - `kiemTheDamageBonusPercent(currentKiemThe: number): number` — `currentKiemThe / 2` (điểm %) → dùng như `skillDamagePercent` modifier (1% mỗi 2 điểm, đầy 100 = 50).
  - `consumeKiemYTempFirst(entity: CombatEntity, amount: number, kiemYPermanent: number): boolean` — ăn tạm trước, dư mới tính "không đủ" (vĩnh viễn bất khả xâm phạm). Luật: tổng sẵn có = `currentKiemYTemp + kiemYPermanent`; đủ → trừ vào tạm trước.
  - `kiemYTempMaxFor(kiemYPermanent: number): number` — `kiemYPermanent + MAX_KIEM_Y_TEMP_CAP`.

- [ ] **Step 1: Viết test fail** — cover: gainKiếmThế cap 100 (+2, +3…); init reset + Kiếm Ý tạm = vĩnh viễn; consume temp-first (ví dụ spec: 10 vĩnh viễn + 90 tạm, tốn 100 → mất 90 tạm giữ 10; tốn 101 → false không trừ gì); damage-taken gain (mất 12% maxHP = +2); buff Kiếm Thế (0→0%, 100→50%).

```typescript
// src/core/battle/KiemTuResourceSystem.test.ts
import { describe, expect, it } from 'vitest'
import { MAX_KIEM_THE } from '../combat/CombatTypes'
import {
  consumeKiemYTempFirst,
  gainKiemTheOnFormationCast,
  gainKiemYTempOnChannelTick,
  gainKiemYTempOnDamageTaken,
  initKiemTuBattleResources,
  kiemTheDamageBonusPercent,
  kiemYTempMaxFor,
} from './KiemTuResourceSystem'
import type { CombatEntity } from '../combat/CombatEntity'

function makeEntity(): CombatEntity {
  return { currentKiemThe: 0, currentKiemYTemp: 0 } as CombatEntity
}

describe('KiemTuResourceSystem', () => {
  it('gain Kiếm Thế theo số kiếm cast, cap 100', () => {
    const e = makeEntity()
    gainKiemTheOnFormationCast(e, 2)
    expect(e.currentKiemThe).toBe(2)
    gainKiemTheOnFormationCast(e, 3)
    expect(e.currentKiemThe).toBe(5)
    for (let i = 0; i < 40; i++) gainKiemTheOnFormationCast(e, 3)
    expect(e.currentKiemThe).toBe(MAX_KIEM_THE)
  })

  it('init: KT reset Kiếm Thế; BK khởi đầu Kiếm Ý tạm = vĩnh viễn', () => {
    const kt = makeEntity()
    initKiemTuBattleResources(kt, 'kiem_tran', 0)
    expect(kt.currentKiemThe).toBe(0)
    const bk = makeEntity()
    initKiemTuBattleResources(bk, 'bat_kiem', 30)
    expect(bk.currentKiemYTemp).toBe(30)
  })

  it('consume ăn tạm trước, vĩnh viễn bất khả xâm phạm', () => {
    const e = makeEntity()
    e.currentKiemYTemp = 90
    expect(consumeKiemYTempFirst(e, 100, 10)).toBe(true)
    expect(e.currentKiemYTemp).toBe(0)
    // đủ 90 tạm + 10 vĩnh viễn nhưng tốn 101 → KHÔNG trừ gì
    const e2 = makeEntity()
    e2.currentKiemYTemp = 90
    expect(consumeKiemYTempFirst(e2, 101, 10)).toBe(false)
    expect(e2.currentKiemYTemp).toBe(90)
  })

  it('damage taken gain: 12% maxHP mất = +2 Kiếm Ý', () => {
    const e = makeEntity()
    gainKiemYTempOnDamageTaken(e, 0.12)
    expect(e.currentKiemYTemp).toBe(2)
  })

  it('channel tick +1 Kiếm Ý, cap = vĩnh viễn + 900', () => {
    const e = makeEntity()
    initKiemTuBattleResources(e, 'bat_kiem', 10)
    for (let i = 0; i < 1000; i++) gainKiemYTempOnChannelTick(e)
    expect(e.currentKiemYTemp).toBe(kiemYTempMaxFor(10))
  })

  it('buff sát thương Kiếm Thế: 0 điểm = 0%, 100 điểm = 50%', () => {
    expect(kiemTheDamageBonusPercent(0)).toBe(0)
    expect(kiemTheDamageBonusPercent(100)).toBe(50)
    expect(kiemTheDamageBonusPercent(50)).toBe(25)
  })
})
```

- [ ] **Step 2: Chạy test verify fail** — Run: `npm.cmd run test -- src/core/battle/KiemTuResourceSystem.test.ts` — Expected FAIL (module chưa tồn tại).

- [ ] **Step 3: Implement** `src/core/battle/KiemTuResourceSystem.ts` — export đầy đủ 7 hàm ở Interfaces, mỗi hàm 3-6 dòng thuần, comment dẫn spec mục. `gainKiemYTempOnChannelTick` cap qua `kiemYTempMaxFor` — nhưng pool cần biết vĩnh viễn: hàm nhận thêm tham số `kiemYPermanent: number = 0` (đừng đọc từ ngoài — CombatEntity không giữ vĩnh viễn). Sửa signature ở Interfaces và test tương ứng: `gainKiemYTempOnChannelTick(e, 10)`.

- [ ] **Step 4: Chạy test pass** — Run như trên, expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/battle/KiemTuResourceSystem.ts src/core/battle/KiemTuResourceSystem.test.ts
git commit -m "feat(kiem-tu): KiemTuResourceSystem — Kiếm Thế gain/cap, Kiếm Ý temp-first consume, damage-bonus"
```

---

### Task 3: Kiếm Ý vĩnh viễn — boss kill counter + tầng (KiemYSystem)

**Files:**
- Create: `src/core/player/KiemYSystem.ts`
- Modify: `src/core/player/Player.ts` (PlayerData + createDefaultPlayer)
- Test: `src/core/player/KiemYSystem.test.ts`

**Interfaces:**
- Consumes: `Enemy.isBoss/isElite` (`src/core/enemy/Enemy.ts:104,184`), tribulation battle detection (`battle.mode === 'tribulation'`).
- Produces:
  - `KiemYSystem.TIER_1_BOSS_KILLS = 10`, `TIER_STEP_BOSS_KILLS = 5` — tầng N cần `10 + 5×(N-1)` boss cộng dồn.
  - `getKiemYTier(bossKillCount: number): number` — tầng cao nhất đạt được với số boss hiện có (công thức cộng dồn: threshold(t) = 10 + Σ5 = t1:10, t2:25, t3:45, t4:70 — mỗi bậc +5 so với bậc trước, threshold(tN) = 10 + 5×(N-1) tích lũy: dùng vòng lặp hoặc công thức closed form `threshold(N) = 10N + 5×N(N-1)/2`).
  - `getKiemYPermanent(bossKillCount: number): number` — `10 × tier` (KIEM_Y_PER_TIER = 10).
  - `getKiemYDamageMultipliers(tier: number): { skillDamagePercent: number; criticalRate: number; criticalDamage: number }` — thay SwordIntentSystem cũ: `0.005 × tier` mỗi loại (giữ cùng mức 0.5%/tầng như tier cũ để không quá mạnh).
  - `PlayerData.bossKillCount: number` (default 0 — explicit key trong createDefaultPlayer theo pattern `totalCultivationGained`).

- [ ] **Step 1: Viết test fail**

```typescript
// src/core/player/KiemYSystem.test.ts
import { describe, expect, it } from 'vitest'
import { getKiemYPermanent, getKiemYTier } from './KiemYSystem'

describe('KiemYSystem — tầng kiếm ý vĩnh viễn theo boss diệt', () => {
  it('tầng 0 khi chưa diệt boss nào', () => {
    expect(getKiemYTier(0)).toBe(0)
    expect(getKiemYPermanent(0)).toBe(0)
  })
  it('tầng 1 tại 10 boss, tầng 2 tại 25, tầng 3 tại 45 (chi phí tăng dần)', () => {
    expect(getKiemYTier(9)).toBe(0)
    expect(getKiemYTier(10)).toBe(1)
    expect(getKiemYTier(24)).toBe(1)
    expect(getKiemYTier(25)).toBe(2)
    expect(getKiemYTier(45)).toBe(3)
    expect(getKiemYTier(70)).toBe(4)
  })
  it('+10 Kiếm Ý vĩnh viễn mỗi tầng', () => {
    expect(getKiemYPermanent(25)).toBe(20)
    expect(getKiemYPermanent(45)).toBe(30)
  })
})
```

- [ ] **Step 2: Verify fail** — Run: `npm.cmd run test -- src/core/player/KiemYSystem.test.ts` — FAIL.

- [ ] **Step 3: Implement**

`KiemYSystem.ts` — 3 hàm thuần + hằng số, comment dẫn spec mục 3.1, closed-form threshold loop:

```typescript
const TIER_1_BOSS_KILLS = 10
const TIER_STEP_BOSS_KILLS = 5

export function getKiemYTier(bossKillCount: number): number {
  // threshold(N) cộng dồn: 10, 25, 45, 70... = 10N + 5×N(N-1)/2
  let tier = 0
  while (bossKillCount >= 10 * (tier + 1) + (5 * (tier + 1) * tier) / 2) tier++
  return tier
}
```

`Player.ts` — trong `PlayerData` (sau `totalCultivationGained` line ~116) thêm:

```typescript
  /** Tổng số boss/elite đã diệt vĩnh viễn — nguồn tầng Kiếm Ý (spec
   * 2026-08-29-kiem-the-kiem-y mục 3.1). */
  bossKillCount: number
```

Trong `createDefaultPlayer()` thêm `bossKillCount: 0,` (cùng khối các default khác).

- [ ] **Step 4: Verify pass** — Run test — PASS. Sau đó `npm.cmd run type-check` — có thể lộ các chỗ thiếu field (save load) — fix theo compiler.

- [ ] **Step 5: Commit**

```bash
git add src/core/player/KiemYSystem.ts src/core/player/KiemYSystem.test.ts src/core/player/Player.ts
git commit -m "feat(kiem-tu): KiemYSystem — boss-kill tiers (10+5x cumulative), +10 permanent Kiếm Ý per tier, PlayerData.bossKillCount"
```

---

### Task 4: Route chốt vĩnh viễn + gỡ setKiemTuRoute — GameManager

**Files:**
- Modify: `src/core/game/GameManager.ts:993-1129`
- Modify: `src/core/player/CultivationPathKit.ts:91-97`
- Test: `src/core/game/GameManager.kiemTuRouteLock.test.ts` (create)

**Interfaces:**
- Consumes: `getHuyKiemLevelForCasts` (`SkillSystem.ts:32`), kit `skillIds` tuple hiện tại.
- Produces:
  - `chooseCultivationPath('kiem_tu', player)` — sau grant kit hiện có: đọc `player.skillCastCounts['tram']` (hoặc skillInstance totalExperience) xác định `huyKiemLevel ≥ 3` → route = `'bat_kiem'`, else `'kiem_tran'`; gán `player.kiemTuRoute = route`; trang bị đúng 1 skill: KT → `equipToSlot('kiem_tran_luong_nghi', 0)`; BK → `equipToSlot('bat_kiem_thuat', 0)`; đồng thời **tháo `tram` khỏi loadout** (`skillSystem.unequipFromAllSlots('tram')` hoặc API tương đương — check `SkillManager`), khóa `tram` không cho re-equip (check `setSkillLoadoutSlot`/`equipToSlot` gate).
  - Xóa hàm `setKiemTuRoute` + mọi caller (grep `setKiemTuRoute` toàn repo: stores, UI panels, tests).
  - KT route: gỡ auto-equip `KIEM_TRAN_SLOT_INDEX` (slot 4) trong `purchaseNode` (GameManager.ts:814-820) — kiếm trận giờ ở slot 0 tiến hóa thay thế, không còn slot riêng.

- [ ] **Step 1: Viết test fail** — test 2 nhánh route + việc tháo tram:

```typescript
// src/core/game/GameManager.kiemTuRouteLock.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'

// pattern setup giống GameManager.phapTuEarthPath.test.ts — đọc file đó
// để copy fixture đúng (gameManager singleton, player default, learn tram)
```

Test cases (viết đầy đủ theo pattern file test GameManager hiện có — xem `GameManager.phapTuEarthPath.test.ts` cho setup chuẩn):
1. `tram < Lv3` (cast counts 999) → choose kiem_tu → `player.kiemTuRoute === 'kiem_tran'`, slot 0 = `kiem_tran_luong_nghi`, tram không còn trong bất kỳ loadout slot.
2. `tram ≥ Lv3` (totalExperience 10000) → choose kiem_tu → `player.kiemTuRoute === 'bat_kiem'`, slot 0 = `bat_kiem_thuat`, tram tháo khỏi loadout.
3. Gọi `setKiemTuRoute` (nếu còn) → TypeError/undefined — sau khi xóa hàm, test chỉ assert `typeof (gm as never as { setKiemTuRoute?: unknown }).setKiemTuRoute === 'undefined'`.
4. Chọn `phap_tu` → `kiemTuRoute` vẫn undefined (không đụng).

- [ ] **Step 2: Verify fail** — Run: `npm.cmd run test -- src/core/game/GameManager.kiemTuRouteLock.test.ts` — FAIL (hành vi mới chưa có).

- [ ] **Step 3: Implement**

`GameManager.chooseCultivationPath` — sau khối `if (kit.skillIds)` hiện có, thêm nhánh kiem_tu route lock (code thật):

```typescript
    // Kiếm Thế / Kiếm Ý (spec 2026-08-29 mục 1) — route chốt VĨNH VIỄN
    // đúng lúc chọn path: Huy Kiếm (tram) đã đạt Lv3 (10.000 lần trảm)
    // → Bạt Kiếm; chưa → Kiếm Trận. KHÔNG còn API đổi route sau này.
    if (pathId === 'kiem_tu') {
      const tramCasts = player.skillCastCounts?.['tram'] ?? 0
      const route: KiemTuRoute = tramCasts >= HUY_KIEM_L3_CASTS ? 'bat_kiem' : 'kiem_tran'

      player.kiemTuRoute = route

      // Mỗi route ĐÚNG 1 active skill duy nhất (spec mục 5) — tháo bộ 3
      // skill kit cũ khỏi loadout, trang bị skill route vào slot 0.
      this.skillSystem.unequipFromAllSlots('tram')
      this.skillSystem.unequipFromAllSlots('ngu_kiem_thuat')
      this.skillSystem.unequipFromAllSlots('kiem_khai_thien_mon')
      this.skillSystem.unequipFromAllSlots('van_kiem_trieu_tong')

      if (route === 'bat_kiem') {
        // Bạt Kiếm Ấn mở sẵn skill (route đã đủ điều kiện từ chính tram)
        this.learnSkill('bat_kiem_thuat')
        this.skillSystem.equipToSlot('bat_kiem_thuat', 0)
      } else {
        this.purchaseNode('kiem_tran_luong_nghi', player) // root cost 0
        this.skillSystem.equipToSlot('kiem_tran_luong_nghi', 0)
      }
    }
```

Lưu ý kỹ thuật:
- Import `KiemTuRoute` type từ `../player/Player` và `HUY_KIEM_L3_CASTS = 10000` export từ `SkillSystem.ts` (thêm hằng số nếu chưa có — hiện hardcode trong `getHuyKiemLevelForCasts`).
- Check `SkillManager` có `unequipFromAllSlots` không; nếu không có, thêm method nhỏ (grep `unequip` trong `src/core/skill/SkillManager.ts`). Fallback: lặp 5 slot gọi API unequip sẵn có.
- Khóa tram re-equip: trong `SkillManager.setSkillLoadoutSlot`/`equipToSlot`, thêm guard: nếu `player.cultivationPath === 'kiem_tu' && skillId === 'tram'` → return false. Cần truy cập player — nếu SkillManager không có player, thực hiện guard ở GameManager wrappers (`equipToSlot` gọi qua GameManager). Ưu tiên guard trong `GameManager.purchaseNode` equip + UI gate (RadialSkillSelector đã filter theo loadout realm gate — check `CombatSkillPresentation.ts:123` pattern exempt).
- Trong `purchaseNode` (GameManager.ts:814-820): xóa khối auto-equip slot `KIEM_TRAN_SLOT_INDEX` (slot 4) — thay comment: "Kiếm trận tiến hóa slot 0 (spec mục 5.1), keystone mới mua tự `equipToSlot(skillId, 0)` thay thế skill trận cũ". Thêm logic: nếu `skillId.startsWith('kiem_tran_')` → `equipToSlot(skillId, 0)`.

`CultivationPathKit.ts` — kiem_tu kit: bỏ `skillIds` (skill giờ qua route lock), giữ techniqueId/element. Xóa comment cũ về 3-skill tuple.

- [ ] **Step 4: Verify pass** — Run test file mới + full: `npm.cmd run test` — mọi test cũ liên quan setKiemTuRoute/bat_kiem equip đã cập nhật theo. `npm.cmd run type-check`.

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat(kiem-tu): permanent route lock at chooseCultivationPath — tram Lv3 gates bat_kiem; 1 active skill per route at slot 0"
```

---

### Task 5: BattleSystem wiring — gain/giải phóng resource + nerf BKT + gỡ rage

**Files:**
- Modify: `src/core/battle/BattleSystem.ts` (nhiều vị trí)
- Modify: `src/core/skill/SkillTypes.ts:32-37` (gỡ 'rage')
- Modify: `src/core/skill/SkillSystem.ts` (hasEnoughResource/consumeResource gỡ rage + thêm 'kiem_the'/'kiem_y')
- Test: `src/core/battle/BattleSystem.kiemTuResources.test.ts` (create)

**Interfaces:**
- Consumes: Task 1-2 exports; `updateChanneling` (BattleSystem.ts:2519); `resolveChannelTick` (2604); `onEntityVitalsChanged` (269); `BAT_KIEM_AMP_PER_DAMAGE_TAKEN` (148).
- Produces:
  - `SkillResourceType = 'none' | 'mana' | 'sword_intent' | 'momentum' | 'kiem_the' | 'kiem_y'` (gỡ 'rage'; 'sword_intent' tạm giữ key cho KS consumer chưa đổi — Task 8 đổi xong sẽ gỡ).
  - BattleSystem ctor: `getKiemYPermanent: () => number` injection (giống `getKiemTuRoute` line 254) — GameManager truyền `() => getKiemYPermanent(this.activePlayer?.bossKillCount ?? 0)`.
  - `battle.start()`/`startTribulation()`: gọi `initKiemTuBattleResources(player, getKiemTuRoute(), getKiemYPermanent())` cạnh `initChannelState`.
  - `updateChanneling` mỗi tick (trước resolveChannelTick): `gainKiemYTempOnChannelTick(player, getKiemYPermanent())`.
  - `onEntityVitalsChanged` (nhánh HP giảm của player đang tuLucActive): cạnh logic amp hiện có, thêm `gainKiemYTempOnDamageTaken(player, (hpBefore-hpAfter)/maxHp)` — mở rộng ngoài tuLucActive: áp MỌI khi route BK (spec 3.2 gain theo dmg nhận, không giới hạn channel).
  - Cast kiếm trận (scheduler/beginPlayerCast đường `attack_speed` cho skill `kiem_tran_*`): sau resolve thành công → `gainKiemTheOnFormationCast(player, swordCount)` — swordCount lấy từ TRAN_SEQUENCE lookup (export helper `getFormationSwordCount(skillId): number | undefined` từ `KiemTuNodes.ts`).
  - Nerf BKT (spec 3.4): `resolveChannelTick` — thay `tickLengthBonus + damageTakenPercent × BAT_KIEM_AMP_PER_DAMAGE_TAKEN` bằng `× 0.3` (đổi hằng số `BAT_KIEM_AMP_PER_DAMAGE_TAKEN = 0.3`); thêm base theo tầng: damage effect value nhân `0.6 + 0.02 × kiemYTier` — thực hiện qua modifier snapshot quanh `resolveSkillEffects` (pattern finalDamagePercent snapshot hiện có): `const tierMult = 0.6 + 0.02 * getKiemYTier(bossKillCount)`… nhưng getKiemYTier cần bossKillCount — inject cùng `getKiemYPermanent` (từ đó suy tier). Hấp thụ Huy Kiếm: trong `getEffectiveSkill` nhánh isBatKiem mới — cộng `getHuyKiemFlatDamageBonus(totalExperienceOfTram)` — cần tram totalExperience: inject `getTramTotalExperience: () => number` (GameManager: skillManager.get('tram')?.totalExperience ?? 0).
  - Buff Kiếm Thế (KT route): trong `resolveSkillEffects` hoặc pre-scheduler: nếu route KT → cộng `kiemTheDamageBonusPercent(player.currentKiemThe)` vào `finalDamagePercent` snapshot (cùng pattern amp BKT).
  - Gỡ rage: xóa `currentRage` khỏi CombatEntity, `MAX_RAGE` khỏi CombatTypes, `'rage'` khỏi SkillResourceType; grep `rage|MAX_RAGE|currentRage` toàn src + tests, cập nhật CombatStatusBar (bar rage → hiển thị Kiếm Thế/Kiếm Ý tạm theo route — chi tiết UI Task 8, ở đây chỉ gỡ nhánh rage khỏi `resourceCurrent`), fix mọi test dùng rage.

- [ ] **Step 1: Viết test fail** — cases:
  1. Cast Lưỡng Nghi (route KT) → `currentKiemThe` +2; 50 cast Tam Tài từ 0 → cap 100.
  2. Tick channel BK → kiếm ý tạm +1/tick, cap vĩnh viễn+900.
  3. Player BK nhận 12% maxHP damage → +2 kiếm ý tạm (kể cả khi tuLucActive).
  4. Nerf: amp damage-taken giờ ×0.3 (không còn ×1.0); base tier 0 = 60%.
  5. `hasEnoughResource` skill resourceType `'kiem_y'` cost 100, entity 90 tạm + 10 vĩnh viễn → true, sau consume temp = 0.
  6. Hấp thụ Huy Kiếm: BKT tick damage gồm `floor(tramCasts/10)` (setup tram totalExperience 10000 → +1000).
  7. Buff Kiếm Thế: KT có 100 kiếm thế → sát thương trận +50%.

```typescript
// pattern setup: đọc src/core/battle/BattleSystem.skillFlow.test.ts hoặc
// CombatSystem.surviveLethal.test.ts để copy cách dựng battle + player
// entity + loadout đúng convention hiện tại của repo.
```

- [ ] **Step 2: Verify fail** — Run: `npm.cmd run test -- src/core/battle/BattleSystem.kiemTuResources.test.ts` — FAIL.

- [ ] **Step 3: Implement** — theo Interfaces trên, từng vị trí một (mỗi vị trí có file:line từ explore phase). Đổi `getKiemTuRoute` injection thêm 3 getter: `getKiemYPermanent`, `getTramTotalExperience` (khuyến nghị gom thành 1 object `KiemTuRuntimeDeps` — nhưng theo ràng buộc "focused changes", nếu gom object đụng quá nhiều call-site thì giữ 3 getter riêng theo pattern `getKiemTuRoute`).

- [ ] **Step 4: Verify pass** — Run test mới + `npm.cmd run test` full (để lộ test cũ break do gỡ rage/setKiemTuRoute — fix từng cái: cập nhật expectation hoặc xóa test đã lỗi thời, mỗi thay đổi phải phản ánh spec mới).

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat(kiem-tu): wire Kiếm Thế/Kiếm Ý into battle — formation-cast gain, channel/damage-taken Kiếm Ý, temp-first consume, BKT nerf (0.6+0.02 tier, amp 0.3), remove rage"
```

---

### Task 6: Ult TTKT + KKTM — skills data + manual action pipeline

**Files:**
- Modify: `src/data/skill/Skills.ts` (thêm 2 ult + gỡ/sửa skill cũ theo spec mục 5)
- Create: `src/core/battle/UltimateSystem.ts`
- Modify: `src/core/battle/BattleSystem.ts` (hook manual ult)
- Test: `src/core/battle/UltimateSystem.test.ts`

**Interfaces:**
- Consumes: Task 2/3 exports; scheduler skip pattern (`case 'channel': return` BattleSystem.ts:1931).
- Produces:
  - Skills.ts: `tru_tien_kiem_tran` (id, name 'Tru Tiên Kiếm Trận', active, maxLevel 1, resourceType `'kiem_the'`, cost dynamic qua helper vì cost = 10×số kiếm: `cost: 20, resourceType: 'kiem_the'` trong data + runtime override `getUltimateCost(skillId, route)`; execution `cooldown`, cooldown 30s ulti; effect damage AoE value scale trận + zone effect `grantsSwordZone`-like với duration 6s tick 1s) và `kiem_khai_thien_mon` (SỬA entry hiện có line 768: resourceType `'kiem_y'`, cost 0-runtime (burn-all), execution cooldown 60s, effect damage đơn mục tiêu + `overkillSplashPercent: 0.5`, `swordIntentDamageRatio: 0.0002` giữ, ưu tiên boss qua targeting hint `preferBossTarget: true`).
  - `UltimateSystem.ts`:
    - `canUseUltimate(battle, route): { ok: boolean; reason?: 'locked' | 'resource' | 'cooldown' }` — TTKT: đủ Kiếm Thế ≥ 10×số kiếm; KKTM: kiếm ý tạm ≥ 500 ngưỡng auto (manual thì chỉ cần >0).
    - `triggerUltimate(battle, route): boolean` — thực thi: TTKT → consume Kiếm Thế, resolve AoE nuke + đặt sword zone 6s; KKTM → đốt TOÀN BỘ kiếm ý tạm (consume-all), tính dmg = base × (1 + burned × 0.0002), resolve đơn mục tiêu (boss ưu tiên), overkill splash 50% chia đều địch còn sống.
    - `autoUltimateDecision(battle, route): 'ttkt' | 'kktm' | null` — TTKT: auto khi đủ cost; KKTM: auto khi battle có boss (enemy isBoss/en elite? — spec: boss/Độ Kiếp) && kiếm ý tạm ≥ 500.
    - Ult KHÔNG nằm trong loadout scheduler (skip như channel).
  - BattleSystem: `tryPlayerUltimate(): boolean` public method (gọi từ UI) + auto-check mỗi update (call `autoUltimateDecision` 1 lần/giây — thêm timer field).
  - Unlock: node ult mới (Task 7 xử lý node data; ở đây skill chỉ tồn tại data, unlock qua `unlocksSkillIds` của node).

- [ ] **Step 1: Viết test fail** — cases theo Interfaces (setup battle pattern Task 5):
  1. TTKT: 0 kiếm thế → canUse false ('resource'); 20 kiếm thế + Lưỡng Nghi → true, trigger consume 20, zone tồn tại 6s (assert qua battle state sword zones), nuke damage > 0.
  2. KKTM: 500 kiếm ý tạm → trigger đốt all (temp = 0 sau, vĩnh viễn giữ nguyên), dmg = base × (1+500×0.0002) = base×1.1 (assert final damage của target boss), overkill: nếu target chết với dư 500 dmg → 250 chia đều 2 địch còn sống.
  3. Auto: boss trong trận + 500 kiếm ý → autoUltimateDecision = 'kktm'; không boss → null dù đủ pool; TTKT auto khi đủ cost bất kể boss.
  4. KKTM ưu tiên boss: 2 địch thường + 1 boss → target = boss.
  5. Cooldown: sau trigger TTKT 30s chưa hết → canUse false 'cooldown'.

- [ ] **Step 2: Verify fail** — Run: `npm.cmd run test -- src/core/battle/UltimateSystem.test.ts` — FAIL.

- [ ] **Step 3: Implement** — UltimateSystem thuần (không depend BattleSystem trực tiếp — nhận Battle interface), resolve damage qua `resolveSkillEffects` tương tự resolveChannelTick (pattern snapshot finalDamagePercent). Zone TTKT: tái dùng cơ chế sword zone hiện có (grep `swordZone` BattleSystem.ts — `updateSwordZones` đã có, chỉ cần spawn zone với duration/tick mới) — nếu cơ chế zone gắn cứng Tam Tài 3 charges thì thêm param duration.

- [ ] **Step 4: Verify pass** — Run test + full suite.

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat(kiem-tu): UltimateSystem — Tru Tiên Kiếm Trận (nuke+zone, Kiếm Thế cost) + Kiếm Khai Thiên Môn (burn-all overkill splash, boss-priority)"
```

---

### Task 7: Node data — on-hit KT + node BK công năng + node chuyển skill cũ

**Files:**
- Modify: `src/data/progression/KiemTuNodes.ts`
- Test: `src/data/progression/KiemTuNodes.test.ts` (extend file hiện có nếu tồn tại — check trước)

**Interfaces:**
- Consumes: `ProgressionNode` shape, `TRAN_SEQUENCE`, stat helper.
- Produces: các node mới theo spec mục 4 + 5.3 + 3.3:
  - **9 on-hit nodes KT** (id `onhit_kiem_khi` … `onhit_kiem_than`, tên/type/desc tiếng Việt, maxLevel 5, insightCost 1, `upgradeCost {base:1, perLevel:2}`, prereq = keystone trận mở node + node on-hit trước nếu cùng trận, effect: field mới `onHitEffect: { kind: OnHitEffectKind, baseChancePercent: 3, perLevelChancePercent: 3 }` — cần mở rộng `ProgressionNode.ts` effect union với type mới `onHitEffect` + `OnHitEffectKind` union 9 loại (khiem_khi_dmg, khiem_phong_haste, xuat_huyet_dot, tran_tru_cc, phan_kich_dodge, hap_linh_leech, pha_giap_pen, quang_crit, than_ngu_hanh)) — gateway theo `TRAN_SEQUENCE[i].swordCount`: node thứ k mở khi trận có ≥ k+1 kiếm... đơn giản hóa: mỗi node khai trực tiếp `prerequisites: [{ kind: 'node', nodeId: 'kiem_tran_tam_tai' }]` theo bảng spec mục 4 (4 node đầu gắn Lưỡng Nghi/Tam Tài — đã reachable; 5 node sau gắn Tứ Tượng+ unreachable realm — data chờ).
  - **Ult unlock nodes**: `kiem_tran_ult_tru_tien` (major, prereq `kiem_tran_tam_tai` + realm `foundation_establishment`, effect `unlocksSkillIds: ['tru_tien_kiem_tran']`); `bat_kiem_ult_khai_thien` (major, prereq `bat_kiem_an`, effect `unlocksSkillIds: ['kiem_khai_thien_mon']`).
  - **Node chuyển skill cũ** (spec 5.3, passive/vĩnh viễn):
    - KT branch: `passive_ngu_kiem_thuat` (tên 'Ngự Kiếm Thuật' — mỗi cast kiếm trận phóng thêm kiếm ứng: effect `onHitEffect`-adjacent — dùng `statModifiers` với stat mới `formationExtraSwords`? — KHÔNG: theo constraint "on-hit qua modifier pipeline", dùng stat tạm trong trận qua `SkillRuntimeStats` key mới `formationSwordBonus` — cần thêm key vào SkillRuntimeStats.ts, precedent hoaTheGainPerCast); `passive_van_kiem_trieu_tong` ('Vạn Kiếm Triều Tông' — cường hóa TTKT: stat key `ultNukeRatioBonus` + `ultZoneSwordCountBonus`).
    - BK branch: `passive_thai_hu_nhat_kiem` (crit/skillDamage theo Thái Hư), `passive_phieu_van_bo` (evasion + attackSpeed), `passive_pha_thien_nhat_kich` (burst vs boss — `bossDamagePercent` stat nếu có sẵn trong StatTypes, check trước; fallback skillDamagePercent + desc riêng), `passive_kiem_tam_lanh_liet` (giữ crit stack — chuyển từ PassiveSystem skill passive hiện có, giữ hiệu ứng, đổi nguồn thành node).
    - **Node công năng kiếm ý BK** (spec 3.3): `bat_kiem_do_don` (tỉ lệ đỡ + hiệu quả đỡ — stat `blockRate`/`blockEffectiveness` nếu có trong StatTypes; check + dùng đúng tên), `bat_kiem_hoi_sinh` (major — mở hồi sinh: flag qua SkillRuntimeStats key `kiemYReviveEnabled` + `kiemYReviveCost` 100), `bat_kiem_amp_hoi_phuc` (AMP_PER_DAMAGE_TAKEN +0.1/level — runtime key `batKiemAmpBonus`), `bat_kiem_uy_kiem_y` (dmg BKT/KKTM ×(1+0.5%×tầng) — thay SwordIntentSystem modifiers, tính từ tier).
  - **Gỡ**: node `bat_kiem_thuc` (keystone gate cũ); BAT_KIEM_ROOT giữ (unlock bat_kiem_thuat); gỡ `unlocksSkillIds` references tới skill đã xóa.
  - **SkillRuntimeStats.ts**: thêm keys `formationSwordBonus`, `ultNukeRatioBonus`, `ultZoneSwordCountBonus`, `batKiemAmpBonus`, `kiemYReviveEnabled`, `kiemYReviveCost` (precedent hoaTheGainPerCast — mỗi key là 1 line + comment).

- [ ] **Step 1: Viết test fail** — data validation test (pattern KiemTuNodes test hiện có — check `src/data/progression/*.test.ts`):
  1. 9 on-hit node: id duy nhất, branchTag 'kiem_tran', maxLevel 5, chancePerLevel 3 tổng 15 max, prereq đúng trận theo bảng spec.
  2. 2 ult unlock node tồn tại với unlocksSkillIds đúng.
  3. Node chuyển skill: 7 node passive tồn tại đúng branch, tên đúng spec.
  4. `bat_kiem_thuc` KHÔNG còn trong KIEM_TU_NODES.
  5. Mọi node có statModifiers/onHitEffect hợp lệ (kind thuộc union).

- [ ] **Step 2: Verify fail** — FAIL.

- [ ] **Step 3: Implement** — data-only + mở rộng ProgressionNode effect union (file `src/core/progression/ProgressionNode.ts` — thêm interface `OnHitEffectConfig` + union member) + SkillRuntimeStats keys. KHÔNG đụng engine runtime ở task này (đó là Task 8), chỉ data + type.

- [ ] **Step 4: Verify pass** — Run data test + type-check (union mới sẽ lộ chỗ cần annotate).

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat(kiem-tu): node data — 9 on-hit formation nodes, 2 ult unlocks, 7 converted-skill passive nodes, Kiếm Ý utility nodes; drop bat_kiem_thuc gate"
```

---

### Task 8: On-hit engine + UI combat (bars, nút Ult, HUD)

**Files:**
- Modify: `src/core/battle/BattleSystem.ts` (on-hit resolution hook)
- Create: `src/core/battle/KiemTranOnHitSystem.ts`
- Modify: `src/components/game/combat/CombatStatusBar.vue:74-148`
- Modify: `src/components/game/combat/CombatControlBar.vue` (nút Ult)
- Modify: `src/components/game/kiem-tu/KiemTuCombatHud.vue` (slot 0 + ult button + gỡ chain slots 1/2/4)
- Modify: `src/components/panels/SkillPathPanel.vue:43-57,177-204` (gỡ toggle branch, gỡ huyKiemHiddenTree)
- Modify: `src/stores/ui.ts` (nếu có state route hiển thị)
- Test: `src/core/battle/KiemTranOnHitSystem.test.ts`

**Interfaces:**
- Consumes: Task 7 node data + onHitEffect config; `CombatSkillPresentation.ts` slot logic.
- Produces:
  - `KiemTranOnHitSystem.resolveOnHitEffects(battle, source, target, damageResult): void` — mỗi node on-hit đã mua (đọc nodeLevels qua injected getter `getOnHitNodeLevels(): Record<nodeId, number>`): roll `chance = 3% × level` mỗi hit; theo kind dispatch qua hệ thống hiện có:
    - `khiem_khi_dmg` → bonus damage component (thêm DamageResult riêng qua pipeline resolveAttack pattern, metal type, value = 0.5×số kiếm).
    - `xuat_huyet_dot` → applyAilment 'van_kiem_vu' (tái dùng — grep AilmentSystem apply API).
    - `tran_tru_cc` → roll choáng/trói (ailment pool tuỳ — dùng ailment sẵn 'troi_chan'/'choang').
    - `khiem_phong_haste`/`phan_kich_dodge`/`hap_linh_leech`/`pha_giap_pen`/`quang_crit` → stat modifier tạm (buff stack trong trận qua BuffSystem precedent — `apply(enrage.buff)` pattern line 1049).
    - `than_ngu_hanh` → elemental rotation — damage component theo element xoay vòng (hitCount % 5).
  - Hook điểm: trong BattleSystem tại mọi resolve hit của skill `kiem_tran_*` + TTKT nuke/zone tick — tìm điểm duy nhất: sau `resolveSkillEffects` cho các skill này, lặp target hit; 1 call site duy nhất wrapper `resolveFormationSkillEffects(...)` (refactor nhỏ: bọc resolveSkillEffects, nếu skill là kiếm trận/ult TTKT → resolve on-hit cho mỗi target).
  - UI CombatStatusBar: KT route → bar 3 = Kiếm Thế (currentKiemThe/100, label 'Kiếm Thế'); BK route → bar 3 = Kiếm Ý tạm (currentKiemYTemp / kiemYTempMaxFor(perm), label 'Kiếm Ý' + badge tầng `T.x`). Gỡ nhánh Rage/usesSwordIntent cũ (rage đã chết Task 5; usesSwordIntent kỹ thuật 'ngu_kiem' flag giờ route BK hiển thị kiếm ý —統 nhất theo route thay vì technique flag).
  - CombatControlBar: nút `Ult` (disabled khi !canUseUltimate) — click → `gameManager.getBattle()?.tryPlayerUltimate()`; toggle auto (default on TTKT, off KKTM — KKTM auto là AI quyết, toggle cho phép tắt); label tên ult theo route; hiển thị khi route có ult skill đã learn (check skillManager.has('tru_tien_kiem_tran') / ('kiem_khai_thien_mon')).
  - KiemTuCombatHud: gỡ chain-slot rendering 1/2/4 (chỉ còn slot 0 + ult button khu vực riêng); giữ Tụ Lực bar BK.
  - SkillPathPanel: gỡ `kiemTuBranch` ref + toggle buttons (lines 43-57, 177-189) — `treeBranchTag` cố định theo `player.kiemTuRoute`; gỡ block `huyKiemHiddenTreeOpen` (199-204) + computed (145-147) — cây ẩn chết theo spec mục 1.

- [ ] **Step 1: Viết test fail** — `KiemTranOnHitSystem.test.ts`:
  1. Node Lv0 → không roll; Lv5 → 15% (mock Math.random = 0.14 → proc, 0.16 → không).
  2. `xuat_huyet_dot` proc → target có ailment van_kiem_vu.
  3. `khiem_khi_dmg` proc → damage component kim value = 0.5 × swordCount.
  4. On-hit áp khi TTKT zone tick resolve (test qua wrapper call).
  5. `hap_linh_leech` proc → source heal = % leech × damage.

- [ ] **Step 2: Verify fail** — FAIL.

- [ ] **Step 3: Implement** — engine + UI theo Interfaces. UI changes (Vue) không có unit test riêng (repo không có component test setup) — verify bằng type-check + build + test suite; hiển thị đúng kiểm tra bằng mắt ở dev run (nếu scope session cho phép).

- [ ] modify Step: **Chạy full verification** — `npm.cmd run test`, `npm.cmd run type-check`, `npm.cmd run build` — fix mọi lỗi.

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat(kiem-tu): on-hit engine via modifier pipeline + combat UI — Kiếm Thế/Kiếm Ý bars, Ult button with auto toggle, single-branch SkillPathPanel"
```

---

### Task 9: Save v53 + dọn mồ côi + docs

**Files:**
- Modify: `src/services/save/saveVersion.ts` (52 → 53)
- Modify: `src/services/save/SaveSystem.ts` (comment block v53)
- Modify: `src/services/save/saveShapeValidation.ts` (nếu có player shape list — thêm `bossKillCount`)
- Modify: `src/core/player/SwordIntentSystem.ts` — XÓA file (gỡ tier tu-vi cũ) + xóa import `getSwordIntentModifiers` khỏi `src/stores/player.ts:25,52` (thay bằng `getKiemYDamageMultipliers` từ KiemYSystem nếu chưa làm ở Task 3 — gộp modifier vào finalStats: chỉ áp khi `cultivationPath === 'kiem_tu' && route bat_kiem`).
- Modify: `src/data/technique/Techniques.ts:118` — gỡ `usesSwordIntentResource` flag nếu không còn consumer (grep trước khi xóa).
- Modify: gỡ `passive_kiem_tam_lanh_liet` khỏi PassiveSystem skills nếu chuyển node (Task 7 đã thêm node — ở đây gỡ data cũ khỏi Skills.ts nếu chưa gỡ ở Task 6 Step 3; nếu đã gỡ bỏ qua).
- Modify: `game/docs/game-guide.md` — cập nhật mô tả Kiếm Tu theo spec (route chốt, 2 tài nguyên, ult) — mục "Kiếm Tu" hiện có.
- Modify: `game/docs/roadmap.md` — thêm 1 dòng status phase 3 (route chốt + resource shipped).

**Interfaces:**
- Consumes: mọi task trước.
- Produces: save v53 với `bossKillCount` trong player shape; docs đồng bộ.

- [ ] **Step 1: Bump version + shape** — `CURRENT_SAVE_VERSION = 53 as const` + comment block theo precedent v52 (SaveSystem.ts gần dòng version comments):

```typescript
// v53 (2026-08-29, kiem-the-kiem-y spec): PlayerData.bossKillCount
// (tầng Kiếm Ý vĩnh viễn), kiemTuRoute giờ chốt vĩnh viễn lúc chọn
// path, gỡ skill kiem-tu cũ khỏi save shape (chuyển thành node),
// gỡ currentRage/rage resource. Save v52 bị từ chối (dev phase,
// không migration).
```

- [ ] **Step 2: Xóa SwordIntentSystem + mọi reference** — grep `SwordIntent|getSwordIntentModifiers|usesSwordIntentResource` toàn src — xóa/đổi từng chỗ (bar UI đã đổi Task 8; store modifier đổi Task 3 hoặc đây).

- [ ] **Step 3: Chạy full verification** — `npm.cmd run test` (expect: mọi test pass; các test SwordIntentSystem cũ bị XÓA cùng file), `npm.cmd run type-check`, `npm.cmd run build`.

- [ ] **Step 4: Docs** — game-guide.md mục Kiếm Tu + roadmap dòng phase 3.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(kiem-tu): save v53 (bossKillCount, route lock), remove SwordIntentSystem/rage leftovers, docs sync"
```

---

## Verification Checklist (chạy ở Task 9 cuối + báo cáo)

- `npm.cmd run test` — full suite pass (193+ files, số test tăng theo task mới)
- `npm.cmd run type-check` — pass
- `npm.cmd run build` — pass
- Manual smoke (nếu được): dev run → chọn path Kiếm Tu 2 save (một tram < Lv3, một ≥) → route đúng, slot 0 đúng, bar 3 đúng, ult button hiện đúng route, node tree 1 branch.

## Self-Review Notes (đã kiểm khi viết plan)

1. **Spec coverage:** mục 1 (route chốt) → Task 4; mục 2 Kiếm Thế → Task 1/2/5/8; mục 3 Kiếm Ý (tầng/temp/nerf/ult KKTM) → Task 3/5/6; mục 4 on-hit → Task 7/8; mục 5.1-5.4 (1 skill/route, node chuyển, gỡ nộ) → Task 4/5/7; mục 6 UI → Task 8; mục 7 save → Task 9; mục 8 testing → phân tán mọi task + checklist.
2. **Placeholder scan:** không có TBD/TODO; các đoạn "pattern theo file X" đều kèm đường dẫn cụ thể + mô tả đủ để executor tự copy fixture (deliberate: không paste nguyên 100 dòng setup fixture vì theo DRY của plan giữa các task, mỗi test file task có fixture riêng được mô tả đủ yêu cầu asserts).
3. **Type consistency:** `KiemTuRoute` dùng xuyên suốt từ Player.ts export; hằng số dùng chung (MAX_KIEM_THE v.v.) đều export từ CombatTypes/KiemTuResourceSystem/KiemYSystem đúng tên; `consumeKiemYTempFirst` signature nhất quán Task 2/5/6.
