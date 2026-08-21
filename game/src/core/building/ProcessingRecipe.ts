/**
 * Công thức chế biến của Processing Building (vd Lò Luyện: Quặng Sắt
 * → Huyền Thiết) — khác Recipe (core/recipe/Recipe.ts) ở chỗ không
 * cần người chơi bấm "bắt đầu craft", Building tự động lặp lại theo
 * thời gian thực miễn còn đủ nguyên liệu đầu vào (xem BuildingSystem).
 */
export interface ProcessingRecipe {
  id: string

  buildingId: string

  inputMaterialId: string

  inputAmount: number

  outputMaterialId: string

  outputAmount: number

  // Thời gian xử lý 1 lượt ở tốc độ chuẩn (baseProcessingSpeed = 1) —
  // tốc độ thật = processingSeconds / effectiveSpeed (xem BuildingSystem).
  processingSeconds: number
}
