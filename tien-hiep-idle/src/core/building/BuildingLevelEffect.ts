// BUILDing spec mục 3-4/15-16 — mỗi cấp Building crafting-station có
// thể mở/cải thiện MỘT HAY NHIỀU hiệu ứng feed vào Function xử lý
// (Đan Phòng/Trận Đài/Phù Viện/Khí Đường). KHÔNG dùng chung 1 công
// thức cứng cho mọi Building (đó là lỗi hệ thống resource/processing
// cũ — xem LEVEL_BONUS_PER_LEVEL trong BuildingSystem.ts, giữ nguyên
// riêng cho 3 building cũ, không áp dụng effect này).
export type BuildingLevelEffect =
  | { kind: 'craft_time_reduction'; percent: number }
  | { kind: 'craft_quality_bonus'; percent: number }
  | { kind: 'concurrent_job_slots'; amount: number }

export interface BuildingLevelDef {
  level: number

  effects: BuildingLevelEffect[]

  // Hiện trong UI kiểu "Lv.3 → +1 job đồng thời" (spec mục 4 ví dụ).
  description?: string
}

export interface CraftModifiers {
  timeReductionPercent: number

  qualityBonusPercent: number

  concurrentJobSlots: number
}
