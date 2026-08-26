// Resolver vị trí spawn quái (plan §5.1): row 0..9 random, column 7..15
// random (RNG ĐỘC LẬP), Boss luôn row 4 chỉ roll column, overlap hợp lệ,
// KHÔNG BAO GIỜ trả null.
import { describe, expect, it } from 'vitest'
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT } from './BattleGrid'
import { HERO_LANE_INDEX } from './BattleLane'
import { resolveEnemySpawnPosition } from './EnemySpawnPlacement'

describe('resolveEnemySpawnPosition', () => {
  it('quái thường: row trong 0..9, column trong 7..15', () => {
    const seenRows = new Set<number>()

    for (let i = 0; i < 500; i++) {
      const position = resolveEnemySpawnPosition({
        isBoss: false,
        random: Math.random,
      })

      expect(position.row).toBeGreaterThanOrEqual(0)
      expect(position.row).toBeLessThanOrEqual(GRID_ROW_COUNT - 1)
      expect(position.column).toBeGreaterThanOrEqual(7)
      expect(position.column).toBeLessThanOrEqual(GRID_COLUMN_COUNT - 1)

      seenRows.add(position.row)
    }

    // Miền spawn đủ rộng — sample 500 lần phải chạm nhiều hàng khác nhau.
    expect(seenRows.size).toBeGreaterThan(3)
  })

  it('Boss luôn row 4 (HERO_LANE_INDEX), chỉ roll column', () => {
    const seenColumns = new Set<number>()

    for (let i = 0; i < 100; i++) {
      const position = resolveEnemySpawnPosition({
        isBoss: true,
        random: Math.random,
      })

      expect(position.row).toBe(HERO_LANE_INDEX)
      expect(position.column).toBeGreaterThanOrEqual(7)
      seenColumns.add(position.column)
    }

    expect(seenColumns.size).toBeGreaterThan(1)
  })

  it('RNG độc lập: cùng seed cho row và column — random()=0 → (0,7)', () => {
    let calls = 0
    const zeroThenZero = () => {
      calls++
      return 0
    }

    expect(resolveEnemySpawnPosition({ isBoss: false, random: zeroThenZero })).toEqual({
      row: 0,
      column: 7,
    })
    expect(calls).toBe(2)

    // Boss CHỈ roll column — đúng MỘT lần gọi random().
    let bossCalls = 0

    resolveEnemySpawnPosition({
      isBoss: true,
      random: () => {
        bossCalls++

        return 0.9999999999
      },
    })

    expect(bossCalls).toBe(1)
  })

  it('random() gần 1 → (9, 15) — không tràn index', () => {
    const position = resolveEnemySpawnPosition({
      isBoss: false,
      random: () => 0.9999999999,
    })

    expect(position).toEqual({ row: GRID_ROW_COUNT - 1, column: GRID_COLUMN_COUNT - 1 })
  })
})
