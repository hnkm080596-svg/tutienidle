import { describe, expect, it } from 'vitest'
import { TRAN_PHAP_FORMATIONS } from './TranPhap'

describe('Tr?n Ph?p content file', () => {
  it('every formation cell is within the local 3x3 standing-slot space (0-2)', () => {
    for (const formation of TRAN_PHAP_FORMATIONS) {
      for (const cell of formation.cellPattern) {
        expect(cell.row).toBeGreaterThanOrEqual(0)
        expect(cell.row).toBeLessThanOrEqual(2)
        expect(cell.column).toBeGreaterThanOrEqual(0)
        expect(cell.column).toBeLessThanOrEqual(2)
      }
    }
  })

  it('every formation id is unique', () => {
    const ids = TRAN_PHAP_FORMATIONS.map((formation) => formation.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('hon_don_tran (TEST-ONLY stress-test formation)', () => {
  it('unlocks all 9 standing slots of the local 3x3 space, each exactly once', () => {
    const formation = TRAN_PHAP_FORMATIONS.find((f) => f.id === 'hon_don_tran')

    expect(formation).toBeDefined()
    expect(formation!.cellPattern).toHaveLength(9)

    const seen = new Set(formation!.cellPattern.map((cell) => `${cell.row},${cell.column}`))

    expect(seen.size).toBe(9)

    for (let row = 0; row <= 2; row++) {
      for (let column = 0; column <= 2; column++) {
        expect(seen.has(`${row},${column}`)).toBe(true)
      }
    }
  })
})
