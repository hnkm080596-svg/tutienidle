// ===========================================================
// Bag Grid (BagGrid.vue / components/panels/bag-sections/*) - layout
// do tu CHIEU RONG THAT cua .bag-section__grid tai runtime
// (ResizeObserver, xem composables/useBagGridLayout.ts), KHONG con
// suy tu % chieu cao panel nhu ban cu (LEFT_PANEL_HEIGHT/
// GRID_HEIGHT_BUDGET). Slot la o VUONG nen phai fill theo NGANG
// truoc - chieu rong luon khop that qua CSS Grid
// `repeat(columns, 1fr)` (khong con "hut" nhu flex-wrap fixed-px
// cu). Chieu doc chi la HE QUA cua slot vuong (rows * slotSize co the
// du ra 1 chut phia duoi, dung y - khong can ep grid fill kin chieu
// cao).
// ===========================================================

// Giam 1 nua (2026-08-20, yeu cau "o qua to") - cung ti le voi bo cu
// (110/150/135), chi nhan doi MIN/MAX_COLUMNS va MIN/MAX_ROWS de thuat
// toan van fill kin ca 2 chieu voi o nho hon (dung nguyen tac "chieu
// rong luon khop that" o tren) - khong doi cong thuc, chi doi hang so.
export const MIN_SLOT_SIZE = 55
export const MAX_SLOT_SIZE = 75
export const TARGET_SLOT_SIZE = 67

export const MIN_COLUMNS = 5
export const MAX_COLUMNS = 14

// Chan so hang/trang trong khoang nay de pageSize (= columns * rows)
// khong phinh/co theo tung pixel resize - chi dung chieu cao do duoc
// lam goi y PHU (calculateRows), khong dung de giai bai toan chieu
// rong/so cot. San 3 (thay 10 cu): vung bag thap (Dan Phong 40%, Hanh
// Trang 70% cua so hep) chi lap vua vai hang - san cao hon chieu cao
// that khien grid render tran khung roi bi overflow:hidden cat mat.
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
 * slotSize cho 1 so cot cu the - dung chung cho ca buoc chon cot
 * (calculateColumns duyet qua nhieu ung vien) lan buoc tinh slot cuoi
 * cung sau khi da chot cot.
 */
export function calculateSlotSize(containerWidth: number, columns: number): number {
  if (columns <= 0) {
    return 0
  }

  return Math.max(0, Math.floor((containerWidth - GRID_GAP * (columns - 1)) / columns))
}

/**
 * Duyet het so cot hop le (MIN_COLUMNS..MAX_COLUMNS), uu tien cot nao
 * cho slotSize nam trong [MIN_SLOT_SIZE, MAX_SLOT_SIZE] VA gan
 * TARGET_SLOT_SIZE nhat. Container hep/rong bat thuong toi muc khong
 * cot nao roi dung khoang van tra ve cot gan TARGET nhat (fallback
 * hop ly, khong NaN/throw).
 */
export function calculateColumns(containerWidth: number): number {
  let bestColumns = MIN_COLUMNS
  let bestScore = Infinity

  for (let columns = MIN_COLUMNS; columns <= MAX_COLUMNS; columns++) {
    const slotSize = calculateSlotSize(containerWidth, columns)
    const distance = Math.abs(slotSize - TARGET_SLOT_SIZE)
    const inRange = slotSize >= MIN_SLOT_SIZE && slotSize <= MAX_SLOT_SIZE

    // Trong khoang [MIN,MAX] luon thang ngoai khoang, bat ke do gan
    // TARGET - tranh chon 1 cot "gan TARGET hon 1 chut" nhung cho ra
    // slot qua nho/qua to.
    const score = inRange ? distance : distance + 10_000

    if (score < bestScore) {
      bestScore = score
      bestColumns = columns
    }
  }

  return bestColumns
}

/**
 * Chieu cao chi la HE QUA cua slot vuong - do chieu cao kha dung that
 * (containerHeight, cung tu ResizeObserver) roi xem vua duoc bao
 * nhieu hang, chan trong [MIN_ROWS, MAX_ROWS] de pageSize on dinh.
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
