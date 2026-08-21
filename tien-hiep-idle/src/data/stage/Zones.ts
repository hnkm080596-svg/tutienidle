import type { Zone } from '@/core/stage/Zone'

// Thám Hiểm rework — 1 Địa Giới duy nhất bọc Stage duy nhất hiện có
// (qi_refining_forest). Thêm Địa Giới mới khi có thêm Stage/cảnh giới
// mới — không cần đổi gì ở StageSelectPanel.vue/GameManager, cả 2 đều
// đọc thẳng từ ZoneRegistry.
//
// Luyện Khí tầng 1-10 content pass (2026-08-14) — stageIds mở rộng đủ
// 10 Stage (tầng 1-10, xem data/stage/Stages.ts), ĐÚNG THỨ TỰ tầng —
// thứ tự mảng này vừa là thứ tự hiển thị trong StageSelectPanel.vue
// vừa là thứ tự "Tự Động Thám Hiểm" leo tầng (GameManager.
// getNextStageInZone() đi tuần tự theo mảng).
//
// Thanh Vân naming pass (2026-08-15) — Zone đổi tên "Luyện Khí Cốc" ->
// "Thanh Vân" (đọc TRỰC TIẾP qua ZoneRegistry.getZoneForStage() làm
// tiền tố "Địa Giới" trong tên vật phẩm ghép động, xem
// EquipmentNaming.ts — đổi 1 dòng này là mọi vật phẩm rớt ra từ Zone
// tự động đổi tiền tố theo, không cần sửa gì ở Equipment). "Thanh Vân"
// là tên ĐỊA GIỚI chung cho CẢ 3 cảnh giới Phàm Nhân/Luyện Khí/Trúc Cơ
// (mỗi cảnh giới 1 Zone riêng do `requiredRealmId` chỉ nhận 1 giá trị,
// nhưng CÙNG tên "Thanh Vân" — xem [[tienhiep-equipment-naming-sets]]
// memory cho kế hoạch Phàm Nhân/Trúc Cơ chưa triển khai). id giữ
// NGUYÊN `qi_refining_valley` (không đổi kiến trúc/tránh vỡ tham chiếu
// zoneId đã lưu), chỉ đổi `name` hiển thị.
export const zones: Zone[] = [
  // Phàm Nhân (2026-08-16) — Zone riêng cho đại cảnh giới thấp nhất,
  // CÙNG tên "Thanh Vân" như Luyện Khí (đúng kế hoạch để lại ở comment
  // trên: "Thanh Vân" là tên Địa Giới chung cho cả 3 cảnh giới). id
  // MỚI (`pham_nhan_valley`, không tái dùng qi_refining_valley) vì
  // requiredRealmId chỉ nhận 1 giá trị/Zone.
  {
    id: 'pham_nhan_valley',
    name: 'Thanh Vân',
    requiredRealmId: 'pham_nhan',
    stageIds: [
      'pham_nhan_dong_1',
      'pham_nhan_dong_2',
      'pham_nhan_dong_3',
      'pham_nhan_dong_4',
      'pham_nhan_dong_5',
      'pham_nhan_dong_6',
      'pham_nhan_dong_7',
      'pham_nhan_dong_8',
      'pham_nhan_dong_9',
      'pham_nhan_dong_10',
    ],
  },

  {
    id: 'qi_refining_valley',
    name: 'Thanh Vân',
    requiredRealmId: 'qi_refining',
    stageIds: [
      'qi_refining_forest',
      'qi_refining_deep_forest',
      'qi_refining_ember_canyon',
      'qi_refining_scorched_ridge',
      'qi_refining_sand_plain',
      'qi_refining_stone_range',
      'qi_refining_blade_peak',
      'qi_refining_mineral_pit',
      'qi_refining_mystic_marsh',
      'qi_refining_abyssal_pool',
    ],
  },
]
