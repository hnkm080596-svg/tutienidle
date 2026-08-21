// MASTER SPEC Mục IV — 3 loại reward Exploration:
//   'common'   — dùng số lượng lớn (chance cao, farm liên tục).
//   'rare'     — dùng recipe cao cấp (chance thấp hơn).
//   'regional' — chỉ xuất hiện ở khu vực nhất định (độc quyền vùng).
// Field THUẦN HIỂN THỊ/lọc — KHÔNG ảnh hưởng logic roll thật trong
// ExplorationSystem.collect() (vẫn dùng `chance` như cũ).
export type ExplorationRewardTier = 'common' | 'rare' | 'regional'

export interface ExplorationMaterialReward {
  materialId: string

  /**
   * Số lượng nhận được
   * mỗi một lượt hoàn thành.
   */
  minAmount: number

  maxAmount: number

  /**
   * Xác suất nhận được.
   *
   * 1.0  = 100%
   * 0.5  = 50%
   * 0.1  = 10%
   */
  chance: number

  tier: ExplorationRewardTier
}