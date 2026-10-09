# Báo cáo trạng thái SlotView — scope Trang Bị

Cập nhật 2026-10-08. Mọi con số đã đếm trên code thật; mục "ai gọi" chỉ tính caller trong phạm vi Trang Bị (SlotView là component common — scope khác có thể dùng những nhánh này).

## 1. SlotView đang render ở đâu trong Trang Bị

| Vị trí | Variant | Cách gọi |
|---|---|---|
| 6 socket doll (Đạo Khí/Bào/Hài/Quan/Linh Giới/Linh Châu) | `circle` | `EquipmentPaperdoll.vue` |
| Lưới túi 40 ô | `equipment` | `EquipmentBagSection.vue` |
| Hàng "đồ đang mặc" trong 3 tab op (Cường Hóa/Tẩy/Tinh) | `circle` + `static` | EnhanceTab/WashTab/RefineTab |
| Ô nguyên liệu trong op tabs | `equipment` + `static` | EnhanceTab/WashTab/RefineTab |
| Lưới chọn đồ Phân Giải | `equipment` | DissolveTab (tab khóa trong beta) |
| Đầu card tooltip (xem trước item) | `static` | `ItemCardBody.vue` (v-bind slotPreview) |

## 2. Variant — 4 hình thái ô

| Variant | Tác dụng | Trạng thái trong scope |
|---|---|---|
| `equipment` | Ô trang bị vuông — art `item-slot-v1.png` của preview (nền + viền một ảnh) | SỐNG (túi + material + dissolve) |
| `circle` | Socket tròn — art `equipment-circle-frame-v1.png`; TẮT seal/badge/hover-frame (preview không vẽ), data vẫn đi tooltip/aria | SỐNG (doll + op rows) |
| `bag` | Dành cho lưới Trữ Vật sau này — hiện cùng art item-slot-v1 | DORMANT (chưa có caller trong scope này; chờ Trữ Vật) |
| `item` | Ô mặc định mọi nơi khác | KHÔNG dùng trong Trang Bị |

## 3. Trục dữ liệu (không phải trạng thái tương tác)

| Lớp | Số trường hợp | Mô tả | Trạng thái |
|---|---|---|---|
| filled/empty | 2 | Có item hay ô trống (ô trống chỉ còn khung, vẫn tooltip điều kiện nếu có) | SỐNG |
| icon | icon có / lỗi → monogram chữ cái đầu | Icon PNG trong suốt; hỏng thì rơi về chữ đầu tên | SỐNG |
| amount | số lượng | Số nhỏ góc ô (ít gặp ở trang bị) | SỐNG |
| **Phẩm** (nghề) | 10 bậc Nhất→Thập | Ấn triện góc trái: khung `seal-frame.png` + chữ Hán 一→十 theo `equipmentQualityRank` | SỐNG |
| **Chất** | 5 bậc Hoàng/Huyền/Địa/Thiên/Tiên | `rarityRank` 1-5 → màu viền/glow theo `--rank-color-*`; rank≥3 phát aura, ≥4 thêm border-beam động, =5 có thanh "kịch trần" | SỐNG |
| tooltip | card nội dung tự do | `ItemCardBody` render card so sánh/chi tiết | SỐNG |
| nameSegments | cấu trúc tên nhiều đoạn | Chỉ vào tooltip (ô không hiện tên — ruling 10) | SỐNG |
| badge `enhance` | `+N` | Góc socket doll, cấp cường hóa >0 mới hiện | SỐNG |

## 4. Trục trạng thái (`state` prop — 5 trục semantic loại trừ nhau)

| Trục | Số trường hợp | Giá trị → hiển thị | Trong Trang Bị |
|---|---|---|---|
| availability | 3 | available (bấm được) / disabled (veil xám, tooltip lý do) / locked (veil khóa) | **RÁC trong scope — 0 caller** |
| interaction | 3 | idle / selected (outline vàng đậm) / processing (veil xử lý, khóa click) | DORMANT — chỉ DissolveTab set `selected`, tab đang khóa + sắp chuyển Trữ Vật |
| validation | 4 | neutral / valid ✓ / invalid ✕ / missing ! — glyph + ring màu | **RÁC trong scope — 0 caller** |
| marker | 3 | none / equipped / new — tem góc | **RÁC trong scope** (`equipped` đã xóa theo ruling; `new` 0 caller) |
| comparison | 3 | neutral / upgrade / downgrade — chỉ số so sánh | **RÁC trong scope — 0 caller** |

| Badge kind (lớp tem) | Số loại | Trong Trang Bị |
|---|---|---|
| enhance | `+N` cường hóa | SỐNG (doll socket) |
| equipped / new / comparison | 3 loại còn lại | **RÁC trong scope — 0 caller** |

## 5. Trạng thái con trỏ / hiển thị (CSS, không qua prop)

| Trạng thái | Cơ chế hiện tại | Cơ chế preview Codex | Trạng thái |
|---|---|---|---|
| hover | phủ ảnh `slot-frame-hover.png` (bộ art cũ) lên trên | `filter: brightness(1.65)` + glow vàng trên CHÍNH art ô | SỐNG — khác preview |
| selected | outline vàng phẳng 2px | `brightness(1.8)` + glow đậm | DORMANT (DissolveTab) |
| pressed/active | không có | `brightness(0.88)` | KHÔNG CÓ |
| focus-visible | outline vàng | outline vàng | SỐNG |
| empty | giữ khung, mất icon | giữ khung, mất icon | SỐNG |
| quality tử/lam (nhuộm frame) | không (Chất đi qua aura/beam riêng) | `hue-rotate` trên frame | KHÔNG dùng (ý đồ khác nhau) |
| `static` | role=img, tắt click/tooltip/hover | — | SỐNG (op rows, card preview) |

## 6. Kết luận

- **Live**: 12 lớp/trạng thái (xem mục 3 + 5).
- **Dormant**: variant `bag` (chờ Trữ Vật), `interaction.selected` (DissolveTab khóa).
- **Rác trong scope Trang Bị**: `availability`, `validation`, `marker`, `comparison`, 3 badge kind `equipped/new/comparison`, `interaction.processing` — tổng **6 nhánh 0 caller**. Tất cả là nhánh của component common nên có thể sống ở scope khác — KHÔNG xóa ở đây, chỉ ghi nhận.
- **Lệch preview còn tồn tại**: hover/selected chưa theo cơ chế filter của Codex (vẫn overlay art cũ + outline); pressed chưa có; Codex KHÔNG vẽ art trạng thái riêng — toàn bộ là filter trên 1 art.
