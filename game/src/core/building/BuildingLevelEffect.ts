// BUILDing spec muc 3-4/15-16 - moi cap Building crafting-station co
// the mo/cai thien MOT HAY NHIEU hieu ung feed vao Function xu ly
// (Dan Phong/Tran Dai/Phu Vien/Khi Duong). KHONG dung chung 1 cong
// thuc cung cho moi Building (do la loi he thong resource/processing
// cu - xem LEVEL_BONUS_PER_LEVEL trong BuildingSystem.ts, giu nguyen
// rieng cho 3 building cu, khong ap dung effect nay).
export type BuildingLevelEffect =
  | { kind: 'craft_time_reduction'; percent: number }
  | { kind: 'craft_quality_bonus'; percent: number }
  | { kind: 'concurrent_job_slots'; amount: number }
  | { kind: 'equipment_cost_discount'; percent: number }

export interface BuildingLevelDef {
  level: number

  effects: BuildingLevelEffect[]

  // Hien trong UI kieu "Lv.3 -> +1 job dong thoi" (spec muc 4 vi du).
  description?: string
}

export interface CraftModifiers {
  timeReductionPercent: number

  qualityBonusPercent: number

  concurrentJobSlots: number

  equipmentCostDiscountPercent: number
}
