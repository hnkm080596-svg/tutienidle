# Review — S04 Character + S09 Inventory + S12 Equipment (2026-10-02)

## Cross-scene fix: nav seal labels

- `ImperialNavRail.vue`: labels were horizontal 2-line-clamped → clipped mid-word on every scene ("Cảnh" / "Giới" split). Migrated to `writing-mode: vertical-rl` — top-down text inside the hanging-tag seal art, glyph beside it. Verified in `after/09-inventory.png`: all 7 labels read cleanly ("Nhân vật" … "Địa Giới"), active seal gilded.
- Single-node graph case keeps the lone root at canvas center (skillGraphLayout).

## S04 Character — `after/04-character.png`

- Portrait medallion + identity + talent + combat power left; five-stat rail with silhouette right; Ngũ Hành element-wheel bottom-center; Chi Tiết CTA. Matches ref composition (figure focal + stats hierarchy + detail drawer trigger).
- Canonical reads intact (stat model, element wheel state, allocate logic untouched).

## S09 Inventory — `after/09-inventory.png`

- Three real category tabs (Trang Bị/Nguyên Liệu/Đan Dược), search + slot-group chips, coherent dark empty cells, pagination + sort footer, count badge. Capacity/tools/footer per spec.
- Fresh-mortal bag is empty → full grid of empty cells renders correctly (no broken state).
- Minor: "0 món" count sits close under the close seal at 1280 — safe-area acceptable, noted.

## S12 Equipment — `after/12-equipment.png`

- Paperdoll focal (mannequin substrate + 6 runtime sockets, click-to-unequip + tooltips intact) + ops workspace (canonical tabs: Cường Hóa/Hóa Luyện beta-visible only).
- NEW: `EquipmentBagRail.vue` compact bag column between paperdoll and ops — vertical slot list of unequipped gear, click → canonical `equip()`; reuses the same `equipmentBag.getAll()`/`buildEquipmentTooltip`/`quoteMainStatRange` read chain as `EquipmentBagSection` (no duplicated authority).
- Ref's center item-detail card is represented canonically via structured tooltips (no duplicate detail store).
- Empty-bag state renders a slim labeled column (honest, no placeholder items).

## Deferred

- Equipment ref shows level text under worn slots; SlotView carries grade/rarity/±N badges only (Low — canonical surface).
