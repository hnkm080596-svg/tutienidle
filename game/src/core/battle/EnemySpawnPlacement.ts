// EnemySpawnPlacement (2026-08-24) — resolver thuần chọn ô spawn cho quái
// theo luồng "telegraph → xuất hiện → tham chiến":
// - Cột nằm trong grid (0..GRID_COLUMN_COUNT-1) và BÊN PHẢI player.
// - Không đè vùng cổng người chơi (0..HERO_GATE_COLUMNS-1).
// - Không chọn ô đã có quái (occupied) hoặc đang được đặt trước (reserved
//   — telegraph của spawn khác đang chạy).
// - Chọn ĐỀU trên danh sách ô hợp lệ bằng ĐÚNG MỘT lần gọi random() —
//   không vòng retry (retry làm phân phối lệch và tốn RNG).
// - Boss giữ hàng giữa (HERO_LANE_INDEX) đúng hành vi cũ, chỉ random cột.
// - Hết ô trống → null: caller (BattleSystem/StageWaveSystem) HOÃN spawn
//   đến tick sau, không bao giờ cho 2 quái chồng lên nhau.
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, type GridPosition } from './BattleGrid'
import { HERO_GATE_COLUMNS, HERO_LANE_INDEX } from './BattleLane'

export interface EnemySpawnPlacementInput {
  /** Cột hiện tại của player (world-unit) — spawn phải bên phải cột này. */
  playerColumn: number

  /** Ô đang có quái sống — key từ enemySpawnCellKey(). */
  occupiedCells: ReadonlySet<string>

  /** Ô đang có telegraph spawn chạy (pending) — key từ enemySpawnCellKey(). */
  reservedCells: ReadonlySet<string>

  isBoss: boolean

  /** RNG tiêm từ ngoài (Math.random hoặc seeded) — deterministic test được. */
  random: () => number
}

/** Key định danh 1 ô lưới cho tập occupied/reserved. */
export function enemySpawnCellKey(row: number, column: number): string {
  return `${row}:${column}`
}

export function resolveEnemySpawnPosition(input: EnemySpawnPlacementInput): GridPosition | null {
  // Cột hợp lệ: bên phải player VÀ ngoài vùng cổng (cổng chiếm
  // 0..HERO_GATE_COLUMNS-1 dù playerColumn có thể nhỏ hơn).
  const minColumn = Math.max(Math.floor(input.playerColumn) + 1, HERO_GATE_COLUMNS)
  const maxColumn = GRID_COLUMN_COUNT - 1
  const rows: number[] = input.isBoss
    ? [HERO_LANE_INDEX]
    : Array.from({ length: GRID_ROW_COUNT }, (_, row) => row)

  const candidates: GridPosition[] = []

  for (const row of rows) {
    for (let column = minColumn; column <= maxColumn; column++) {
      const key = enemySpawnCellKey(row, column)

      if (input.occupiedCells.has(key) || input.reservedCells.has(key)) {
        continue
      }

      candidates.push({ row: row as GridPosition['row'], column })
    }
  }

  if (candidates.length === 0) {
    return null
  }

  // random() ∈ [0,1) ⇒ index ∈ [0, length-1] an toàn cả biên 0 và ~1.
  const index = Math.floor(input.random() * candidates.length)

  return candidates[index] ?? null
}
