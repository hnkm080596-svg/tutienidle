import { describe, expect, it } from 'vitest'
import { ELEMENT_ORDER } from './ElementLabels'
import { KHAC_OVERCOMES, SINH_CYCLE, khacOvercomer, relationOf } from './WuxingRelations'

// Phap Tu Reimagined Task 5 — the generic Ngũ Hành primitive. Sinh
// beneficiary and Khắc overcomer are DIRECTIONAL (cycle tables), never
// inferred from application order.
describe('WuxingRelations', () => {
  it('exactly 5 sinh + 5 khac unordered pairs over 5 elements', () => {
    let sinh = 0
    let khac = 0

    for (const a of ELEMENT_ORDER) {
      for (const b of ELEMENT_ORDER) {
        if (ELEMENT_ORDER.indexOf(a) >= ELEMENT_ORDER.indexOf(b)) continue

        const r = relationOf(a, b)
        if (r === 'sinh') sinh++
        else khac++
      }
    }

    expect(sinh).toBe(5)
    expect(khac).toBe(5)
  })

  it('same element and null pairs are not related', () => {
    for (const el of ELEMENT_ORDER) {
      expect(relationOf(el, el)).toBeNull()
    }
  })

  it('SINH_CYCLE: wood->fire->earth->metal->water->wood', () => {
    expect(SINH_CYCLE.wood).toBe('fire')
    expect(SINH_CYCLE.fire).toBe('earth')
    expect(SINH_CYCLE.earth).toBe('metal')
    expect(SINH_CYCLE.metal).toBe('water')
    expect(SINH_CYCLE.water).toBe('wood')
  })

  it('khacOvercomer: water beats fire either direction', () => {
    expect(khacOvercomer('fire', 'water')).toBe('water')
    expect(khacOvercomer('water', 'fire')).toBe('water')
  })

  it('khacOvercomer: every pair picks the directional overcomer', () => {
    expect(khacOvercomer('wood', 'earth')).toBe('wood')
    expect(khacOvercomer('earth', 'water')).toBe('earth')
    expect(khacOvercomer('metal', 'wood')).toBe('metal')
  })
})
