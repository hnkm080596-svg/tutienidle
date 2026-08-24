# Naming Conventions — Milestone Save v41

Áp dụng từ đợt chuẩn hóa naming 2026-08-24. Mọi identifier mới PHẢI theo quy tắc này.

## Quy tắc

| # | Quy tắc |
|---|---|
| **N1** | Mechanic/system identifier = English: stat key, battle state, save field kỹ thuật, cấu trúc cơ chế (building cơ cấu, token tiến trình, affix). |
| **N2** | Content flavor = pinyin VN không dấu, nhất quán trong từng family (chiêu thức, tâm pháp, thảo mộc, cảnh giới hiển thị). |
| **N2b** | Id content SUY RA từ display name hiện có: bỏ dấu (đ→d), lowercase, ghép `_`. Không tự bịa tên mới. |
| **N3** | Cấm trộn 2 thứ tiếng trong cùng một id và trong cùng một family. |
| **N4** | Data id = `snake_case`; CSS class = BEM kebab-case; constant = SCREAMING_SNAKE. |
| **N5** | UI display strings (tiếng Việt có dấu người chơi thấy) không bao giờ đổi qua việc rename. |

## Hai trục phẩm chất — PHÂN BIỆT BẮT BUỘC

| Trục | Type | Values | CSS var | Ý nghĩa |
|---|---|---|---|---|
| Quality (9 bậc "khí") | `EquipmentQuality` | `pham_khi…thien_dia_trong_khi` | `--eq-quality-{value}` | Gate tiềm năng: trần affix tier, pool, forge point, implicit multiplier |
| Grade (5 phẩm) | `ItemGrade` | `hoang/huyen/dia/thien/tien` | `--grade-{value}` | Thang phẩm chung Đan/Phù/Trận; với trang bị = mật độ affix (field `rarity`) |

Cấm dùng từ "pham"/"rarity" để chỉ quality, và ngược lại.

## Family language map

Thuần Eng: realms (`mortal`, `qi_refining`, `foundation_establishment`…), buildings, enemies, pills, stages, stats, battle states.
Thuần VN pinyin: skills (prefix cơ chế `passive_` được phép đứng trước gốc VN), techniques, materials flavor (thảo mộc/kim loại/xương), zones.
Giữ nguyên đã đạt N3: CultivationPathId `phap_tu/kiem_tu`.

## Save v41

Đổi values/fields trong save ⇒ bump `CURRENT_SAVE_VERSION` = 41 (convention no-migration: save cũ bị từ chối, có màn cứu Export/Backup sẵn).
