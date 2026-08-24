// Resolver vị trí spawn quái (luồng "telegraph → xuất hiện → tham chiến"):
// ô trong grid + bên phải player + ngoài cổng + không đè ô occupied/
// reserved + chọn ĐỀU bằng ĐÚNG MỘT lần random() + boss giữ hàng giữa.
import { describe, expect, it } from 'vitest'
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT } from './BattleGrid'
import { HERO_GATE_COLUMNS, HERO_LANE_INDEX } from './BattleLane'
import { enemySpawnCellKey, resolveEnemySpawnPosition } from './EnemySpawnPlacement'

const NO_CELLS = new Set<string>()

function cellsOf(...positions: Array<[number, number]>): Set<string> {
  return new Set(positions.map(([row, column]) => enemySpawnCellKey(row, column)))
}

describe('resolveEnemySpawnPosition', () => {
  it('chỉ trả ô TRONG grid, BÊN PHẢI player và ngoài vùng cổng', () => {
    for (let i = 0; i < 200; i++) {
      const position = resolveEnemySpawnPosition({
        playerColumn: 0,
        occupiedCells: NO_CELLS,
        reservedCells: NO_CELLS,
        isBoss: false,
        random: Math.random,
      })

      expect(position).not.toBeNull()
      expect(position!.row).toBeGreaterThanOrEqual(0)
      expect(position!.row).toBeLessThan(GRID_ROW_COUNT)
      expect(position!.column).toBeGreaterThanOrEqual(HERO_GATE_COLUMNS)
      expect(position!.column).toBeLessThanOrEqual(GRID_COLUMN_COUNT - 1)
      expect(position!.column).toBeGreaterThan(0)
    }
  })

  it('player đã tiến sâu (playerColumn cao) — spawn vẫn bên phải player', () => {
    for (let i = 0; i < 100; i++) {
      const position = resolveEnemySpawnPosition({
        playerColumn: 10,
        occupiedCells: NO_CELLS,
        reservedCells: NO_CELLS,
        isBoss: false,
        random: Math.random,
      })

      expect(position!.column).toBeGreaterThan(10)
    }
  })

  it('không chọn ô occupied hoặc reserved', () => {
    // Chiếm MỌI ô hợp lệ trừ 1 ô — resolver buộc phải trả đúng ô còn lại.
    const remaining: [number, number] = [3, 9]
    const occupied = new Set<string>()

    for (let row = 0; row < GRID_ROW_COUNT; row++) {
      for (let column = HERO_GATE_COLUMNS; column < GRID_COLUMN_COUNT; column++) {
        if (row === remaining[0] && column === remaining[1]) {
          continue
        }

        occupied.add(enemySpawnCellKey(row, column))
      }
    }

    const position = resolveEnemySpawnPosition({
      playerColumn: 0,
      occupiedCells: occupied,
      reservedCells: NO_CELLS,
      isBoss: false,
      random: () => 0.777,
    })

    expect(position).toEqual({ row: 3, column: 9 })

    // Reserved cũng bị loại tương tự (telegraph khác đang chạy).
    const reservedOnly = cellsOf([5, 5])

    for (let i = 0; i < 50; i++) {
      const result = resolveEnemySpawnPosition({
        playerColumn: 0,
        occupiedCells: NO_CELLS,
        reservedCells: reservedOnly,
        isBoss: false,
        random: Math.random,
      })

      expect(enemySpawnCellKey(result!.row, result!.column)).not.toBe('5:5')
    }
  })

  it('RNG biên: random()=0 → phần tử đầu, random() gần 1 → phần tử CUỐI (không tràn index)', () => {
    const first = resolveEnemySpawnPosition({
      playerColumn: 0,
      occupiedCells: NO_CELLS,
      reservedCells: NO_CELLS,
      isBoss: false,
      random: () => 0,
    })

    expect(first).toEqual({ row: 0, column: HERO_GATE_COLUMNS })

    const last = resolveEnemySpawnPosition({
      playerColumn: 0,
      occupiedCells: NO_CELLS,
      reservedCells: NO_CELLS,
      isBoss: false,
      random: () => 0.9999999999,
    })

    expect(last).toEqual({ row: GRID_ROW_COUNT - 1, column: GRID_COLUMN_COUNT - 1 })
  })

  it('Boss giữ hàng giữa (HERO_LANE_INDEX), chỉ random cột', () => {
    const seenColumns = new Set<number>()

    for (let i = 0; i < 100; i++) {
      const position = resolveEnemySpawnPosition({
        playerColumn: 0,
        occupiedCells: NO_CELLS,
        reservedCells: NO_CELLS,
        isBoss: true,
        random: Math.random,
      })

      expect(position!.row).toBe(HERO_LANE_INDEX)
      seenColumns.add(position!.column)
    }

    expect(seenColumns.size).toBeGreaterThan(1)
  })

  it('hết ô trống → null (caller hoãn spawn, không chồng quái)', () => {
    const allCells = new Set<string>()

    for (let row = 0; row < GRID_ROW_COUNT; row++) {
      for (let column = 0; column < GRID_COLUMN_COUNT; column++) {
        allCells.add(enemySpawnCellKey(row, column))
      }
    }

    expect(
      resolveEnemySpawnPosition({
        playerColumn: 0,
        occupiedCells: allCells,
        reservedCells: NO_CELLS,
        isBoss: false,
        random: Math.random,
      }),
    ).toBeNull()

    // Boss: chỉ có 1 hàng ứng viên — chiếm hàng đó là đủ để null.
    const bossRowCells = cellsOf(
      ...Array.from(
        { length: GRID_COLUMN_COUNT },
        (_, column) => [HERO_LANE_INDEX, column] as [number, number],
      ),
    )

    expect(
      resolveEnemySpawnPosition({
        playerColumn: 0,
        occupiedCells: bossRowCells,
        reservedCells: NO_CELLS,
        isBoss: true,
        random: Math.random,
      }),
    ).toBeNull()
  })
})
