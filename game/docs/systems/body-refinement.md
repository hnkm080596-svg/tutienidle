# Luyện Thể (Body Refinement)

**Trạng thái:** Live — độc quyền realm Phàm Nhân.

Owner: `core/realm/body/BodyProgressionSystem.ts` + chapter `BodyRefinementChapter.ts` (P7-M5 — `BodyRefinementSystem.ts` cũ đã gỡ). Data: `data/realm/BodyRefinement.ts`. State: `player.bodyProgression.body_refinement` (`completedTiers` + `currentTierProgress` — flat fields cũ đã gỡ). UI: `panels/realm/BodyRefinementSection.vue` bên trong `RealmPanel` (P7-M7 — `LuyenThePanel.vue` standalone `luyen_the` đã gỡ; section read-only, đầu tư tự động qua tick).

## Cơ chế

- 6 tầng **tuần tự**: chỉ đầu tư được tầng đang dở (`completedTiers` làm index); tầng trước xong mới tới tầng sau.
- Mỗi tầng có `cap` — đầu tư **Tinh Hoa Phàm Thể** (`tinh_hoa_pham_the`, rớt từ quái Phàm Nhân) vào `currentTierProgress` cho tới khi đầy.
- Tầng đầy → `completedTiers++`, progress reset về 0, modifier vĩnh viễn áp lên player.

## Bảng tầng

| # | Tên | Cap | Stat | % khi đầy | Yêu cầu tầng PN |
|---|---|---|---|---|---|
| 1 | Luyện Bì | 50 | defense | ~5% | 2 |
| 2 | Luyện Nhục | 175 | attack | ~5% | 4 |
| 3 | Luyện Cốt | 615 | maxHp | ~5% | 6 |
| 4 | Luyện Huyết | 2150 | hpRegenPerTurn | ~8% | 8 |
| 5 | Luyện Tạng | 7500 | vitality | ~5% | 10 |
| 6 | Luyện Mạch | 26300 | maxHp + hpRegenPerTurn | ~10% | 12 |

(Số liệu chính xác xem `BODY_REFINEMENT_TIERS` — cột trên rút gọn cho đọc.)

## Gate quan trọng

- `requiredRealmLevel` **chỉ pace tiến độ khi còn ở Phàm Nhân** (`player.realmId === 'mortal'`). Đột phá lên Luyện Khí rồi thì mọi tầng còn dở mở thẳng — chỉ còn ràng buộc thứ tự tuần tự. Cho phép tiêu nốt Tinh Hoa Phàm Thể tồn kho.
- Talent `luyen_the_ky_tai` đã khai tử — `getBodyRefinementProgressMultiplier()` resolve 1 (spend 1:1, xem `core/talent/TalentEffects.ts`).
- Progress từng phần cũng cấp modifier tỉ lệ `progress/cap` khi chưa đầy (`buildTierModifiers`).

## Liên quan

- [realms.md](./realms.md) — realm Phàm Nhân; meridian chapter (Bát Mạch) cùng registry `BODY_CHAPTERS`, invest M13 parked.
- [enemies-stages.md](./enemies-stages.md) — nguồn Tinh Hoa Phàm Thể.
