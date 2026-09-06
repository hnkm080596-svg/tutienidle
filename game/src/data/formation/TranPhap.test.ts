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
