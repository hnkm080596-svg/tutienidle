import { describe, expect, it } from 'vitest'
import { TRAN_PHAP_FORMATIONS } from './TranPhap'

describe('Trận Pháp content file', () => {
  it('every formation cell is within the local 6x6 pattern space (0-5)', () => {
    for (const formation of TRAN_PHAP_FORMATIONS) {
      for (const cell of formation.cellPattern) {
        expect(cell.row).toBeGreaterThanOrEqual(0)
        expect(cell.row).toBeLessThanOrEqual(5)
        expect(cell.column).toBeGreaterThanOrEqual(0)
        expect(cell.column).toBeLessThanOrEqual(5)
      }
    }
  })

  it('every formation id is unique', () => {
    const ids = TRAN_PHAP_FORMATIONS.map((formation) => formation.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('hon_don_tran (TEST-ONLY stress-test formation)', () => {
  it('unlocks all 36 cells of the local 6x6 space, each exactly once', () => {
    const formation = TRAN_PHAP_FORMATIONS.find((f) => f.id === 'hon_don_tran')

    expect(formation).toBeDefined()
    expect(formation!.cellPattern).toHaveLength(36)

    const seen = new Set(formation!.cellPattern.map((cell) => `${cell.row},${cell.column}`))

    expect(seen.size).toBe(36)

    for (let row = 0; row <= 5; row++) {
      for (let column = 0; column <= 5; column++) {
        expect(seen.has(`${row},${column}`)).toBe(true)
      }
    }
  })
})
