# Item Grade/Quality Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay 3 trục lấn chiếm trên trang bị (realmId / quality 9 bậc Khí / rarity 5) bằng 2 trục sạch: `grade` (Phẩm 10 = realm 1:1, deterministic) + `quality` (Chất 5, random fixed-weight), rework rèn/tẩy/tinh (slot-level enhance + pity), thống nhất Luyện Khí Tinh Hoa, thêm tab Phân Giải, gate ngang phẩm.

**Architecture:** 6 phase tuần tự — (1) contracts & types mới song song với cũ, (2) drop pipeline + schema, (3) 3 hành động (wash/refine/enhance-slot), (4) tinh hoa + tab Phân Giải, (5) gate + breakthrough, (6) display/theme/dọn chết. Mỗi task TDD, mỗi phase kết thúc bằng full verify.

**Tech Stack:** TypeScript, Vitest, Vue 3 SFC, Pinia; không dependency mới.

**Spec:** `docs/superpowers/specs/2026-09-01-item-grade-quality-model-design.md` (v2.1) — plan lập luận từ spec; executors đọc CẢ HAI file.

> **Trạng thái 2026-09-02:** Phase 1-4 (Task 1-15) đã merge vào master (`fd82ed4`, `3c898b0`, `3647cf7`). File plan này đã bị mất khỏi working tree ở đâu đó giữa các lần squash/merge và được khôi phục nguyên văn từ commit `16fb701` để tiếp tục Phase 5-6 (Task 16-23) — xem `game/docs/roadmap.md` mục "Giai đoạn 7". Line number trong các task dưới đây là snapshot lúc viết plan (2026-09-01) — code đã thay đổi từ đó, executor PHẢI đọc lại file thật trước khi sửa, không tin line number mù quáng.

## Global Constraints

- Không `any`; không dependency mới; không đổi architecture ngoài phạm vi spec.
- **Không migration save** (dev phase). Item cũ schema khác → validation reject/discard có thông báo, không crash.
- Terminology khóa: **Phẩm = 10 bậc (grade, item)** ↔ **Cảnh giới = 10 (realm, nhân vật)**; **Chất = 5 (quality, item)**. Chữ "Phẩm" CẤM xuất hiện trong trục chất.
- Weight chất cố định: `75 / 15 / 8 / 1.99 / 0.01` (tổng = 100 chính xác, test khóa).
- Lượt rèn theo chất: `5 / 10 / 20 / 40 / 80` — ngân sách CHUNG cho tẩy + tinh; chi phí 1/lượt (tinh hoa).
- Enhance: `successRate(L) = max(1%, round(100 × 0.956^(L-1)))`; pity 10 fail liên tiếp = chắc chắn thành công; fail chỉ mất nguyên liệu; cấp gắn SLOT vĩnh viễn (1..100).
- Tinh luyện: chỉ TĂNG, `+U(5%, 20%)` mỗi dòng độc lập, clamp tier range.
- Refine material duy nhất: `luyen_khi_tinh_hoa` (tạo từ Tab Phân Giải + Hóa Luyện).
- Nguồn stat hợp pháp chỉ 3: Tâm Pháp/Trang bị/Buff — không thêm nguồn.
- Verify chuẩn: `npm.cmd run type-check` + focused vitest; full suite cuối mỗi phase; build cuối mỗi phase.
- Ước lượng thời gian mỗi task ≤ 45 phút; vượt → chia nhỏ lại trước khi dispatch.

---

## File Structure Map (mục tiêu cuối)

```
src/core/item/ItemQuality.ts          [MỚI — thay ItemGrade.ts: union 5 chất + label "Chất" + bảng cân bằng mới]
src/core/item/ItemGrade.ts            [XÓA cuối phase 6]
src/core/equipment/ItemGradeRefs.ts   [TẠM phase 1-5 — alias import shim để compile song song, xóa phase 6]
src/core/equipment/EquipmentQuality.ts [XÓA cuối phase 3]
src/core/equipment/EquipmentRarity.ts  [XÓA cuối phase 6]
src/core/equipment/ItemQualityBalance.ts [MỚI — 5 bảng: SUBSTATS_RANGE, FORGE_USES, AFFIX_TIER, UNLOCKED_POOLS, IMPLICIT + DROP_WEIGHT]
src/core/equipment/EquipmentInstance.ts [schema mới: grade, quality, forgeUses*; xóa realmId/rarity/forgePoints/forgePotential]
src/core/equipment/EquipmentSystem.ts   [drop/wash/refine/forge/enhance-slot/pity]
src/core/equipment/EquipmentSlotState.ts [+ enhanceFailStreak]
src/core/equipment/EnhanceCurve.ts     [MỚI — successRate + PITY_THRESHOLD]
src/core/equipment/RefinementBalance.ts [tinh hoa mới, xóa essence 10 + WASH weights cũ]
src/core/profession/ProfessionGrade.ts  [giữ nguyên — nguồn grade; có reverse mapping sẵn]
src/core/equipment/canUseItem.ts        [MỚI — gate]
src/core/production/DecomposeSystem.ts  [MỚI — site phân giải khoáng]
src/components/panels/equipment-hall/   [MỚI — tách 5 tab con: EnhanceTab/WashTab/RefineTab/DissolveTab/DecomposeTab]
src/data/materials/materials.ts         [+ luyen_khi_tinh_hoa; xóa 10 essence]
```

---

## PHASE 1 — Contracts & Types (song song được, không phá runtime)

### Task 1: Tạo `ItemQuality.ts` + `ItemQualityBalance.ts` (contracts mới)

**Files:**
- Create: `game/src/core/item/ItemQuality.ts`
- Create: `game/src/core/equipment/ItemQualityBalance.ts`
- Test: `game/src/core/item/ItemQuality.test.ts`, `game/src/core/equipment/ItemQualityBalance.test.ts`

**Interfaces:**
- Produces (dùng xuyên suốt plan):
  - `type ItemQuality = 'hoang' | 'huyen' | 'dia' | 'thien' | 'tien'` (giữ nguyên 5 giá trị union — chỉ đổi TÊN khái niệm)
  - `ITEM_QUALITY_ORDER: readonly ItemQuality[]` = `['hoang','huyen','dia','thien','tien']`
  - `ITEM_QUALITY_LABELS: Record<ItemQuality, string>` = `{ hoang: 'Hoàng Chất', huyen: 'Huyền Chất', dia: 'Địa Chất', thien: 'Thiên Chất', tien: 'Tiên Chất' }`
  - `composeItemQualityNameSegments(name: string, quality: ItemQuality): NameSegment[]` — colorVar qua `--rank-color-N` (rank = index+1, dùng chung thang màu, KHÔNG `--grade-`)
  - `ITEM_QUALITY_DROP_WEIGHT: Record<ItemQuality, number>` = `{ hoang: 75, huyen: 15, dia: 8, thien: 1.99, tien: 0.01 }`
  - `ITEM_QUALITY_SUBSTATS_RANGE: Record<ItemQuality, { min: number; max: number }>` = hoang {0,1}, huyền {0,2}, địa {0,3}, thiên {0,4}, tiên {0,5}
  - `ITEM_QUALITY_FORGE_USES: Record<ItemQuality, number>` = 5/10/20/40/80
  - `ITEM_QUALITY_AFFIX_TIER: Record<ItemQuality, number>` = 1/2/3/4/5
  - `ITEM_QUALITY_UNLOCKED_POOLS: Record<ItemQuality, AffixPool[]>` — basic / +advanced / +specialized / +supreme / all(basic,advanced,specialized,supreme)
  - `ITEM_QUALITY_IMPLICIT_MULTIPLIER: Record<ItemQuality, number>` = 1 / 1.15 / 1.3 / 1.5 / 1.75
  - `ITEM_QUALITY_ESSENCE_RANGE: Record<ItemQuality, { min: number; max: number }>` = 1-3 / 2-4 / 3-5 / 4-6 / 5-7

- [ ] **Step 1: Write failing tests** — `ItemQuality.test.ts`: assert LABELS đúng "Hoàng Chất…Tiên Chất" (không chứa "Phẩm"); ORDER 5 giá trị đúng thứ tự. `ItemQualityBalance.test.ts`: DROP_WEIGHT tổng = 100 (so sánh epsilon 1e-9: `Math.abs(sum - 100) < 1e-9`); FORGE_USES đúng [5,10,20,40,80]; AFFIX_TIER [1..5]; SUBSTATS_RANGE min luôn 0, max tăng dần 1..5; IMPLICIT tăng dần từ 1; UNLOCKED_POOLS mỗi bậc BAO GỒM bậc trước (chỉ cộng thêm); ESSENCE_RANGE min<max tăng dần
- [ ] **Step 2: Run** — `npx vitest run src/core/item/ItemQuality.test.ts src/core/equipment/ItemQualityBalance.test.ts` — FAIL (module chưa tồn tại)
- [ ] **Step 3: Implement** — viết 2 file theo Interfaces trên. `composeItemQualityNameSegments` copy pattern từ `ItemGrade.ts:19-24` nhưng colorVar = `` `--rank-color-${ITEM_QUALITY_ORDER.indexOf(quality) + 1}` ``, tone = quality
- [ ] **Step 4: Run** — PASS
- [ ] **Step 5: Commit** — `feat(item): ItemQuality contracts + 5-quality balance tables (rework P1)`

### Task 2: Tạo `EnhanceCurve.ts` (slot enhance + pity)

**Files:**
- Create: `game/src/core/equipment/EnhanceCurve.ts`
- Test: `game/src/core/equipment/EnhanceCurve.test.ts`

**Interfaces:**
- Produces:
  - `ENHANCE_PITY_THRESHOLD = 10`
  - `enhanceSuccessRate(level: number): number` — `Math.max(1, Math.round(100 * Math.pow(0.956, level - 1)))` trả PHẦN TRĂM số nguyên (1..100); level < 1 → 100
  - `MAX_SLOT_ENHANCE_LEVEL = 100`

- [ ] **Step 1: Write failing tests** — L1=100; L5=84 (`Math.round(100*0.956^4)`=84); L10=64; L20=41; L40=17; L60=7; L80=3; L100=1; L1000=1 (floor); level 0 → 100; hàm luôn trả 1..100
  - Verify từng giá trị: 0.956^4=0.8359→83.59→round 84 ✓; 0.956^9=0.6664→64 ✓; 0.956^19=0.4164→42? — **cẩn thận:** 0.4164×100=41.64→round 42. Dùng giá trị tính thật, KHÔNG cứng sổ: test viết `expect(enhanceSuccessRate(20)).toBe(Math.round(100*0.956**19))` + assert range [15,20] để khóa hành vi mà không phụ thuộc làm tròn
- [ ] **Step 2: Run** — FAIL
- [ ] **Step 3: Implement** — hàm thuần, không phụ thuộc class
- [ ] **Step 4: Run** — PASS
- [ ] **Step 5: Commit** — `feat(equipment): enhance success curve + pity threshold constants (rework P1)`

### Task 3: `canUseItem` gate helper

**Files:**
- Create: `game/src/core/equipment/canUseItem.ts`
- Test: `game/src/core/equipment/canUseItem.test.ts`

**Interfaces:**
- Consumes: `PROFESSION_GRADE_BY_REALM`, `compareProfessionGrades` (đã có sẵn `ProfessionGrade.ts:38-49,80-82`)
- Produces: `canUseItemGrade(itemGrade: ProfessionGrade, playerRealmId: string): boolean` — true khi `PROFESSION_GRADE_BY_REALM[playerRealmId] === itemGrade` (chính xác ngang phẩm, 2 chiều chặn)

- [ ] **Step 1: Failing test** — mỗi realm trong 10: item cùng phẩm → true; phẩm cao hơn 1 bậc → false; thấp hơn 1 bậc → false; extremum (cuu vs tien) → false
- [ ] **Step 2: Run** — FAIL
- [ ] **Step 3: Implement** — 1 dòng so sánh qua `getProfessionGradeForRealm`
- [ ] **Step 4: Run** — PASS
- [ ] **Step 5: Commit** — `feat(equipment): canUseItemGrade gate helper (rework P1)`

---

## PHASE 2 — Schema + Drop Pipeline

### Task 4: `EquipmentInstance` schema mới + shim compile

**Files:**
- Modify: `game/src/core/equipment/EquipmentInstance.ts` (thay interface)
- Create: `game/src/core/equipment/ItemGradeRefs.ts` (shim tạm)
- Test: cập nhật mọi file test fixture tạo `EquipmentInstance` — `EquipmentSystem.test.ts`, `EquipmentBag.autoDissolve.test.ts`, `ItemRoll.test.ts`, `GameManager.buildSnapshot.test.ts`, `useEquipmentTooltip.test.ts`, `EquipmentHallPanel.test.ts`, `EquipmentPaperdoll.test.ts`, `GameManager.enemyClear.test.ts`, `GameManager.mvpLoop.test.ts`, `GameManager.repeatStage.test.ts`, `GameManager.kiemTuRoute.test.ts`, `GameManager.legacySkillRestore.test.ts`, `GameManager.grantRandomEquipmentDrop.test.ts`, `CombatSkillPresentation.test.ts`, `EnemyStatInput.test.ts` (instances fixtures dùng `quality: EquipmentQuality`/`rarity`/`realmId`/`forgePoints`)

**Interfaces:**
- Produces (EquipmentInstance mới — spec §2):
  ```ts
  grade: ProfessionGrade          // thay realmId
  realmLevel?: number             // giữ (optional như cũ)
  quality: ItemQuality            // 5 chất (thay 9 bậc + rarity gộp làm 1)
  forgeUsesTotal: number          // = ITEM_QUALITY_FORGE_USES[quality]
  forgeUsesRemaining: number      // ngân sách tẩy/tinh
  // xóa: realmId, rarity, forgePoints, forgePotential
  // giữ nguyên: instanceId, itemId, slot, equipped, zoneId?, icon?, mainStat, affixes, locked?, favorite?
  ```
- Shim `ItemGradeRefs.ts` (tạm — phase 5 xóa): re-export tên cũ trỏ sang tên mới để các file CHƯA sửa còn compile: `export type { ItemQuality as ItemGrade }`, `export const ITEM_GRADE_ORDER = ITEM_QUALITY_ORDER`, `ITEM_GRADE_LABELS = ITEM_QUALITY_LABELS`, `composeItemGradeNameSegments = composeItemQualityNameSegments`, `export type EquipmentRarity = ItemQuality`, `EQUIPMENT_RARITY_AFFIX_SLOTS` = bảng prefix/suffix GIỮ NGUYÊN giá trị cũ {0,0}/{1,1}/{2,1}/{2,2}/{3,3} keyed ItemQuality (chỉ dùng bởi tooltip/tier logic cũ còn sống), `EQUIPMENT_RARITY_LABELS` trỏ ITEM_QUALITY_LABELS, `EQUIPMENT_RARITY_DROP_WEIGHT` trỏ ITEM_QUALITY_DROP_WEIGHT

**⚠️ Lưu ý cho implementer:** đây là task CẦU — sau task này type-check TOÀN PROJECT phải PASS. Cách làm: sửa EquipmentInstance + shim TRƯỚC → chạy type-check → sửa lần lượt từng lỗi compile (equipment core trước, rồi UI) — fixture tests đổi `quality: 'pham_khi'` → `quality: 'hoang'`, `rarity: 'hoang'` → bỏ (quality đã mang nghĩa), `realmId: 'mortal'` → `grade: 'cuu_pham'`, `forgePoints: X` → `forgeUsesTotal/Remaining: ITEM_QUALITY_FORGE_USES[quality]`

- [ ] **Step 1:** Viết test schema mới — thêm file `EquipmentInstance.test.ts` nhỏ: tạo instance qua helper mới, assert không còn field cũ (`'realmId' in instance === false`), grade/quality đúng type
- [ ] **Step 2: Rewrite** `EquipmentInstance.ts` interface theo trên; tạo shim `ItemGradeRefs.ts`
- [ ] **Step 3:** Chạy `npm.cmd run type-check` — thu thập TOÀN BỘ danh sách lỗi (expect 20-40 lỗi); sửa tuần tự core → composables → components → tests; fixture helper chuẩn: viết `makeInstance(overrides)` dùng chung trong `EquipmentInstance.test.ts` export để test khác import
- [ ] **Step 4:** `npm.cmd run type-check` PASS + `npx vitest run` PASS (nếu test runtime fail vì logic cũ đọc `instance.rarity` — shim che được phần lớn; fail nào shim chưa che → sửa trực tiếp dùng quality)
- [ ] **Step 5: Commit** — `refactor(equipment): instance schema grade/quality/forgeUses + compile shim (rework P2)`

### Task 5: Drop pipeline — grade deterministic + quality fixed-weight

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts` (createInstance L227-277, xóa rollQuality L283-296, xóa rollRarity L298-306)
- Test: `game/src/core/equipment/EquipmentSystem.test.ts` (mục "createInstance roll pipeline" L123+)

**Interfaces:**
- Consumes: Task 1 tables, `PROFESSION_GRADE_BY_REALM`
- Produces: `createInstance` trả instance có `grade` deterministic; `rollItemQuality(): ItemQuality` (private, weighted 75/15/8/1.99/0.01); substat count random `randomInt(0, max)` qua `rollAffixes` mới

- [ ] **Step 1: Failing tests** — (a) createInstance với player realm 'mortal' → `grade === 'cuu_pham'` cho MỌI roll; realm 'tribulation' → 'tien_pham'; (b) 2000 rolls quality — phân phối mỗi chất lệch < 3% điểm so với weight (bin tolerance), TẤT CẢ 5 chất xuất hiện; (c) substat count: 1000 items Hoang — count ∈ {0,1}; Tiên — count ∈ {0..5}; mọi giá trị trong khoảng xuất hiện; (d) forgeUsesTotal = bảng; forgeUsesRemaining = total
- [ ] **Step 2: Run** — FAIL
- [ ] **Step 3: Implement** — `createInstance`: `grade = getProfessionGradeForRealm(player.realmId)!`; `quality = this.rollItemQuality()`; xóa 2 hàm roll cũ; `rollAffixes` đổi signature nhận `(template, mainStatStat, quality, affixRegistry)` — count = `randomInt(min, max)` từ SUBSTATS_RANGE, prefix/suffix chia: count chẵn → nửa/nửa; lẻ → +1 prefix; Exalted giữ: `quality === 'tien' && rollChance(0.15)` → +1 dòng supreme; `mainStat` nhận implicit qua `ITEM_QUALITY_IMPLICIT_MULTIPLIER[quality]`; `getGlobalCultivationLevel(realmFromGrade(grade), player.realmLevel)` cho post-scale — **tạo helper `realmFromGrade(grade)` trong `ProfessionGrade.ts`** (wrap `getRealmIdForProfessionGrade` đã có sẵn L73-77)
- [ ] **Step 4:** Focused PASS + type-check PASS
- [ ] **Step 5: Commit** — `feat(equipment): deterministic grade + fixed-weight quality drop pipeline (rework P2)`

### Task 6: BattleLootSystem 2 drop sites + BattleLootSystem consumer fixes

**Files:**
- Modify: `game/src/core/game/BattleLootSystem.ts` (L439-446, L531-538 createInstance callers — không cần đổi nếu signature giữ; L447/539 particle `instance.rarity` → `instance.quality`; L457/551 accentColorVar `--eq-quality-${quality}` → `--rank-color-N` qua rank)
- Modify: `game/src/core/game/BattleLootSystem.ts` `getGradeParticleColor` (L673-683 — keyed rarity → quality; giữ hex values)
- Test: `BattleLootSystem.realmReward.test.ts`, `BattleLootSystem.talentHooks.test.ts` fixtures

- [ ] **Step 1: Failing test** — drop pipeline qua mock deps: particle color map đúng theo quality; instance mới có grade
- [ ] **Step 2-4:** sửa 2 sites + map; PASS
- [ ] **Step 5: Commit** — `refactor(loot): battle drops emit grade/quality instances (rework P2)`

### Task 7: Save shape validation — schema mới + discard cũ

**Files:**
- Modify: `game/src/services/save/saveShapeValidation.ts` (validateEquipmentEntries L209-239)
- Test: `game/src/services/save/saveShapeValidation.test.ts`, `SaveRoundTrip.test.ts`

**Interfaces:**
- Validation mới per entry: bắt buộc `grade` là ProfessionGrade hợp lệ (`isProfessionGrade`), `quality` ∈ ITEM_QUALITY_ORDER, `forgeUsesTotal`/`forgeUsesRemaining` non-negative finite, `forgeUsesRemaining <= forgeUsesTotal`; **không chấp nhận** entry có `realmId` hoặc `rarity` (item cũ) → reject entry (bỏ khỏi save, KHÔNG crash toàn save) — ghi counter discarded để UI toast sau
- Slot entries: thêm `enhanceFailStreak` non-negative (optional, default 0 khi thiếu)

- [ ] **Step 1: Failing tests** — entry mới hợp lệ → pass; entry có realmId (cũ) → rejected không làm cả save fail; forgeUsesRemaining > total → reject; thiếu grade → reject; enhanceFailStreak âm → reject
- [ ] **Step 2-4:** implement + PASS
- [ ] **Step 5: Commit** — `feat(save): equipment schema grade/quality validation + legacy discard (rework P2)`

---

## PHASE 3 — Ba hành động (Wash / Refine / Enhance-slot)

### Task 8: Điểm Rèn ngân sách chung + Wash rework

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts` (wash L850-1066 + getWashCost L729-743)
- Modify: `game/src/core/equipment/RefinementBalance.ts`
- Test: `game/src/core/equipment/EquipmentSystem.test.ts` (mục washAffixes L275+), `RefinementBalance.test.ts`

**Interfaces:**
- Wash mới: `washAffixes(instanceId, inventory, registry, materialBag, slotManager, affixRegistry, random?)` — **BỎ tham số oreMaterialId**; guards mới: `locked`/`favorite`/`no_forge_uses` (forgeUsesRemaining ≤ 0)/`missing_tinh_hoa` (cost = WASH_REFINEMENT_COST theo chất — bảng mới 5 giá trị)/`missing_spirit_stone`; kết quả: random lại count ∈ [0, max chất] + stat/tier/value mới; `forgeUsesRemaining -= 1` khi ok
- `getWashCost(quality: ItemQuality): { tinhHoa: number; spiritStone: number }` — bỏ ore
- RefinementBalance: `WASH_TINH_HOA_COST_BY_QUALITY: Record<ItemQuality, number>` = giữ cấu trúc 2→18: [2, 5, 9, 13, 18]; `WASH_SPIRIT_STONE_COST = 100` giữ; **xóa** `WASH_LINE_COUNT_WEIGHTS`, `WASH_TIER_WEIGHTS`, `WASH_ORE_AMOUNT`, `REFINEMENT_POINTS_CAP` (dead); tier weights mới `WASH_TIER_WEIGHTS_BY_QUALITY: Record<ItemQuality, readonly number[]>` (3 entries tier1-3): hoang [70,25,5], huyền [50,35,15], địa [35,35,30], thiên [20,40,40], tiên [10,35,55] (giữ số cũ, đổi key)
- Bỏ `oreQualityOf`/`canUseOreForInstance`/`ore_realm_mismatch`/`missing_ore` guards

- [ ] **Step 1: Failing tests** — wash không cần ore nữa (bỏ tham số → type error là "fail" trước); instance forgeUsesRemaining=0 → reason `no_forge_uses`; thành công → count mới trong khoảng chất + forgeUsesRemaining-1; thiếu tinh hoa → `missing_tinh_hoa`; mainStat KHÔNG đổi sau wash; Exalted Tiên 15% +1 supreme
- [ ] **Step 2:** FAIL (compile + runtime)
- [ ] **Step 3:** Implement — signature wash đổi (caller GameManager.washItem/previewWashItem bỏ ore param); wash UI radio ore sẽ xử lý Task 14
- [ ] **Step 4:** Focused PASS + type-check
- [ ] **Step 5: Commit** — `feat(equipment): wash consumes forge budget + tinh hoa, no ore (rework P3)`

### Task 9: Refine rework — chỉ tăng từng dòng

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts` (refine L1093-1290)
- Modify: `game/src/core/equipment/RefinementBalance.ts`
- Test: `EquipmentSystem.test.ts` (refine mục L486+)

**Interfaces:**
- `REFINE_INCREASE_MIN = 0.05`, `REFINE_INCREASE_MAX = 0.20` (thay `REFINE_VALUE_VARIANCE`)
- Roll mới per unlock line: `newValue = clamp(oldValue * (1 + U(0.05, 0.20)), tier.min, tier.max)` — clamp sau nhân; nếu oldValue đã = tier.max → dòng "đã max" KHÔNG được chọn (eligible filter); `no_eligible_affix` nếu tất cả max
- Chi phí: `forgeUsesRemaining -= 1` + tinh hoa `REFINE_TINH_HOA_COST_BY_QUALITY` [1, 3, 5, 7, 9] + Linh Thạch `(lineCount + lockedCount) × 50` giữ
- Giữ `REFINE_MAX_LOCKS = 3`, preview/commit architecture

- [ ] **Step 1: Failing tests** — 1000 refine: value CHỈ tăng; mức tăng từng dòng ∈ [5%,20%] (đo trước/sau); clamp tier không vượt; dòng max-tier-max-value bị loại khỏi eligible; forge budget -1; `no_forge_uses` khi 0; `no_eligible_affix` khi tất cả max
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** — `feat(equipment): refine always-increases per line 5-20% (rework P3)`

### Task 10: Enhance slot-level + pity

**Files:**
- Modify: `game/src/core/equipment/EquipmentSlotState.ts` (+`enhanceFailStreak: number` — `createDefaultSlotState` init 0)
- Modify: `game/src/core/equipment/EquipmentSystem.ts` (enhance L777-847; xóa `ENHANCE_PERCENT_PER_LEVEL`, `DEFAULT_MAX_ENHANCE_LEVEL`, phần forge trong `calculateEquipmentScale`, `getMaxForgePoints`, `getSlotMaxEnhanceLevel` path cũ)
- Modify: `game/src/core/game/GameManager.ts` (enhanceSlot L1882, getSlotMaxEnhanceLevel L1934)
- Test: `game/src/core/equipment/EquipmentSystem.test.ts` + `game/src/core/game/GameManager.enhanceSlot.test.ts` (mới)

**Interfaces:**
- `enhance(slot, player, ...)`: L1..100 — `successRate = enhanceSuccessRate(slotState.enhanceLevel + 1)`; roll `random() * 100 < successRate` → success: level+1, streak=0; fail: streak+1 (KHÔNG đổi level, KHÔNG mất gì ngoài nguyên liệu); streak đạt `ENHANCE_PITY_THRESHOLD` → lần tiếp CHẮC CHẮC success (kể cả fail-roll), reset
- Chi phí fail vẫn trừ (mất nguyên liệu lần thử)
- `applyModifiers` scale: `1 + slotState.enhanceLevel × ENHANCE_SLOT_SCALE` — **hằng số mới `ENHANCE_SLOT_SCALE = 0.06`** (khớp dải ảnh hưởng cũ 0.08×10 cấp = 0.8 max → 0.06×100 = 6.0 max; tiếp tục trend tăng lực theo slot — chốt số này giữ tổng công bằng: chi tiết trong commit message)
- Max level check: `slotState.enhanceLevel >= MAX_SLOT_ENHANCE_LEVEL` → `max_level`
- Bỏ template.maxEnhanceLevel lookup (slot-level không theo template)

- [ ] **Step 1: Failing tests** — mock random: luôn success khi rate 100% (L1); luôn fail khi rate thấp + streak tăng; streak 10 → lần 11 thành công bất chấp random; success reset streak; max level chặn; `enhanceFailStreak` persist qua `restoreFromSave` slot entries; item vào slot nhận scale theo slot (dùng `applyModifiers` test có sẵn pattern)
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** — `feat(equipment): slot-level enhance 100 levels + exponential rate + pity 10 (rework P3)`

### Task 11: Phase 3 full verify

- [ ] `npm.cmd run type-check` PASS
- [ ] `npx vitest run` full — mọi test cũ đã migrate không regress
- [ ] `npm.cmd run build` PASS
- [ ] Nếu fail — fix trước khi sang phase 4. Commit fix nếu có: `fix(equipment): phase 3 verify fixes (rework P3)`

---

## PHASE 4 — Tinh hoa + Tab Phân Giải

### Task 12: Material `luyen_khi_tinh_hoa` + xóa 10 essence cũ

**Files:**
- Modify: `game/src/data/materials/materials.ts` (+1 material essence mới, xóa generator 10 essence L233-259 + ESSENCE_TIER_NAMES)
- Modify: `game/src/core/equipment/RefinementBalance.ts` (xóa `EQUIPMENT_REALM_ESSENCE_MATERIAL`, `equipmentEssenceMaterialId`; `DISSOLVE_ESSENCE_RANGE_BY_QUALITY` → `ITEM_QUALITY_ESSENCE_RANGE` đã ở Task 1 — xóa bản cũ)
- Modify: mọi caller `equipmentEssenceMaterialId` — GameManager L2120 (previewDissolveRewards), EquipmentBag L77 (auto-dissolve), EquipmentSystem dissolveInstances L1338, panel L9/L678-688 (refineEssenceOwned) → thay bằng `'luyen_khi_tinh_hoa'` const
- Create: `game/src/core/equipment/TinhHoaMaterial.ts` — `export const LUYEN_KHI_TINH_HOA_ID = 'luyen_khi_tinh_hoa'` (single source)
- Test: `RefinementBalance.test.ts`, `materials.test.ts` nếu có, `EquipmentBag.autoDissolve.test.ts` (fixtures essence)

- [ ] **Step 1: Failing tests** — auto-dissolve reward.materialId === LUYEN_KHI_TINH_HOA_ID; dissolveInstances tương tự; amount theo ESSENCE_RANGE chất; grep-check (test quét materials list không còn id `tinh_hoa_pham_khi`…; `tinh_hoa_pham_the` VẪN TỒN TẠI — Luyện Thể)
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** — `feat(materials): unified luyen_khi_tinh_hoa, remove 10 realm essences (rework P4)`

### Task 13: Hóa Luyện output + dissolve path dùng tinh hoa mới

**Files:**
- Modify: `EquipmentSystem.dissolveInstances` (L1294-1358) — rewards `[{ materialId: LUYEN_KHI_TINH_HOA_ID, amount: randomInt(range) }]` (manual dissolve roll min-max như cũ)
- Modify: `EquipmentBag.autoDissolveOverflow` (L58-90) — reward `range.min` giữ; **sort bỏ tie-break forgePoints** (không còn field) → chỉ quality asc rồi grade asc (dùng `compareProfessionGrades`)
- Test: `EquipmentSystem.test.ts` dissolve mục L686+, `EquipmentBag.autoDissolve.test.ts`

- [ ] **Step 1: Failing tests** — dissolve output materialId đúng + amount trong range chất; auto-dissolve sort đúng (chất thấp trước, phẩm thấp trước)
- [ ] **Step 2-4:** FAIL → implement → PASS
- [ ] **Step 5: Commit** — `refactor(equipment): dissolve outputs unified tinh hoa (rework P4)`

### Task 14: DecomposeSystem + tab Phân Giải

**Files:**
- Create: `game/src/core/production/DecomposeSystem.ts`
- Modify: `game/src/core/game/GameManager.ts` (register system + expose `getDecomposeSettings/setDecomposeSetting/tickDecompose` qua tick loop đã có)
- Create: `game/src/components/panels/equipment-hall/DecomposeTab.vue`
- Modify: `game/src/components/panels/EquipmentHallPanel.vue` (thêm tab id `decompose` vào TABS, render child)
- Test: `game/src/core/production/DecomposeSystem.test.ts`, `game/src/components/panels/equipment-hall/DecomposeTab.test.ts`

**Interfaces:**
- Consumes: MaterialBag (khoáng input), AutoWorker capacity (pool — `player.autoWorkerCapacity` pattern GameManager.ts:2323), ProductionSystem cycle pattern (tick(nowMs))
- Produces:
  ```ts
  interface DecomposeSettings {
    gradeFilter: ProfessionGrade | 'all'
    qualityFilter: ItemQuality | 'all'
    workers: number              // 0..autoWorkerCapacity
  }
  class DecomposeSystem {
    tick(nowMs: number): void                       // cycle theo CYCLE_BASE_SECONDS (khởi điểm 30s)
    drainOutput(): Array<{ materialId: string; amount: number }>
    getSettings(): DecomposeSettings; setSetting(patch: Partial<DecomposeSettings>): void
    pendingAssignments(): number                     // tổng khoáng khớp filter đang chờ
  }
  ```
  Output/lần harvest: `amount = floor(base(grade) × hệ_số(quality) × workers)` với `base(grade) = 1 + (PROFESSION_GRADE_ORDER.indexOf(grade)) × 0.5` (Cửu 1.0 → Tiên 5.5), `hệ_số(quality) = 2^index` (Hoang 1 → Tiên 16); khoáng tiêu thụ mỗi cycle: `min(workers × 2, owned)` stacks khớp filter — tiêu thụ nguyên liệu trước, output theo tỉ lệ
- UI: 2 dropdown (Phẩm all/10, Chất all/5) + worker slider (0..capacity) + preview output + running state; tăng/giảm worker cập nhật cycle ngay

- [ ] **Step 1: Failing tests core** — settings persist trong system; tick đủ chu kỳ → drainOutput có tinh hoa đúng công thức (3 case: Hoang+Cửu+1 worker = 1; Tiên+1 worker = 5; Địa+3 workers = 12); filter sai không tiêu thụ khoáng; workers 0 → không chạy; workers > capacity → clamp
- [ ] **Step 2-4:** FAIL → implement DecomposeSystem → PASS
- [ ] **Step 5: Failing tests UI** — tab render; đổi setting gọi system; hiển thị output preview
- [ ] **Step 6-8:** FAIL → implement DecomposeTab + wire TABS → PASS
- [ ] **Step 9: Commit** — `feat(production): DecomposeSystem + Phân Giải tab — khoáng to tinh hoa (rework P4)`

### Task 15: Phase 4 full verify

- [ ] type-check + full vitest + build PASS; fix nếu văng — commit `fix: phase 4 verify fixes (rework P4)`

---

## PHASE 5 — Gate phẩm + breakthrough unequip

### Task 16: Equip gate ngang phẩm

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts` (`equip` L530-563 — đổi return `{ ok: boolean; reason?: string }`; reason mới `grade_mismatch`)
- Modify: `game/src/core/game/GameManager.ts` (`equipItem` L1866 — propagate `{ok, reason}`)
- Modify: `game/src/composables/useEquipmentActions.ts` (`equip` — feedback.error khi grade_mismatch với label "Phẩm không khớp cảnh giới")
- Test: `EquipmentSystem.test.ts`, `GameManager.equipGate.test.ts` (mới)

**Interfaces:**
- `equip` thêm guard sau inventory check: `canUseItemGrade(instance.grade, player.realmId)` — false → `{ ok: false, reason: 'grade_mismatch' }`
- ⚠️ return type đổi từ boolean → object: cập nhật TOÀN BỘ caller (composable, GameManager, tests) — grep `\.equip\(` trong plan task này

- [x] **Step 1: Failing tests** — item ngang phẩm → ok; cao/thấp 1 bậc → `grade_mismatch`; idempotent (đang mặc) vẫn true; message hiển thị qua composable feedback
- [x] **Step 2-4:** FAIL → implement → PASS
- [x] **Step 5: Commit** — `feat(equipment): grade gate on equip with reason plumbing (rework P5)`

### Task 17: Breakthrough unequips all + UI lock hint

**Files:**
- Modify: `game/src/core/game/GameManager.ts` — mới `unequipAllEquipment(): void` (loop getEquipped → equipmentSystem.unequip → refreshModifiers)
- Modify: `game/src/composables/useTribulation.ts` (`resolveVictory` L147-200 — gọi ngay sau realm assignment L156-158, trước sync passives; sau đó `player.setEquipmentModifiers(gameManager.getEquipmentModifiers())`)
- Modify: `game/src/components/common/BreakthroughRequirementPanel.vue` — thêm cảnh báo text "Đột phá sẽ tháo toàn bộ trang bị (yêu cầu trang bị ngang phẩm mới)"
- Test: `game/src/composables/useTribulation.dotPha.test.ts` (thêm case), `GameManager.unequipAll.test.ts` (mới)

- [x] **Step 1: Failing tests** — victory → mọi instance equipped=false; modifiers sync rỗng equipment phần; slot states GIỮ enhanceLevel (không reset); cảnh báo text render
- [x] **Step 2-4:** FAIL → implement → PASS
- [x] **Step 5: Commit** — `feat(breakthrough): unequip all on realm breakthrough + warning (rework P5)`

### Task 18: Phase 5 full verify

- [x] type-check + full vitest + build + `npx playwright test tests/e2e/boot-fresh.spec.ts` PASS; commit fix nếu văng

---

## PHASE 6 — Display, theme, dọn chết

### Task 19: Tách EquipmentHallPanel thành child components

**Files:**
- Create: `game/src/components/panels/equipment-hall/EnhanceTab.vue`, `WashTab.vue`, `RefineTab.vue`, `DissolveTab.vue`
- Modify: `game/src/components/panels/EquipmentHallPanel.vue` — còn lại: shell (tabs + shared equippedRows/selection qua `provide` hoặc props) ~400 dòng
- Test: di chuyển section tests sang test file tương ứng child (`EnhanceTab.test.ts`...); giữ `EquipmentHallPanel.test.ts` chỉ test shell + tab switching

**Interfaces:**
- Shared state: `selectedInstanceId` + `selectEquipped` cung qua `provide('hall-selection')` (InjectionKey typed) — children inject; previews là local state mỗi child (v-if unmount tự reset — giữ đúng semantics switchTab)
- Mỗi child tự import `useGameManager`/`useEquipmentActions`/`stateVersion` như cũ (injection đã có sẵn)

- [x] **Step 1:** Extract EnhanceTab (di chuyển code nguyên khối + refs liên quan) — chạy test tab enhance PASS
- [x] **Step 2:** Extract WashTab (xóa luôn UI radio ore — không còn dùng) — PASS
- [x] **Step 3:** Extract RefineTab — PASS
- [x] **Step 4:** Extract DissolveTab (giữ pagination + 3 filter: realm → đổi thành **grade** filter dùng PROFESSION_GRADE_ORDER + `canUseItemGrade` cho hint; rarity/quality filter gộp thành 1 dropdown Chất) — PASS
- [x] **Step 5:** Shell cleanup — bỏ code đã chuyển, TABS thêm 'decompose' (Task 14 đã wire, giờ đưa vào child đúng chỗ) — full panel tests PASS
- [x] **Step 6:** `npm.cmd run type-check` + full vitest PASS
- [x] **Step 7: Commit** — `refactor(ui): split EquipmentHallPanel into 5 tab children (rework P6)`

### Task 20: Theme màu 10 rank + dọn biến chết

**Files:**
- Modify: `game/src/assets/theme.css` — thêm `--rank-color-10` (màu bậc 10: dùng gradient — tạo `--rank-gradient-10: linear-gradient(...)` 7 sắc nâng từ `rank-gradient-9`; chọn hex nền #ffe9a8 cho fallback); XÓA `--grade-*` (5 vars), `--eq-quality-*` (9 vars), `--rank-gradient-9` (thay bằng 10)
- Modify: 4 theme files `src/assets/themes/*.css` — grep `--grade-|--eq-quality|--rank-` sync cùng thay đổi
- Modify: `game/src/composables/slots/normalizeSlotRank.ts` — `equipmentQualityRank(quality: ItemQuality)` 1..5 (dải riêng: rank = index+1); `professionGradeRank` bỏ clamp (1..10); `itemGradeRank` xóa
- Modify: `game/src/core/item/ItemQuality.ts` — colorVar đã dùng rank (Task 1) — verify
- Test: `normalizeSlotRank.test.ts` cập nhật

- [x] **Step 1: Failing tests** — rank 1..10 cho profession; 1..5 cho quality; `isMaxRankTone('tien')` true cho cả 2 trục qua rank max riêng
- [x] **Step 2-4:** FAIL → implement css + rank → PASS
- [x] **Step 5: Commit** — `refactor(theme): 10-rank color scale, purge dead grade/eq-quality vars (rework P6)`

### Task 21: Terminology sweep — locale, tooltip, naming

**Files:**
- Modify: `game/src/locales/vi.json` + `en.json` — keys `panels.equipmentHall.*`: đổi mọi "Phẩm" liên quan chất → "Chất"; `select.anyGrade` → "Mọi chất"; thêm keys Phân Giải (`tabs.decompose`, `labels.*`, `settings.*`, aria); thêm pity UI keys (`enhance.pityCounter: 'Bảo hiểm {streak}/10'`, `enhance.guaranteed: 'Chắc chắn thành công'`); xóa keys chết (oreSelection, realm.quality cũ nếu còn)
- Modify: `useEquipmentTooltip.ts` — quality sections (L98 affix slots, L134 forge → lượt rèn display `forgeUsesRemaining/Total`, L163 realmScale qua realmFromGrade, L213 qualityKey) — tooltip hiển thị "Phẩm: X Phẩm (Cảnh Giới Y)" + "Chất: X Chất"
- Modify: `EquipmentNaming.ts` — segments qua composeItemQualityNameSegments + grade segment mới (dùng `PROFESSION_GRADE_NAMES` + `--rank-color-N` theo professionGradeRank)
- Modify: `labels.ts` — `equipmentRarityLabel` xóa; `equipmentQualityLabel(quality: ItemQuality)` trỏ ITEM_QUALITY_LABELS; thêm `gradeLabel(grade)` trỏ PROFESSION_GRADE_NAMES
- Modify: `BattleLootSystem.ts` accentColorVar (L457/551) → rank color qua quality rank
- Test: `useEquipmentTooltip.test.ts` cập nhật + parity test locale (mở rộng `src/i18n/index.test.ts` hoặc file parity mới — task 2.6 roadmap có thể gộp đây)

- [x] **Step 1: Failing tests** — tooltip segments chứa "Phẩm:"/"Chất:" đúng; locale parity vi/en zero diff; grep-check không "Phẩm" cạnh "Chất" nhầm lẫn trong labels chất
- [x] **Step 2-4:** FAIL → implement → PASS
- [x] **Step 5: Commit** — `refactor(i18n): terminology Phẩm/Chất + tooltip dual-axis + decompose keys (rework P6)`

### Task 22: Dọn chết + xóa shim

**Files:**
- Delete: `game/src/core/item/ItemGrade.ts`, `game/src/core/equipment/ItemGradeRefs.ts` (shim), `game/src/core/equipment/EquipmentQuality.ts`, `game/src/core/equipment/EquipmentRarity.ts`
- Modify: mọi import còn trỏ file xóa → `ItemQuality.ts`/`ItemQualityBalance.ts` trực tiếp (grep `from.*ItemGrade'|from.*EquipmentQuality'|from.*EquipmentRarity'`)
- Test: grep contract test mới `game/src/core/equipment/deadReferences.test.ts` (test đọc filesystem + regex — pattern theo CombatScene source-contract test nếu có, hoặc đơn giản `import.meta.glob` scan)

**Dead-reference test nội dung:**
- Scan `src/**/*.ts` + `src/**/*.vue`: không chứa `forgePoints`, `forgePotential`, `FORGE_PERCENT_PER_POINT`, `REFINE_VALUE_VARIANCE`, `EQUIPMENT_QUALITY_REALM_WEIGHTS`, `EQUIPMENT_REALM_ESSENCE_MATERIAL`, `equipmentEssenceMaterialId`, `tinh_hoa_pham_khi`..`thien_dia_trong_khi` (whitelist: `tinh_hoa_pham_the`), `--grade-`, `--eq-quality-`, `WASH_ORE_AMOUNT`, `ENHANCE_PERCENT_PER_LEVEL`
- Instance fields: tạo instance → không có keys `realmId`/`rarity`/`forgePoints`/`forgePotential`

- [x] **Step 1: Write failing dead-reference test** (chạy fail vì shim + files cũ còn)
- [x] **Step 2-4:** Xóa 4 file + sửa imports → type-check PASS → test PASS
- [x] **Step 5: Commit** — `refactor(equipment): delete legacy grade/quality/rarity files + dead-reference contract (rework P6)`

### Task 23: Phase 6 + FINAL full verify

- [x] `npm.cmd run type-check` PASS
- [x] `npx vitest run` full PASS (không regress — baseline hiện tại ~1597+ tests mới)
- [x] `npm.cmd run build` PASS
- [x] `npx playwright test` — boot-fresh + create-to-combat + ink-wash-ui + save-reload PASS (6/6+)
- [x] Quy tắc UI flexible check (AGENTS.md): Dissolve grid + Decompose tab dùng auto-fill/ResizeObserver pattern — không hardcode cột
- [x] Commit final: `chore: item grade/quality rework complete — full verification (rework P6)`

---

## Execution Notes

- **Phasing bắt buộc tuần tự** (P1→P6); trong phase, Task song song được nếu không cùng file.
- Task 4 (CẦU schema) là task rủi ro nhất — dispatch implementer có năng lực cao nhất, review kỹ.
- Mỗi task commits riêng; KHÔNG merge master giữa chừng; user quyết merge.
- Sau Task 23: update ROADMAP (đánh dấu T2.4/2.5/2.7 + phần 6D-3 hoàn thành) — task 24 nhỏ, làm inline.
- Balance numbers (ENHANCE_SLOT_SCALE=0.06, DecomposeSystem hệ số, WASH/REFINE cost) là KHỞI ĐIỂM — test khóa cấu trúc (không khóa số tuyệt đối trừ weight-drop tổng 100), đánh dấu tuning sau playtest trong comment.

## Self-Review Result (2026-09-01)

**Spec coverage:** 8/8 mục spec có task tương ứng. 3 helper-name chỉ tồn tại trong plan (không phải spec) là implementation details: `canUseItemGrade` (spec §5.7 `canUseItem`), `realmFromGrade` (wrap `getRealmIdForProfessionGrade` có sẵn), `unequipAllEquipment` (spec §5.7 hook breakthrough), `DecomposeTab.vue` (spec §5.6 tab 5). Không gap.

**Placeholder scan:** 0 TBD/TODO. Mọi step có code hoặc lệnh cụ thể. Task 1 Step 1 có chú ý đặc biệt về round-tripping (test khóa range không khóa số tuyệt đối nơi làm tròn float — thực hành đúng).

**Type consistency:** đã rà — `ItemQuality` dùng nhất quán từ Task 1; `quality: ItemQuality` trong schema Task 4; mọi bảng `ITEM_QUALITY_*` prefix đồng bộ; `grade: ProfessionGrade` nhất quán Task 4/5/16; `enhanceFailStreak` Task 10 = Task 7 (save validation) = schema §2. Shim `ItemGradeRefs.ts` có nhiệm vụ rõ (phase 1-5 compile bridge, xóa Task 22).
