# Tâm Pháp (Technique)

**Trạng thái:** Live.

Core: `core/technique/Technique.ts`, `TechniqueSystem.ts`, `TechniqueManager.ts`, `TechniqueTier.ts`. Data: `data/technique/Techniques.ts`. UI: `TechniquePanel.vue` (standalone `technique`) + `ScripturePavilionPanel.vue`.

## Mô hình

- Chỉ **1 tâm pháp trang bị** cho toàn hệ thống — `TechniqueSystem.equip()` tự unequip cái cũ; không còn chia slot theo loại.
- `learn()` thêm vào `TechniqueManager` (unlocked, chưa equipped); `chooseCultivationPath()` tự học+equip tâm pháp của path.
- `insight` — thanh kinh nghiệm riêng của tâm pháp, nuôi bởi Cảm ngộ Tâm Pháp từ combat (vào tâm pháp đang equip; hết trần/không equip thì mất).

## Tier: Sơ Nhập → Tiểu Thành → Đại Thành → Viên Mãn

`getTechniqueTierProgress(insight)` — tổng yêu cầu `BASE_TECHNIQUE_INSIGHT_REQUIRED × insightMultiplier` (mặc định 1000), chia share so_nhap 10% / tieu_thanh 20% / dai_thanh 30% / vien_man 40% (ngưỡng lũy kế 0/0.1/0.3/0.6).

`tierEffects` cấp theo tier (xem `TechniqueTierEffect`):

- `attackFlat` / `defenseFlat` — cộng phẳng.
- `maxMpPercent`, `manaRegenPercent` — % lên maxMp và `manaRegenPerSecond` (Increased, qua pipeline percent chuẩn — **không** phải % của maxMp).
- `hpRegenFlat` / `mpRegenFlat` — hồi phẳng HP/lượt và MP/s.

`combatModifiers` — modifier thêm độc lập tier (ví dụ Tiểu Ngũ Hành Quyết: `+2 attackRange` cố định), tổng hợp qua `GameManager.getAggregatedModifiers()`.

## Tâm pháp hiện có (`TECHNIQUES`)

| id | Tên | Realm | Vai trò |
|---|---|---|---|
| `tu_linh_quyet` | Tụ Linh Quyết | — | khởi đầu, Công/Phòng phẳng |
| `dai_ngu_hanh_chan_quyet` | Tiểu Ngũ Hành Quyết | — | Pháp Tu (Luyện Khí), ×3 insight |
| `dai_ngu_hanh_quyet_truc_co` | Đại Ngũ Hành Quyết | foundation_establishment | Pháp Tu Trúc Cơ, ×4 insight |
| `ngu_kiem` | Ngự Kiếm Tâm Kinh | — | Kiếm Tu |
| `thai_hu_kiem_quyet` | Thái Hư Kiếm Quyết | — | Kiếm Tu nâng cao |
| `kim_cang_bat_hoai_the` | Kim Cang Bất Hoại Thể | — | hướng Thể Tu (placeholder content) |
| `van_kiem_quyet` | Vạn Kiếm Quyết | — | Kiếm Tu |

`requiredRealmId` gate trang bị; `resourceLabel` đổi nhãn thanh tài nguyên (vd "Pháp Lực").

## Liên quan

- [cultivation-paths.md](./cultivation-paths.md) — path tự trang bị tâm pháp.
- [stats.md](./stats.md) — `sourceType: 'technique'`.
- [drops-loot.md](./drops-loot.md) — nguồn Cảm ngộ Tâm Pháp.
