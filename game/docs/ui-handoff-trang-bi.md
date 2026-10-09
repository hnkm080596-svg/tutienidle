# Bàn giao Trang Bị (reskin theo preview Codex)

Nguồn thiết kế: `src/ui-preview/HomeEquipmentArtPanel.vue` + `src/ui-preview/equipment/EquipmentForgePreview.vue` (mount qua `ui-landscape-design.html`).
Code live: `src/components/scenes/equipment/EquipmentSurface.vue` + `src/components/panels/equipment-hall/*Tab.vue` + `src/components/panels/bag-sections/EquipmentBagSection.vue` + `src/components/panels/EquipmentPaperdoll.vue`.

## 1. Chức năng đã nối

| Chức năng | Vị trí preview | Cách nối |
|---|---|---|
| 6 socket tròn + nhãn | Paperdoll trái 3×33% / phải 3×33% | `EquipmentPaperdoll.vue` → `SlotView variant="circle"` (ruling 2026-10-08: art preview merge VÀO SlotView – ring `equipment-circle-frame-v1` do component tự vẽ, seal/badge/hover-frame không mount theo preview nhưng rank/badge vẫn chảy vào tooltip + aria). Click socket: tab Trang Bị = tháo (`unequipOnSelect`); tab op = chọn item cho op, không tháo (ruling 4) |
| Thuộc Tính Trang Bị | Card dưới doll | `equipmentOps.getEquipmentModifiers()` – chỉ số cộng dồn từ trang bị mặc thật (fix: trước đọc `player.modifiers` → toàn 0) |
| Túi: toolbar 2 dropdown + lưới | Card phải | Bag thật; lưới ≥40 ô + cuộn. Ô túi = `SlotView variant="bag"` → art `item-slot-v1.png` của preview (ruling 1b): `--slot-bg-image` ép qua `:is(#app)` để thắng rule slot-frame global; InkNineSlice khỏi SlotView. Ruling 2026-10-08: header (title/4-100/＋/Hóa-Luyện) + chips + footer bỏ; toolbar = 2 `BagChipSelect` (chip art `equipment-filter-*-v2`, list trên nine-slice card túi, bấm ngoài = đóng, text 16px): dropdown Loại item (Tất cả + 6 loại) + dropdown Sắp Xếp (Mặc Định/Phẩm/Chất/Cảnh Giới/Vị Trí/Tên/Lần Rèn — labels không "Theo"; bấm lại cùng mode = lật chiều `toggleBagSortDirection`, chip hiện ↑/↓); pager `‹ x/y ›` giữa toolbar, ẩn khi ≤1 trang (40 ô/trang 8×5); `x/100` hạn túi ghim mép phải (display-only, chưa có cap thật); lọc theo chất bỏ khỏi UI. Backdrop card workspace: `border-image 90/15px` (EquipmentArtCard mẫu, thay background stretch). Grid: `grid-auto-rows:auto` + `align-content:end` — gap 5px đều 2 chiều, neo đáy |
| Dải 6 tab dưới tiêu đề | Preview có 4 tab | Chuyển workspace thật; Tẩy/Tinh/Phân Giải khóa theo `betaFeatureFlags` |
| Cường Hóa | Branch `enhance` | Seal `+n » +n+1`, bảng stat trước/sau thật, materials thật, nút vàng |
| Tẩy Luyện | Branch `wash` | 2 cột Hiện Tại/Kết Quả + Điểm Rèn + materials + ticket Giữ/Hủy thật |
| Tinh Luyện | Branch `refine` | Hàng affix + ống fill % trần bậc + khóa tối đa N-1 + rule/cost + materials + ticket |
| Hóa Luyện | Không có trong preview | Reskin theo cùng ngôn ngữ: filter dark + lưới SlotView + preview reward + confirm 2 bước |
| Phân Giải | Không có trong preview | Light reskin: title + chrome dark cho select/slider/ore chips |

## 2. Chưa nối (đúng thiết kế, cả hai bên đều simulate)

- Nút "+" mở rộng túi + số `n/100`: **backlog** — domain không có giới hạn túi thật (`BAG_DISPLAY_CAPACITY=100` chỉ là hằng hiển thị trong EquipmentBagSection). Ruling 3: giữ UI, làm giới hạn thật sau.
- Tên dài item tràn — chưa có quy định màn nhỏ.

## 3. Khác biệt chủ quan / chờ ruling

1. **Hóa Luyện xuất hiện 2 chỗ**: tab riêng + nút header túi (preview chỉ có nút).
2. **Phân Giải**: code có, preview không có vị trí — đang là tab thứ 6.
3. **Chọn item cho op**: preview chọn qua socket doll; live dùng strip tròn trong card (per-slot, cần cho cả item đang mặc lẫn trong túi). Strip = `SlotView variant="circle" static` trong button của EnhanceTab/WashTab/RefineTab (span role=img, không lồng button); strip giữ `+level` badge riêng + spec selected/hover calmer (`:deep(.slot-view__ring-art)`), icon-wrap 14%.
4. **Cột `+x.x%`** trên bảng Cường Hóa — preview không có (giữ vì hữu ích).
5. **Tẩy Luyện không có nút khóa** per-dòng — domain không hỗ trợ `lockedIndices`; preview có.
6. **Tinh Luyện**: preview có nút refine từng dòng; domain chỉ roll cả item theo `lockedIndices` → cột action map thành toggle khóa (đã ghi chú trong template).
7. **Nhân vật idle động** giữa doll — preview không có figure (ruling Minh: mount theo đạo lộ). Mannequin fallback (`equipment-paperdoll-base`) là FIGURE đậm thiết kế riêng của Minh (ruling 5): global `tien-hiep-ui.css:50` giờ `width:auto; max-width:88%; height:92%; object-fit:contain; opacity:1` — scoped chỉ còn định vị, không còn đè mờ 55%.
7b. **Tier affix**: giữ quy ước global `qi-hall.css` (tier-5 gradient, ruling 6) — các block `.qi-hall__tier-*` tái định nghĩa flat trong Wash/Refine đã gỡ, một chủ sở hữu duy nhất.
8. Tên ô: Đạo-family (ruling) vs Vũ Khí/Đầu/… trong preview.
9. Lưới túi cuộn được (chức năng thật) vs preview 40 ô cố định.

## 4. Kiểm tra

- vue-tsc `--noEmit -p tsconfig.app.json`: sạch.
- Vitest equipment-hall + panel + paperdoll: **43/43 pass** (Node 24; Node 20.19 thiếu `markAsUncloneable` → jsdom worker không chạy được, lỗi môi trường).
- Selector test đã cập nhật sang markup mới; assertion hành vi giữ nguyên (2-step confirm, discard ticket, cost, reactivity).
- Màu tier affix: `qi-hall__tier-N` về một chủ `qi-hall.css` (ruling 6 — gradient tier-5 của global thắng; scoped redef trong Wash/Refine đã gỡ).
- `MATERIAL_CATEGORY_ART` fallback: material thiếu `icon` (Luyện Khí Tinh Hoa, Linh Thạch) lấy icon theo `category`.

## 5. Dọn rác đã verify (B5, Minh duyệt 2026-10-08)

Đã xóa sau khi tự verify đường logic không-thể-tới:
- 3 file 0-importer: `scenes/equipment/detail/EquipmentItemDetail.vue`, `scenes/equipment/bag/EquipmentBagPanel.vue`, `equipment-hall/EquipmentBagRail.vue`.
- Nhánh `(đang mặc)` trong EquipmentBagSection — túi chỉ render đồ chưa mặc.
- `useEquipmentActions.wash()` + `equipmentOps.washItem` — đường tắt một-bước bypass ticket; flow thật: `washPreview` → vé → `washCommit`. Domain `equipmentSystem.washAffixes` GIỮ (dormant có test riêng).
- 2 link preview `ui-equipment.html`/`ui-inventory.html` trong ForgeFidelityScene.
- `useEquipmentActions.refine()` one-shot — anh em của `wash()` (0 caller, bypass flow vé; ruling XÓA 2026-10-08).
- `state.marker='equipped'` trong EquipmentBagSection — nhánh `instance.equipped` chết cùng loại.
- Chức năng find (BỎ HẲN): test describe `search narrows...` + helper `countText` + key `panels.bag.search.equipmentPlaceholder/equipmentAria` (vi+en).
- `DissolveTab` slot → `variant="bag"` (đồng nhất item-slot-v1 với lưới túi).

Fix chức năng theo ruling:
- toneMatches 'Tử': `rank>=3` → `rank===3||rank===4` (Tử=Địa+Thiên, Kim=rank 5 — sửa lỗi Tử nuốt Kim).
- h1 thêm `class="equipment-title"` → plaque + OngDoGia + th-title-shine như panel anh em (ruling 11).
- Hit-area socket: `slot-view--circle` `border-radius:50%` — click bám theo vòng tròn thay vì ô vuông (ruling 14).

BUG THẬT bắt được nhờ test: `:item="cell"` truyền `undefined` cho ô đệm → `props.item !== null` đúng → cả 40 ô trống bị gắn `slot-view--filled` (mọi cell render "có đồ": viền filled + tooltip rỗng). Sửa `:item="cell ?? null"` — test chip giờ xanh 38/38.

KHÔNG phải rác (giữ, đã verify sống): `emit('action')` (preview harness lắng nghe), `@click.self` (bấm mép đóng panel — đã test), `import player` (idle clip), `notice` prop (preview truyền thật), 5 comparator sort dormant (UI nối mode sau — ghi note).

## 6. Đã verify trên màn (dev server)

- Trang Bị: sheet đúng rect/art Công Pháp, doll idle theo đạo lộ, socket tròn + nhãn, card stats số thật, túi đầy đủ chrome.
- Tiêu đề "Trang Bị" lên plaque chữ thư pháp + shine (computed: UTM OngDoGia + th-title-shine); slot radius 50%.
- Ô túi trống giờ render `<button>` empty đúng (sau fix `cell ?? null`).
- Cường Hóa / Tẩy Luyện / Tinh Luyện / Hóa Luyện / Phân Giải: không còn lớp `qi-hall__*` chồng lên card mới.
- Mục 12 (workspace card): `.equipment-bag/.equipment-forge` đã dùng `border-image` nine-slice đúng chuẩn; `background:100% 100%` chỉ còn trên Ô SLOT nhỏ (cell vuông khớp art vuông `item-slot-v1` — border-image vào ô nhỏ sẽ bóp góc, nên giữ stretch là đúng).
- Beta flag: chỉ flip tạm để verify, đã revert.
