// ===========================================================
// Bag Grid (BagGrid.vue / components/panels/bag-sections/*) — layout
// đo từ CHIỀU RỘNG THẬT của .bag-section__grid tại runtime
// (ResizeObserver, xem composables/useBagGridLayout.ts), KHÔNG còn
// suy từ % chiều cao panel như bản cũ (LEFT_PANEL_HEIGHT/
// GRID_HEIGHT_BUDGET). Slot là ô VUÔNG nên phải fill theo NGANG
// trước — chiều rộng luôn khớp thật qua CSS Grid
// `repeat(columns, 1fr)` (không còn "hụt" như flex-wrap fixed-px
// cũ). Chiều dọc chỉ là HỆ QUẢ của slot vuông (rows * slotSize có thể
// dư ra 1 chút phía dưới, đúng ý — không cần ép grid fill kín chiều
// cao).
// ===========================================================

// Giảm 1 nửa (2026-08-20, yêu cầu "ô quá to") — cùng tỉ lệ với bộ cũ
// (110/150/135), chỉ nhân đôi MIN/MAX_COLUMNS và MIN/MAX_ROWS để thuật
// toán vẫn fill kín cả 2 chiều với ô nhỏ hơn (đúng nguyên tắc "chiều
// rộng luôn khớp thật" ở trên) — không đổi công thức, chỉ đổi hằng số.
export const MIN_SLOT_SIZE = 55
export const MAX_SLOT_SIZE = 75
export const TARGET_SLOT_SIZE = 67

export const MIN_COLUMNS = 5
export const MAX_COLUMNS = 14

// Chặn số hàng/trang trong khoảng này để pageSize (= columns * rows)
// không phình/co theo từng pixel resize — chỉ dùng chiều cao đo được
// làm gợi ý PHỤ (calculateRows), không dùng để giải bài toán chiều
// rộng/số cột. Sàn 3 (thay 10 cũ): vùng bag thấp (Đan Phòng 40%, Hành
// Trang 70% cửa sổ hẹp) chỉ lắp vừa vài hàng — sàn cao hơn chiều cao
// thật khiến grid render tràn khung rồi bị overflow:hidden cắt mất.
export const MIN_ROWS = 3
export const MAX_ROWS = 14

export const GRID_GAP = 4

export interface BagGridLayout {
  columns: number
  rows: number
  slotSize: number
  gap: number
}

/**
 * slotSize cho 1 số cột cụ thể — dùng chung cho cả bước chọn cột
 * (calculateColumns duyệt qua nhiều ứng viên) lẫn bước tính slot cuối
 * cùng sau khi đã chốt cột.
 */
export function calculateSlotSize(containerWidth: number, columns: number): number {
  if (columns <= 0) {
    return 0
  }

  return Math.max(0, Math.floor((containerWidth - GRID_GAP * (columns - 1)) / columns))
}

/**
 * Duyệt hết số cột hợp lệ (MIN_COLUMNS..MAX_COLUMNS), ưu tiên cột nào
 * cho slotSize nằm trong [MIN_SLOT_SIZE, MAX_SLOT_SIZE] VÀ gần
 * TARGET_SLOT_SIZE nhất. Container hẹp/rộng bất thường tới mức không
 * cột nào rơi đúng khoảng vẫn trả về cột gần TARGET nhất (fallback
 * hợp lý, không NaN/throw).
 */
export function calculateColumns(containerWidth: number): number {
  let bestColumns = MIN_COLUMNS
  let bestScore = Infinity

  for (let columns = MIN_COLUMNS; columns <= MAX_COLUMNS; columns++) {
    const slotSize = calculateSlotSize(containerWidth, columns)
    const distance = Math.abs(slotSize - TARGET_SLOT_SIZE)
    const inRange = slotSize >= MIN_SLOT_SIZE && slotSize <= MAX_SLOT_SIZE

    // Trong khoảng [MIN,MAX] luôn thắng ngoài khoảng, bất kể độ gần
    // TARGET — tránh chọn 1 cột "gần TARGET hơn 1 chút" nhưng cho ra
    // slot quá nhỏ/quá to.
    const score = inRange ? distance : distance + 10_000

    if (score < bestScore) {
      bestScore = score
      bestColumns = columns
    }
  }

  return bestColumns
}

/**
 * Chiều cao chỉ là HỆ QUẢ của slot vuông — đo chiều cao khả dụng thật
 * (containerHeight, cũng từ ResizeObserver) rồi xem vừa được bao
 * nhiêu hàng, chặn trong [MIN_ROWS, MAX_ROWS] để pageSize ổn định.
 */
export function calculateRows(containerHeight: number, slotSize: number): number {
  if (slotSize <= 0) {
    return MIN_ROWS
  }

  const fitted = Math.floor((containerHeight + GRID_GAP) / (slotSize + GRID_GAP))

  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, fitted))
}

export function calculateBagGridLayout(containerWidth: number, containerHeight: number): BagGridLayout {
  const columns = calculateColumns(containerWidth)
  const slotSize = calculateSlotSize(containerWidth, columns)
  const rows = calculateRows(containerHeight, slotSize)

  return { columns, rows, slotSize, gap: GRID_GAP }
}
