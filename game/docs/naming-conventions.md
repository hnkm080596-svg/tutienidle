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

Terminology chốt (2026-09-02, user schema): **"Phẩm" = bậc cảnh giới tương quan của item (10 bậc, Cửu→Tiên Phẩm)**; **"Chất" = chất lượng (5 bậc)**. Mỗi trục có thể mang tên riêng theo loại item (Phẩm: cảnh giới nhân vật / Phàm Khí trang bị / Cửu Phẩm đan; Chất: cấp đột phá nhân vật / Hoàng→Tiên Chất trang bị / Thập niên nguyên liệu) — nhưng KHÔNG BAO GIỜ gắn nhãn 5-bậc chất lượng bằng từ "Phẩm".

| Trục | Type | Bậc | Ý nghĩa |
|---|---|---|---|
| Phẩm | `ProfessionGrade` (10: Cửu→Tiên Phẩm) | 10 | Cảnh giới tương quan — trang bị (`equip` gate), Phù/Trận (`Talisman.grade`/`Formation.grade`), Đan có thể mang thêm (`Pill.professionGrade`, UI ưu tiên) |
| Chất | `ItemQuality` (trang bị, "Hoàng→Tiên Chất") • `ItemGrade` (Đan, "Hoàng→Tiên Chất" — labels đồng bộ 2026-09-02) • `ArtifactGrade` (pháp bảo, "Phàm→Tiên Chất") • age axis nguyên liệu (Thập/Bách/Bách niên...) | 5 | Chất lượng trong cùng phẩm |

Cấm dùng từ "phẩm" để chỉ trục 5-bậc chất lượng, và ngược lại.

## Family language map

Thuần Eng: realms (`mortal`, `qi_refining`, `foundation_establishment`…), buildings, enemies, pills, stages, stats, battle states.
Thuần VN pinyin: skills (prefix cơ chế `passive_` được phép đứng trước gốc VN), techniques, materials flavor (thảo mộc/kim loại/xương), zones.
Giữ nguyên đã đạt N3: CultivationPathId `phap_tu/kiem_tu`.

## Save v41

Đổi values/fields trong save ⇒ bump `CURRENT_SAVE_VERSION` = 41 (convention no-migration: save cũ bị từ chối, có màn cứu Export/Backup sẵn).
