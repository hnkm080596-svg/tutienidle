# Bàn giao Trang Bị (reskin theo preview Codex)

Nguồn thiết kế: `src/ui-preview/HomeEquipmentArtPanel.vue` + `src/ui-preview/equipment/EquipmentForgePreview.vue` (mount qua `ui-landscape-design.html`).
Code live: `src/components/scenes/equipment/EquipmentSurface.vue` + `src/components/panels/equipment-hall/*Tab.vue` + `src/components/panels/bag-sections/EquipmentBagSection.vue` + `src/components/panels/EquipmentPaperdoll.vue`.

## 1. Chức năng đã nối

| Chức năng | Vị trí preview | Cách nối |
|---|---|---|
| 6 socket tròn + nhãn | Paperdoll trái 3×33% / phải 3×33% | `EquipmentPaperdoll.vue` – click socket = select + tháo trang bị (hành vi thật, preview chỉ select) |
| Thuộc Tính Trang Bị | Card dưới doll | `equipmentOps.getEquipmentModifiers()` – chỉ số cộng dồn từ trang bị mặc thật (fix: trước đọc `player.modifiers` → toàn 0) |
| Túi: count `n/100`, chips lọc, lưới, Phẩm Chất/Sắp Xếp | Card phải | Bag thật; lưới ≥40 ô + cuộn (preview 40 ô cố định) |
| Nút "Hóa Luyện" header túi | Header túi | `selectWorkspace('dissolve')` (preview chỉ simulate) |
| Dải 6 tab dưới tiêu đề | Preview có 4 tab | Chuyển workspace thật; Tẩy/Tinh/Phân Giải khóa theo `betaFeatureFlags` |
| Cường Hóa | Branch `enhance` | Seal `+n » +n+1`, bảng stat trước/sau thật, materials thật, nút vàng |
| Tẩy Luyện | Branch `wash` | 2 cột Hiện Tại/Kết Quả + Điểm Rèn + materials + ticket Giữ/Hủy thật |
| Tinh Luyện | Branch `refine` | Hàng affix + ống fill % trần bậc + khóa tối đa N-1 + rule/cost + materials + ticket |
| Hóa Luyện | Không có trong preview | Reskin theo cùng ngôn ngữ: filter dark + lưới SlotView + preview reward + confirm 2 bước |
| Phân Giải | Không có trong preview | Light reskin: title + chrome dark cho select/slider/ore chips |

## 2. Chưa nối (đúng thiết kế, cả hai bên đều simulate)

- Nút "+" mở rộng túi — preview cũng chỉ bắn notice.
- Tên dài item tràn — chưa có quy định màn nhỏ.

## 3. Khác biệt chủ quan / chờ ruling

1. **Hóa Luyện xuất hiện 2 chỗ**: tab riêng + nút header túi (preview chỉ có nút).
2. **Phân Giải**: code có, preview không có vị trí — đang là tab thứ 6.
3. **Chọn item cho op**: preview chọn qua socket doll; live dùng strip tròn trong card (per-slot, cần cho cả item đang mặc lẫn trong túi).
4. **Cột `+x.x%`** trên bảng Cường Hóa — preview không có (giữ vì hữu ích).
5. **Tẩy Luyện không có nút khóa** per-dòng — domain không hỗ trợ `lockedIndices`; preview có.
6. **Tinh Luyện**: preview có nút refine từng dòng; domain chỉ roll cả item theo `lockedIndices` → cột action map thành toggle khóa (đã ghi chú trong template).
7. **Nhân vật idle động** giữa doll — preview không có figure (ruling Minh: mount theo đạo lộ).
8. Tên ô: Đạo-family (ruling) vs Vũ Khí/Đầu/… trong preview.
9. Lưới túi cuộn được (chức năng thật) vs preview 40 ô cố định.

## 4. Kiểm tra

- vue-tsc `--noEmit -p tsconfig.app.json`: sạch.
- Vitest equipment-hall + panel + paperdoll: **43/43 pass** (Node 24; Node 20.19 thiếu `markAsUncloneable` → jsdom worker không chạy được, lỗi môi trường).
- Selector test đã cập nhật sang markup mới; assertion hành vi giữ nguyên (2-step confirm, discard ticket, cost, reactivity).
- Màu tier affix: rule `qi-hall__tier-N` nhúng scoped trong Wash/Refine — không còn phụ thuộc `qi-hall.css` (chỉ load qua overlay cũ).
- `MATERIAL_CATEGORY_ART` fallback: material thiếu `icon` (Luyện Khí Tinh Hoa, Linh Thạch) lấy icon theo `category`.

## 5. Đã verify trên màn (dev server)

- Trang Bị: sheet đúng rect/art Công Pháp, doll idle theo đạo lộ, socket tròn + nhãn, card stats số thật, túi đầy đủ chrome.
- Cường Hóa / Tẩy Luyện / Tinh Luyện / Hóa Luyện / Phân Giải: không còn lớp `qi-hall__*` chồng lên card mới.
- Beta flag: chỉ flip tạm để verify, đã revert.
