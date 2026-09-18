import { describe, expect, it } from 'vitest'
import { BUFF_REGISTRY } from '../buff/BuffRegistry'
import { TRAN_PHAP_FORMATIONS } from './TranPhap'

// B2 (2026-09-14) — production Tran Phap content contract. The mechanism
// shipped earlier (spec 2026-09-05); these tests pin the authored roster:
// distinct headcounts, unique cells, and every formation buff must resolve
// through BUFF_REGISTRY (runtime only skips on unknown id — a typo'd
// definitionId would silently cost the buff, so it is pinned here instead).
describe('Tran Phap content file', () => {
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

  it('no cell is duplicated within a formation pattern', () => {
    for (const formation of TRAN_PHAP_FORMATIONS) {
      const seen = new Set(formation.cellPattern.map((cell) => `${cell.row},${cell.column}`))

      expect(seen.size).toBe(formation.cellPattern.length)
    }
  })

  it('every formation buff.definitionId resolves in BUFF_REGISTRY', () => {
    for (const formation of TRAN_PHAP_FORMATIONS) {
      expect(() => BUFF_REGISTRY.get(formation.buff.definitionId)).not.toThrow()
    }
  })

  it('formation buffs are battle-long party buffs (permanent clock, polarity buff)', () => {
    for (const formation of TRAN_PHAP_FORMATIONS) {
      const buff = BUFF_REGISTRY.get(formation.buff.definitionId)

      expect(buff.polarity).toBe('buff')
      expect(buff.lifetime.clock).toBe('permanent')
    }
  })

  it('authored headcount ladder — fewer slots means a stronger buff (spec 2026-09-05 §2.5)', () => {
    const headcounts = TRAN_PHAP_FORMATIONS.map((formation) => ({
      id: formation.id,
      cells: formation.cellPattern.length,
    }))

    expect(headcounts).toEqual([
      { id: 'doc_hanh_tran', cells: 1 },
      { id: 'luong_nghi_tran', cells: 2 },
      { id: 'tam_tai_tran', cells: 3 },
      { id: 'ngu_hanh_tran', cells: 5 },
      { id: 'cuu_cung_tran', cells: 9 },
    ])
  })
})

describe('cuu_cung_tran (full-board formation)', () => {
  it('unlocks all 9 standing slots of the local 3x3 space, each exactly once', () => {
    const formation = TRAN_PHAP_FORMATIONS.find((f) => f.id === 'cuu_cung_tran')

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
