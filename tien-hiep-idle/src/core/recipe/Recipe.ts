export type RecipeResultType = 'pill' | 'talisman' | 'formation'

export interface RecipeMaterialCost {
  materialId: string

  amount: number
}

/**
 * Công thức luyện chế — 1 trong 3 nghề Đan/Phù/Trận (Khí không dùng
 * Recipe, xem EquipmentSystem.enhance/wash/refine/upgradeQuality/
 * upgradeRealm). Có thời gian chạy thật (craftDuration), giống
 * Exploration: bắt đầu → trừ nguyên liệu ngay → chờ → thu hoạch.
 */
export interface Recipe {
  id: string

  name: string

  description?: string

  resultType: RecipeResultType

  resultId: string

  resultAmount: number

  materials: RecipeMaterialCost[]

  // "tunghematandsuch" pass (2026-08-14) — Linh Thạch (player.
  // spiritStone, ĐÃ có sẵn, không phải material mới) là chi phí CHUNG
  // của cả 3 nghề Đan/Phù/Trận, cùng pattern
  // Equipment.upgradeRealmSpiritStoneCost — xem CraftingSystem.ts's
  // canStart()/start().
  spiritStoneCost?: number

  // Đơn vị: giây.
  craftDuration: number

  // Mở dần theo cảnh giới — không set = mở ngay từ đầu.
  requiredRealmId?: string
}
