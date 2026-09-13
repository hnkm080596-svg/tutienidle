# Trang bị (Equipment)

**Trạng thái:** Live.

Core: `core/equipment/` — `Equipment.ts` (template), `EquipmentInstance.ts` (bản roll), `EquipmentBag.ts`, `EquipmentSystem.ts`, `EquipmentSlotManager.ts`, `EquipmentStatPolicy.ts`, `EquipmentWash.ts`, `EquipmentDissolve.ts`, `EnhanceCurve.ts`, `AffixRegistry.ts`, `EquipmentRollPrimitives.ts`, `RefinementBalance.ts`, `ItemQualityBalance.ts`. Data: `data/equipment/{equipment,affixes}.ts`. UI: `EquipmentHallPanel.vue` (Khí Đường, `equipment_hall`) + `EquipmentPaperdoll.vue` + `equipment-hall/*Tab.vue`.

> Bảng số liệu chi tiết (quality, rarity, affix pool, forge point, naming): [../item-design-reference.md](../item-design-reference.md). File này mô tả cấu trúc hệ thống + thao tác.

## 2 lớp dữ liệu

- `Equipment` — template tĩnh trong `EquipmentRegistry` (id, slot, main stat range…).
- `EquipmentInstance` — bản sở hữu: `quality` (ItemQuality 9 bậc — **cố định** khi roll, không nâng), `rarity` (ItemGrade 5 bậc), `rolledAffixes`, `forgePoints`/`forgePotential`, `locked`, `favorite`, `equipped`.

Quality × Rarity là 2 trục độc lập. Quality gate tier affix tối đa + pool affix + range implicit; `forgePotential` (0–100 roll lúc tạo) làm trần rèn thật của instance.

## 6 slot trang bị

`EQUIPMENT_SLOTS`: `weapon | helmet | armor | boots | ring | necklace` — `EquipmentSlotManager` giữ `EquipmentSlotState` cố định 6 slot (`enhanceLevel`, `equippedInstanceId`, `bonusAffixSlots`, `appliedTalismanIds` legacy). Slot state nằm cấp GameManager, không thuộc EquipmentBag; restore chỉ ghi đè slot có trong save.

`EQUIPMENT_SLOT_STAT_POLICY` — main stat/substat hợp lệ theo slot; `EQUIPMENT_FORBIDDEN_STATS` chặn stat cấm; assert lúc roll.

## Bag

`EquipmentBag` — instance list, `EQUIPMENT_BAG_SOFT_CAP = 500` (vượt → auto-dissolve/overflow path). `EquipmentBag.autoDissolve` + `AutoDissolveReward` — hòa tan tự động theo filter.

## Khí Đường — 5 tab thao tác

`EquipmentHallPanel.vue` → `EnhanceTab` | `WashTab` | `RefineTab` | `DissolveTab` | `DecomposeTab` (Decompose nói sang linh khoáng — [decompose.md](./decompose.md)).

### Cường Hóa (Enhance) — theo SLOT

`EnhanceCurve.ts`: `enhanceSuccessRate(level)` giảm dần; `ENHANCE_PITY_THRESHOLD = 10` (pity); `MAX_SLOT_ENHANCE_LEVEL = 100`; `ENHANCE_SLOT_SCALE = 0.06` — nâng `enhanceLevel` của SLOT, scale mọi item mặc vào slot đó (`calculateEquipmentScale`). Đổi item không mất enhance vì enhance thuộc slot.

### Tẩy Luyện (Wash) — reroll identity substat

`EquipmentWash.ts`: reroll toàn bộ identity substat — số dòng trong trần Chất, identity từ pool hợp lệ (`filterEligibleAffixes`), tier weighted theo Chất (`WASH_TIER_WEIGHTS_BY_QUALITY`). Cost = Luyện Khí Tinh Hoa + Linh Thạch (`getWashCost`). **Pending ticket**: `createWashPendingSlotAccessor` — preview roll là ticket 1-lần gắn instance, `discardWashTicket` huỷ; pending chết cùng instance (R9.1).

### Tinh Luyện (Refine) — nâng giá trị affix

Roll lại giá trị trong range của affix hiện có (`rollAffixRange`, `getEffectiveAffixValue`), tiêu forge point của instance (trần `forgePotential`). `pendingRefinePreview` — preview domain-owned, commit validate eligibility.

### Hóa Luyện (Dissolve)

`dissolveInstances(instanceIds)` — 2 pass: validate toàn bộ (equipped/locked/favorite từ chối) + tính reward trước → xoá khỏi bag → trả **Luyện Khí Tinh Hoa** (`luyen_khi_tinh_hoa`, `LUYEN_KHI_TINH_HOA_ID`) theo `ITEM_QUALITY_ESSENCE_RANGE`. Dedupe id trước khi tính (chống double-submit nhân đôi tinh hoa). `quoteDissolveRewards` preview không mutate.

## Affix roll

`EquipmentRollPrimitives`: `GLOBAL_MAX_AFFIXES = 8`, `rollAffixRange`, `normalizeRolledAffixValue`, `getEffectiveAffixValue`, `filterEligibleAffixes` (slot policy + quality pool + tier), `rollEligibleAffixAtTier`. `AffixRegistry` + `data/equipment/affixes.ts`.

## Operation cost & gate

`EquipmentOperationCostCatalog` — cost mỗi thao tác, discount theo level Khí Đường (building, [buildings.md](./buildings.md)). Mọi thao tác cần building `equipment_hall` đã xây; gate check trước khi mở panel/tab.

## Stat → nhân vật

`EquipmentSystem` tính modifier từ equipped instance → `player.setEquipmentModifiers(...)` sau restore ([save-load.md](./save-load.md)). `MAIN_STAT_REALM_SCALE = 0.05` scale main stat theo realm.

## Liên quan

- [inventory.md](./inventory.md) — stack/túi.
- [decompose.md](./decompose.md) — Phân Giải (khác Hóa Luyện: phân khoáng, không phải trang bị).
- [drops-loot.md](./drops-loot.md) — nguồn trang bị.
- [../item-design-reference.md](../item-design-reference.md) — số liệu.
