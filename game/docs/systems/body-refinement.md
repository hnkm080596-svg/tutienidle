# Luyện Thể (Body Refinement)

**Trạng thái:** Live — độc quyền realm Phàm Nhân.

Owner: `core/realm/BodyRefinementSystem.ts`. Data: `data/realm/BodyRefinement.ts`. UI: `components/panels/LuyenThePanel.vue` (standalone panel `luyen_the`).

## Cơ chế

- 6 tầng **tuần tự**: chỉ đầu tư được tầng đang dở (`bodyRefinementCompletedTiers` làm index); tầng trước xong mới tới tầng sau.
- Mỗi tầng có `cap` — đầu tư **Tinh Hoa Phàm Thể** (`tinh_hoa_pham_the`, rớt từ quái Phàm Nhân) vào `bodyRefinementCurrentTierProgress` cho tới khi đầy.
- Tầng đầy → `bodyRefinementCompletedTiers++`, progress reset về 0, modifier vĩnh viễn áp lên player.

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
- Talent có thể scale tốc độ đầu tư qua `getBodyRefinementProgressMultiplier()` trong `core/talent/TalentEffects.ts`.
- Progress từng phần cũng cấp modifier tỉ lệ `progress/cap` khi chưa đầy (`buildTierModifiers`).

## Liên quan

- [realms.md](./realms.md) — realm Phàm Nhân.
- [enemies-stages.md](./enemies-stages.md) — nguồn Tinh Hoa Phàm Thể.
