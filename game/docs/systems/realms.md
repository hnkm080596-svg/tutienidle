# Đại cảnh giới (Realm)

**Trạng thái:** Live cho Phàm Nhân → Trúc Cơ; Kim Đan trở lên là **placeholder** (data tồn tại, chưa có nội dung/gate thật).

Data: `data/realms/realm.ts`. Logic: `core/realm/realmSystem.ts`. Tier map: `core/realm/RealmTierMap.ts`.

## Danh sách

| Realm | Tên | maxLevel | Trạng thái |
|---|---|---|---|
| `mortal` | Phàm Nhân | 18 | Live — có Luyện Thể ([body-refinement.md](./body-refinement.md)) |
| `qi_refining` | Luyện Khí | 18 | Live — có Bát Mạch ([meridians.md](./meridians.md)), quái ẩn |
| `foundation_establishment` | Trúc Cơ | 18 | Live — chương 3 (10 stage `foundation_floor_*`, artifact unlock) |
| `golden_core` → `tribulation` | Kim Đan → Độ Kiếp | 9 | **Placeholder** — không gate/nội dung; không suy ra "chơi được" |

- `CORE_REALM_LEVEL = 12` — tầng "đủ" để đột phá lên realm kế.
- `EXTENDED_REALM_LEVEL = 18` — tầng tối đa; 13–18 là buffer cho perfection/luyện thể.
- `getRealmIndex`/`getRealmTier`/`getRequiredCultivation`/`getCurrentRealm` — accessor dùng chung.

## Realm passive

`core/realm/RealmPassiveSystem.ts` + `data/realm/RealmPassives.ts`: mỗi đại cảnh giới cấp đúng 1 nội tại, một lần (`player.grantedRealmPassiveIds` track). Xem trong `RealmPanel.vue` (standalone `realm`). Bậc Kiến Cơ (từ Độ Kiếp) scale nội tại: Nhân/Địa/Thiên/Huyền/Hoàng/Vũ = 0/5/10/20% chỉ số chính — chi tiết [tribulation.md](./tribulation.md).

## Realm pressure (áp lực cảnh giới)

`core/combat/RealmPressure.ts` — trong combat, so **đại cảnh giới** hai bên:

- Bên cao hơn gây nhiều hơn & nhận ít hơn sát thương.
- Bậc Nhập Đạo (`player.breakthroughGrade`) giảm phần áp lực khi bị áp: bậc 1 không giảm, bậc 6 miễn hoàn toàn.
- Chênh lệch clamp 5 cảnh giới; hệ số đánh ngược lên tối thiểu 0.1.

## Liên quan

- [cultivation.md](./cultivation.md) — tiến trình trong 1 realm.
- [tribulation.md](./tribulation.md) — lên realm kế.
- [enemies-stages.md](./enemies-stages.md) — stage/enemy gắn realm.
