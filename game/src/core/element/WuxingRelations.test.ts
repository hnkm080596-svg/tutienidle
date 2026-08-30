import { describe, expect, it } from 'vitest'
import { isSinhCycle, SINH_CYCLE, wuxingRelation } from './WuxingRelations'

// Spec 2026-08-30-phap-tu-dao-sac §3.4 — bảng quan hệ ngũ hành: sinh
// Mộc→Hỏa→Thổ→Kim→Thủy→Mộc; khắc Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim,
// Kim⇄Mộc. Adjacency: 2 slot kề nhau trong loadout.
describe('wuxingRelation', () => {
  it('sinh đúng chiều vòng ngoài', () => {
    expect(wuxingRelation('wood', 'fire')).toBe('sinh')
    expect(wuxingRelation('fire', 'earth')).toBe('sinh')
    expect(wuxingRelation('earth', 'metal')).toBe('sinh')
    expect(wuxingRelation('metal', 'water')).toBe('sinh')
    expect(wuxingRelation('water', 'wood')).toBe('sinh')
  })

  it('khắc đối xứng 5 cặp chéo', () => {
    expect(wuxingRelation('wood', 'earth')).toBe('khac')
    expect(wuxingRelation('earth', 'wood')).toBe('khac')
    expect(wuxingRelation('earth', 'water')).toBe('khac')
    expect(wuxingRelation('water', 'earth')).toBe('khac')
    expect(wuxingRelation('water', 'fire')).toBe('khac')
    expect(wuxingRelation('fire', 'water')).toBe('khac')
    expect(wuxingRelation('fire', 'metal')).toBe('khac')
    expect(wuxingRelation('metal', 'fire')).toBe('khac')
    expect(wuxingRelation('metal', 'wood')).toBe('khac')
    expect(wuxingRelation('wood', 'metal')).toBe('khac')
  })

  it('cùng hành hoặc không quan hệ → none', () => {
    expect(wuxingRelation('fire', 'fire')).toBe('none')
    expect(wuxingRelation('wood', 'metal') === 'khac' ? 'khac' : 'none').not.toBe('sinh')
    // wood sinh fire, nhưng fire KHÔNG sinh wood (đơn hướng)
    expect(wuxingRelation('fire', 'wood')).toBe('none')
    // Kim sinh Thủy — Thủy không sinh Kim
    expect(wuxingRelation('water', 'metal')).toBe('none')
  })
})

describe('isSinhCycle (Luân Chuyển — spec §3.2)', () => {
  it('đủ 5 slot đúng thứ tự vòng sinh → true (về skill đầu)', () => {
    expect(isSinhCycle(['wood', 'fire', 'earth', 'metal', 'water'])).toBe(true)
  })

  it('xoay vòng bắt đầu từ giữa vẫn đúng vòng sinh → true', () => {
    expect(isSinhCycle(['metal', 'water', 'wood', 'fire', 'earth'])).toBe(true)
  })

  it('đảo thứ tự sai vòng sinh → false', () => {
    expect(isSinhCycle(['wood', 'earth', 'fire', 'metal', 'water'])).toBe(false)
  })

  it('chưa đủ 5 slot → false', () => {
    expect(isSinhCycle(['wood', 'fire'])).toBe(false)
  })
})

describe('SINH_CYCLE', () => {
  it('đúng thứ tự vòng sinh Mộc→Hỏa→Thổ→Kim→Thủy', () => {
    expect(SINH_CYCLE).toEqual(['wood', 'fire', 'earth', 'metal', 'water'])
  })
})
