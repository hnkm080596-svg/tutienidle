export interface ExplorationMaterialResult {
  materialId: string

  amount: number
}


export interface ExplorationResult {
  explorationId: string

  /**
   * Thời gian thực tế đã trôi qua.
   */
  elapsedSeconds: number

  /**
   * Số lượt hoàn thành.
   */
  completedRuns: number

  /**
   * Tổng nguyên liệu nhận được.
   */
  materials: ExplorationMaterialResult[]
}