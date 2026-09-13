# Tu luyện & đột phá tiểu cảnh giới

**Trạng thái:** Live.

Owner: `core/cultivation/CultivationSystem.ts`. Player state: `PlayerData.cultivation`, `realmId`, `realmLevel`, `isCultivating`, `cultivationPerSecond`, `attributePoints`.

## Tích lũy tu vi

- Khi `player.isCultivating = true`, mỗi tick `addCultivation(player, cultivationPerSecond × delta)`.
- **`addCultivation` cap tại `getRequiredCultivation(realmId, realmLevel)`** — không tích dư quá mức cần đột phá. AFK lâu chỉ đầy thanh, không "nhảy nhiều tầng một phát".
- `BASE_CULTIVATION_UNIT_SECONDS = 86400`, `BASE_CULTIVATION_PER_SECOND = 10` trong `core/realm/realmSystem.ts` — nền trước khi modifier tốc độ tu luyện (tâm pháp, building, talent…) áp vào.
- Realm `baseCultivationMinutes` (`data/realms/realm.ts`) quyết định thời gian nền mỗi tầng: Phàm Nhân 1 phút, Luyện Khí 22, Trúc Cơ 64 — các realm trên chưa có số thật (placeholder).

## Đột phá tiểu cảnh giới

- `canBreakthrough()` = `cultivation >= required`.
- `breakthrough()`: reset `cultivation = 0`, `realmLevel++`, `attributePoints++` (flat +1/tầng).
- UI: nút Đột Phá trong CharacterPanel → `composables/useBreakthrough.ts` — chỉ sequence command + presentation.
- Đột phá tiểu cảnh giới **không** cấp skillPoints (đã xoá) — Cảm ngộ Kỹ năng chỉ đến từ combat ([drops-loot.md](./drops-loot.md)).
- `realmLevel` tối đa = `realm.maxLevel`. Các realm live: `maxLevel: 18` (12 = "tầng đủ", 12–18 = tầng đệm/perfection).
- **Không** vượt đại cảnh giới qua hàm này — đại cảnh giới đi qua Độ Kiếp (xem [tribulation.md](./tribulation.md)).

## Điểm thuộc tính

- `attributePoints` phân phối vào 5 main stat: `strength` (Căn Cốt), `dexterity` (Thân Pháp), `intelligence` (Thần Thức), `attunement` (Linh Căn), `vitality` (Thể Chất) — union `MainStatKey` trong `core/stats/StatTypes.ts`.
- `GameManager.allocateAttributePoint(stat)` là cổng cộng điểm; attribute đi qua `deriveAttributeModifiers()` trong StatCalculator như modifier thường.
- UI phân phối ở CharacterPanel.

## Cổng cảnh giới lớn

Khi `realmLevel` đạt `realm.maxLevel` (18) và realm có kế tiếp:

- Panel **Quán Khí** (`QuanKhiPanel.vue`, standalone `quan_khi`) mở lối đột phá đại cảnh giới — vào Độ Kiếp. Gate chi tiết ở [tribulation.md](./tribulation.md).
- Nhân vật chưa chọn con đường tu luyện thì Quán Khí hiện lựa chọn path trước ([cultivation-paths.md](./cultivation-paths.md)).

## Liên quan

- [realms.md](./realms.md) — danh sách đại cảnh giới, realm passive.
- [body-refinement.md](./body-refinement.md), [meridians.md](./meridians.md) — progression phụ trong Phàm Nhân/Luyện Khí.
