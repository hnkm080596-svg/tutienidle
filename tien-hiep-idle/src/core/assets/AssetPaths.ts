// Bảng tra path asset (ảnh nền Stage/icon Building) — gom lại 1 chỗ để
// dễ sửa/thêm, KHÔNG gắn vào UI người chơi (khác AssetReferencePanel.vue
// cũ, đã bị xoá vì lẫn nhầm vào nav thật — xem ghi chú Exploration
// Rework). File này CHỈ là bảng tra thuần data, không tự render/load
// gì cả — code tiêu thụ (MainScene.ts cho backdrop, HomeBuildingIcons.vue/
// BuildingConstructionGate.vue cho icon...) phải tự import và dùng.
//
// Convention: asset thật đặt trong `tien-hiep-idle/public/assets/...`
// (Vite serve nguyên trạng nội dung `public/`, path bắt đầu bằng `/`
// là gốc `public/`) — dùng thẳng được như string trong Phaser's
// `load.image()` hay `<img src>`, không cần import qua bundler. Thêm
// file ảnh vào đúng thư mục con rồi sửa giá trị tương ứng dưới đây.
//
// MỖI DÒNG DƯỚI ĐÂY ĐỀU CÓ COMMENT TÊN VIỆT — key chỉ là id kỹ thuật
// (khớp game data), không tự nói lên đây là cái gì, nên đọc theo
// comment cuối dòng khi cần biết "ô này ứng với món nào trong game".

// Ảnh nền cho từng Stage (Zone "Thanh Vân", tầng 1-10 = Quật 1-10, xem
// data/stage/Zones.ts/Stages.ts) — key PHẢI khớp đúng Stage.id (tên
// địa hình cũ trong comment cuối dòng CHỈ còn giá trị tham khảo id kỹ
// thuật, tên hiển thị thật giờ là "Quật N"). Chưa có nơi nào trong code
// đọc bảng này — MainScene.vue hiện tô màu nền phẳng (`#0b0b10`), cần
// tự nối khi có ảnh thật.
export const STAGE_BACKDROP_PATHS: Record<string, string> = {
  qi_refining_forest: '/assets/backdrops/qi_refining_forest.png', // Quật 1 (rừng)
  qi_refining_deep_forest: '/assets/backdrops/qi_refining_deep_forest.png', // Quật 2 (rừng sâu)
  qi_refining_ember_canyon: '/assets/backdrops/qi_refining_ember_canyon.png', // Quật 3 (hẻm núi lửa)
  qi_refining_scorched_ridge: '/assets/backdrops/qi_refining_scorched_ridge.png', // Quật 4 (sườn núi cháy)
  qi_refining_sand_plain: '/assets/backdrops/qi_refining_sand_plain.png', // Quật 5 (đồng cát)
  qi_refining_stone_range: '/assets/backdrops/qi_refining_stone_range.png', // Quật 6 (dãy núi đá)
  qi_refining_blade_peak: '/assets/backdrops/qi_refining_blade_peak.png', // Quật 7 (đỉnh núi kim)
  qi_refining_mineral_pit: '/assets/backdrops/qi_refining_mineral_pit.png', // Quật 8 (hầm khoáng)
  qi_refining_mystic_marsh: '/assets/backdrops/qi_refining_mystic_marsh.png', // Quật 9 (đầm lầy)
  qi_refining_abyssal_pool: '/assets/backdrops/qi_refining_abyssal_pool.png', // Quật 10 (vực nước)
}

// Dùng khi 1 Stage chưa có entry riêng trong STAGE_BACKDROP_PATHS
// (Stage mới thêm sau quên khai báo).
export const DEFAULT_BACKDROP_PATH = '/assets/backdrops/default.png' // Nền dự phòng chung

// Ảnh nền Home Scene (thôn làng lúc KHÔNG trong trận, xem
// HomeBuildingIcons.vue) — tách riêng khỏi STAGE_BACKDROP_PATHS vì
// đây không phải combat, không gắn với Stage.id nào cả. MainScene.vue
// hiện tô màu nền phẳng (`#0b0b10`).
export const HOME_SCENE_BACKDROP_PATH = '/assets/backdrops/home.png' // Nền thôn làng (Home Scene)

// Icon cho từng Building — key PHẢI khớp đúng Building.id (xem
// data/building/buildings.ts). HomeBuildingIcons.vue/
// BuildingConstructionGate.vue hiện vẽ hình học placeholder (chữ cái
// đầu tên trong vòng tròn), chưa đọc bảng này.
export const BUILDING_ICON_PATHS: Record<string, string> = {
  herb_garden: '/assets/buildings/herb_garden.png', // Linh Thảo Viên (vườn 9 ô gieo hạt)
  linh_tuyen: '/assets/buildings/linh_tuyen.png', // Linh Tuyền (tự sinh Linh Thạch)
  smelter: '/assets/buildings/smelter.png', // Lò Luyện (quặng thô → Huyền Thiết)
  thien_cong_phuong: '/assets/buildings/thien_cong_phuong.png', // Thiên Công Phường (Linh Mộc → Phù Chỉ)
  equipment_hall: '/assets/buildings/equipment_hall.png', // Khí Đường (trang bị)
  pill_room: '/assets/buildings/pill_room.png', // Đan Phòng (luyện đan)
  formation_altar: '/assets/buildings/formation_altar.png', // Trận Đài (chế trận)
  talisman_institute: '/assets/buildings/talisman_institute.png', // Phù Viện (chế phù)
  teleport_array: '/assets/buildings/teleport_array.png', // Truyền Tống Trận (mở Thám Hiểm)
  gathering_outpost: '/assets/buildings/gathering_outpost.png', // Khai Thác (mở Tầm Bảo)
}

// Ảnh nền cho từng "trang" panel trái (LeftPanel.vue) — key PHẢI khớp
// đúng LeftPanelMode (xem stores/ui.ts; KHÔNG import type đó vào đây,
// core/ không phụ thuộc tầng store, cùng lý do BuildingFunctionType tự
// định nghĩa lại union con trong Building.ts). Mọi panel hiện tô màu
// phẳng `var(--ink-900)` (xem assets/theme.css). Tên trong ngoặc =
// nhãn hiện trong menu (NavMenuOverlay.vue), không phải tên biến.
export const PANEL_BACKDROP_PATHS: Record<string, string> = {
  character: '/assets/panels/character.png', // Động Phủ (trang Nhân Vật)
  inventory: '/assets/panels/inventory.png', // Hành Trang (túi đồ)
  loadout: '/assets/panels/loadout.png', // Công Pháp (skill/tâm pháp đang trang bị)
  exploration: '/assets/panels/exploration.png', // Tầm Bảo (thu thập tự động)
  settings: '/assets/panels/settings.png', // Cài Đặt
  equipment_hall: '/assets/panels/equipment_hall.png', // Khí Đường (trang bị)
  formation_altar: '/assets/panels/formation_altar.png', // Trận Đài (chế trận)
  talisman_institute: '/assets/panels/talisman_institute.png', // Phù Viện (chế phù)
  pill_room: '/assets/panels/pill_room.png', // Đan Phòng (luyện đan)
  scripture_pavilion: '/assets/panels/scripture_pavilion.png', // Tàng Kinh Các (Công Pháp/Lore)
  stage_select: '/assets/panels/stage_select.png', // Thám Hiểm (chọn Địa Giới/Màn để đánh)
}

// Thanh dưới (BottomBar.vue, chứa BattleControls + DongFuQuickNav) —
// khối layout cố định, không đổi theo mode như PANEL_BACKDROP_PATHS.
// RIGHT_PANEL_BACKDROP_PATH (cột phải, nút Menu tròn) đã gỡ cùng
// RightPanel.vue — UI redesign thay bằng DongFuTopBar.vue.
export const BOTTOM_BAR_BACKDROP_PATH = '/assets/ui/bottom-bar.png' // Thanh dưới cùng (Pause/Auto)

// Tooltip.vue — hiện chỉ 1 hộp `rgba(15,15,20,0.96)` + viền `#444`
// (không dùng token theme.css, xem lại Tooltip.vue nếu muốn đồng bộ
// màu trước khi thêm ảnh nền). Dùng cho MỌI loại tooltip (cả tooltip
// thường lẫn 5 loại có cấu trúc Technique/Pill/Talisman/Formation/
// Equipment bên dưới — cùng 1 khung nền).
export const TOOLTIP_BACKDROP_PATH = '/assets/ui/tooltip.png' // Nền hộp tooltip (mọi loại)

// Khung hộp thoại DÙNG CHUNG — NavMenuOverlay.vue (bảng Menu)/
// TutorialOverlay.vue (hướng dẫn nhập môn)/OfflineSummaryModal.vue
// (Bế Quan Kết Thúc)/SaveIncompatibleScreen.vue (lỗi save)/
// ErrorScreen.vue đều tự vẽ 1 khối `.xxx__panel` giống hệt nhau
// (`var(--ink-900)` + viền `var(--gold-500)` + `var(--shadow-panel)`)
// — 1 ảnh dùng chung cho tất cả thay vì phải sửa 5 file.
// WorldAnnouncementOverlay.vue (chữ chạy full màn khi phá cảnh) KHÔNG
// dùng — full-bleed, không có khung hộp.
export const MODAL_PANEL_BACKDROP_PATH = '/assets/ui/modal-panel.png' // Khung hộp thoại dùng chung (Menu/Tutorial/Bế Quan/lỗi Save/Error)

// "Holder" — icon mờ hiện trong ô EquipmentPaperdoll.vue lúc slot đó
// CHƯA trang bị gì. Key PHẢI khớp đúng EquipmentSlot (weapon/helmet/
// armor/boots/ring/necklace, xem core/equipment/EquipmentTypes.ts).
export const EQUIPMENT_SLOT_ICON_PATHS: Record<string, string> = {
  weapon: '/assets/equipment-slots/weapon.png', // Vũ Khí — silhouette khi trống
  helmet: '/assets/equipment-slots/helmet.png', // Mũ — silhouette khi trống
  armor: '/assets/equipment-slots/armor.png', // Giáp — silhouette khi trống
  boots: '/assets/equipment-slots/boots.png', // Giày — silhouette khi trống
  ring: '/assets/equipment-slots/ring.png', // Nhẫn — silhouette khi trống
  necklace: '/assets/equipment-slots/necklace.png', // Dây Chuyền — silhouette khi trống
}

// Icon MÓN ĐỒ thật theo từng item (Equipment/Pill/Talisman/Formation/
// Technique) — 2026-08-15, ĐỔI CHỖ theo yêu cầu: icon của 1 món giờ
// khai NGAY TRÊN chính data item đó (field `icon?: string`, xem
// core/equipment/Equipment.ts, core/pill/Pill.ts, core/talisman/
// Talisman.ts, core/formation/Formation.ts, core/technique/Technique.ts
// + giá trị thật trong data/{equipment,pill,talisman,formation,
// technique}/*.ts), KHÔNG còn tập trung ở đây nữa — mỗi item tự mang
// theo icon của nó, sửa/thêm 1 món chỉ cần sửa đúng 1 chỗ (data file
// của món đó) thay vì phải nhớ quay lại đồng bộ thêm ở AssetPaths.ts.
// SlotView.vue nhận qua prop `itemIcon` do component cha tự đọc
// `xxx.icon` rồi truyền vào — vd EquipmentBagSection.vue truyền
// `gameManager.equipmentRegistry.get(instance.itemId).icon`.
//
// Material (~35 id) chưa có field `icon` — ngoài phạm vi đợt này,
// bàn riêng nếu cần.

// ĐANG ĐƯỢC DÙNG THẬT — SlotView.vue (component slot dùng chung cho
// Equipment/Material/Pill/Talisman/Formation bag + EquipmentPaperdoll)
// đã tự import object này, vẽ 3 lớp <img> chồng nhau: backdrop (nền,
// z-index thấp nhất) → itemIcon (nếu có, do cha truyền) → frame (viền
// trang trí, LUÔN hiện) → hoverFrame (chỉ hiện khi hover, CSS toggle
// opacity giữa frame/hoverFrame). Đúng 1 bộ DÙNG CHUNG cho MỌI slot,
// KHÔNG phân biệt theo rarity/quality của item bên trong.
export const SLOT_ASSETS = {
  backdrop: '/assets/ui/Slot/slot-backdrop.png', // Nền phía sau mọi ô (Equipment/Material/Pill/Talisman/Formation/Paperdoll)
  frame: '/assets/ui/Slot/slot-frame.png', // Viền trang trí MẶC ĐỊNH — chỉ hiện khi `rarity` không khớp bậc Quality nào trong QUALITY_FRAME_PATHS (item không phân Quality, vd Material/Pill/Talisman/Formation, hoặc giá trị đặc biệt như rarity="breakthrough" của Tâm Pháp)
  hoverFrame: '/assets/ui/Slot/slot-frame-hover.png', // Lớp highlight chồng THÊM lúc rê chuột qua — KHÔNG thay thế `frame`/QUALITY_FRAME_PATHS, chỉ fade opacity lên trên
}

// ═══════════════════════════════════════════════════════════════════
// 2 TRỤC PHẨM CẤP ĐỘC LẬP CỦA TRANG BỊ — DỄ NHẦM, ĐỌC KỸ TRƯỚC KHI SỬA:
//
//   • QUALITY (9 bậc, "Phẩm Chất": Phàm Khí → Thiên Địa Trọng Khí) —
//     quyết định TRẦN Rèn (forgePoints) + TRẦN Tier Affix roll được.
//     ĐANG ĐƯỢC DÙNG THẬT (2026-08-15) — SlotView.vue đọc prop `rarity`,
//     tra QUALITY_FRAME_PATHS[rarity] làm src cho lớp <img class=
//     "slot-view__frame"> (viền khung chính, luôn hiện) — không khớp
//     bậc nào (vd rarity="breakthrough" của TechniqueSlotCard.vue) thì
//     tự rơi về SLOT_ASSETS.frame dùng chung. Màu viền/glow CSS cũ
//     (`--slot-rarity-color`, token `--rarity-${quality}`) VẪN GIỮ
//     NGUYÊN song song — không xoá, để còn tín hiệu màu ngay cả lúc
//     ảnh khung thật chưa tồn tại (404 im lặng, không vỡ layout).
//
//   • RARITY/PHẨM (5 bậc: Hoàng/Huyền/Địa/Thiên/Tiên Phẩm) — quyết
//     định SỐ LƯỢNG Affix (Prefix/Suffix) tối đa item mang được, KHÔNG
//     liên quan Rèn (đó là trục Quality ở trên). ĐANG ĐƯỢC DÙNG THẬT
//     (2026-08-15) — SlotView.vue đọc prop `itemRarity`, tra
//     PHAM_FRAME_PATHS[itemRarity] làm src cho 1 ô vuông nhỏ góc
//     trên-phải (`.slot-view__item-rarity-badge`, THAY hẳn chấm tròn
//     CSS cũ) — itemRarity không có giá trị thì không hiện gì (item
//     không phân Phẩm, vd Material).
// ═══════════════════════════════════════════════════════════════════

// Khung viền RIÊNG theo 9 bậc Quality — xem giải thích ở trên. Thứ tự
// thấp → cao.
export const QUALITY_FRAME_PATHS: Record<string, string> = {
  pham_khi: '/assets/frames/pham_khi.png', // Phàm Khí (bậc 1/9, thấp nhất)
  bao_khi: '/assets/frames/bao_khi.png', // Bảo Khí (bậc 2/9)
  linh_khi: '/assets/frames/linh_khi.png', // Linh Khí (bậc 3/9)
  phap_khi: '/assets/frames/phap_khi.png', // Pháp Khí (bậc 4/9)
  phap_bao: '/assets/frames/phap_bao.png', // Pháp Bảo (bậc 5/9)
  tien_bao: '/assets/frames/tien_bao.png', // Tiên Bảo (bậc 6/9)
  chi_bao: '/assets/frames/chi_bao.png', // Chí Bảo (bậc 7/9)
  hon_don_chi_bao: '/assets/frames/hon_don_chi_bao.png', // Hỗn Độn Chí Bảo (bậc 8/9)
  thien_dia_trong_khi: '/assets/frames/thien_dia_trong_khi.png', // Thiên Địa Trọng Khí (bậc 9/9, cao nhất)
}

// Khung ô vuông RIÊNG theo 5 bậc Rarity/Phẩm — xem giải thích ở trên.
// Thứ tự thấp → cao. Dùng chung Equipment/Pill/Talisman/Formation
// (cùng 1 thang Pham, xem core/item/Pham.ts).
export const PHAM_FRAME_PATHS: Record<string, string> = {
  hoang_pham: '/assets/frames/hoang_pham.png', // Hoàng Phẩm (bậc 1/5, thấp nhất)
  huyen_pham: '/assets/frames/huyen_pham.png', // Huyền Phẩm (bậc 2/5)
  dia_pham: '/assets/frames/dia_pham.png', // Địa Phẩm (bậc 3/5)
  thien_pham: '/assets/frames/thien_pham.png', // Thiên Phẩm (bậc 4/5)
  tien_pham: '/assets/frames/tien_pham.png', // Tiên Phẩm (bậc 5/5, cao nhất)
}

// Lớp backdrop MÀU RIÊNG theo 9 bậc Quality (2026-08-15) — layer ẢNH
// bổ sung (không phải CSS tint), nhấn thêm tín hiệu 9 bậc song song
// với QUALITY_FRAME_PATHS (viền) — xem SlotView.vue's `.slot-view__
// quality-backdrop`. Placeholder path, asset thật thêm sau (404 im
// lặng, không vỡ layout — cùng cách QUALITY_FRAME_PATHS graceful-
// degrade). Thứ tự thấp → cao.
export const QUALITY_BACKDROP_PATHS: Record<string, string> = {
  pham_khi: '/assets/equipment/quality-backdrop/pham_khi.png',
  bao_khi: '/assets/equipment/quality-backdrop/bao_khi.png',
  linh_khi: '/assets/equipment/quality-backdrop/linh_khi.png',
  phap_khi: '/assets/equipment/quality-backdrop/phap_khi.png',
  phap_bao: '/assets/equipment/quality-backdrop/phap_bao.png',
  tien_bao: '/assets/equipment/quality-backdrop/tien_bao.png',
  chi_bao: '/assets/equipment/quality-backdrop/chi_bao.png',
  hon_don_chi_bao: '/assets/equipment/quality-backdrop/hon_don_chi_bao.png',
  thien_dia_trong_khi: '/assets/equipment/quality-backdrop/thien_dia_trong_khi.png',
}

// (5 bảng icon Tâm Pháp/Đan/Phù/Trận/Trang Bị trước ở đây đã dời sang
// field `icon` ngay trên từng data item — xem ghi chú phía trên.)
