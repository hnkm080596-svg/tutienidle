# Túi đồ & nguyên liệu (Inventory)

**Trạng thái:** Live.

Core: `core/material/Material.ts`, `MaterialBag.ts`, `MaterialStack.ts`, `MaterialRegistry.ts`; `core/equipment/EquipmentBag.ts`; `core/pill/PillBag.ts`; `core/inventory/StackLimits.ts`. Data: `data/materials/materials.ts`. UI: `InventoryPanel.vue` (`leftPanelMode = 'inventory'`) + `BagGrid.vue` + `bag-sections/*`.

## Bag theo loại

`BagTab` (stores/ui): `equipment | material | pill` — Phù/Trận đã khai tử, bag chỉ còn 3 tab. Mỗi loại một bag class riêng:

- `MaterialBag` — `Map<materialId, MaterialStack>`; `add(material, amount)` clamp theo `material.stackLimit ?? MAX_STACK_AMOUNT`, trả **overflow** (lượng mất) để caller báo "túi đầy". Guard NaN/≤0.
- `EquipmentBag` — danh sách `EquipmentInstance`, soft cap 500 ([equipment.md](./equipment.md)).
- `PillBag` — stack theo `pillId`.
- `TalismanBag`/`FormationBag` — shape giữ cho save tương thích, gameplay khai tử.

`MAX_STACK_AMOUNT = 1000` — trần 1 ô material/pill. Material có thể override `stackLimit`.

## Linh Thạch = material

**Không còn currency state riêng** trên `PlayerData` — số dư duy nhất `materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)`. 3 tier: `spirit_stone_ha_pham` (Hạ phẩm — mặc định), `trung_pham`, `thuong_pham` (`getSpiritStoneMaterialIdForRealmTier`). `stackLimit = Number.MAX_SAFE_INTEGER` vì chi phí đột phá lên hàng tỷ. Cộng qua `add()`, tiêu qua `remove()` sau `has()`; penalty dùng `Math.min(owned, requested)`.

## Material model

`Material`: `id`, `name`, `category` (`herb | wood | ore | monster_core | spirit_stone | essence | byproduct | other`), `years?` (niên đại — trần phẩm recipe), `element?`, `sourceType`, `profession?` (meta nghề cho grade gate — [profession-grades.md](./profession-grades.md)), `stackLimit?`.

Convention id (gp123 6E): `<realmId>_wood_<age>`, `<realmId>_ore_<age>`, `<herbId>_<realmId>_<age>` — trục tuổi thống nhất `decade → century → millennium → myriad_year → thuong_co` (`HERB_AGES`/`MATERIAL_AGE_WEIGHTS`).

`data/materials/materials.ts` — generator material theo realm/age + material đặc thù (Tinh Hoa Phàm Thể, Luyện Khí Tinh Hoa, Thông Mạch Đan nguyên liệu, item narrative quest/signature…). Legacy Linh Chi/Quế/Cúc Hoa đã lọc khỏi registry runtime.

## UI

`InventoryPanel` — sort/filter/pagination (`useBagSort`, `useBagFilter`, `useBagPagination`, `useBagGridLayout` — measured layout chung với Phaser). Equipment chiếm khối 30% trên của trang inventory.

## Liên quan

- [equipment.md](./equipment.md) — bag trang bị.
- [pills.md](./pills.md) — túi đan.
- [vendor.md](./vendor.md) — bán material → Linh Thạch.
