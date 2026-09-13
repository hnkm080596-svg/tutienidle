# Kỳ Kinh Bát Mạch (Meridian)

**Trạng thái:** Live — độc quyền realm Luyện Khí.

Owner: `core/realm/MeridianSystem.ts`. Data: `data/realm/Meridians.ts` (`MERIDIANS`). State: `player.openedMeridianIds`.

## Cơ chế

- 9 đường kinh **mở tuần tự** — đường trước mở xong mới tới đường sau (không chọn lựa).
- Mỗi đường yêu cầu `requiredRealmLevel` (chỉ áp khi `realmId === 'qi_refining'`) + tiêu hao **Thông Mạch Đan** (`thong_mach_dan`, số lượng `thongMachDanCost`).
- Đường cuối `ky_kinh_thien_dia_chi_kieu` (tầng 18) còn cần **Thiên Địa Chi Kiều** (`thien_dia_chi_kieu`) — item signature rớt từ nội dung ẩn.
- Mỗi đường cấp `StatModifier` vĩnh viễn (`percentAtFullTier` trên `stats[]`); không chạm mana (mana thuộc Pháp Tu).
- Passive mở ra hiển thị như phần thưởng cố định — không có progress bar từng phần như Luyện Thể.

## Bảng mạch

| Đường | Tầng yêu cầu | Cost đan | Stat | % |
|---|---|---|---|---|
| Nhâm Mạch | 2 | 1 | maxHp | 5 |
| Đới Mạch | 4 | 2 | defense | 5 |
| Âm Kiều Mạch | 6 | 4 | hpRegenPerTurn | 8 |
| Âm Duy Mạch | 8 | 7 | maxHp | 5 |
| Dương Duy Mạch | 10 | 11 | attack | 5 |
| Dương Kiều Mạch | 12 | 16 | criticalRate | 4 |
| Xung Mạch | 14 | 22 | maxHp | 8 |
| Đốc Mạch | 16 | 30 | 5 main stat | 5 |
| Kỳ Kinh Thiên Địa Chi Kiều | 18 | 40 + Thiên Địa Chi Kiều | maxHp + hpRegenPerTurn | 10 |

## Nguồn Thông Mạch Đan

Luyện từ Yêu Đan boss Luyện Khí tầng 10 (xem [alchemy.md](./alchemy.md), [enemies-stages.md](./enemies-stages.md)). Đây là sink chính của đan luyện chế Luyện Khí ngoài đan tu vi.

## Liên quan

- [body-refinement.md](./body-refinement.md) — hệ song song ở Phàm Nhân.
- [tribulation.md](./tribulation.md) — mạch thông suốt là một trong các đầu tư nâng bậc Kiến Cơ.
