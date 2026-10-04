import { describe, expect, it } from 'vitest'
import { SKILLS } from './Skills'

// Combat Balance Pass (2026-08-29) - Task 2 "don du lieu cost chet".
// Quyet dinh nguoi dung: mana KHONG phai tai nguyen cast skill (mana la
// Linh luc ho the - manaShieldPercent). Invariant nay chong hoi quy du
// lieu cost/resourceType: mot skill khai cost that PHAI co resourceType
// tuong ung de cost co nghia, va skill khong ton tai nguyen KHONG duoc
// khai cost (tranh noise khi doc data).
describe('Skills cost/resourceType invariant', () => {
  it('mọi skill khai cost > 0 đều có resourceType thật (không phải none)', () => {
    for (const skill of SKILLS) {
      const cost = skill.cost ?? 0

      if (cost > 0) {
        expect(skill.resourceType, `${skill.id} khai cost ${cost} nhưng resourceType '${skill.resourceType}'`).not.toBe(
          'none',
        )
        expect(skill.resourceType, `${skill.id} khai cost ${cost} nhưng thiếu resourceType`).toBeTruthy()
      }
    }
  })

  it('skill có resourceType none không khai cost (cost rỗng/0)', () => {
    for (const skill of SKILLS) {
      if (skill.resourceType === 'none' || skill.resourceType === undefined) {
        expect(skill.cost, `${skill.id} (${skill.resourceType}) không được khai cost`).toBeUndefined()
      }
    }
  })

  it('mọi skill active đều có execution policy', () => {
    for (const skill of SKILLS) {
      if (skill.type === 'active') {
        expect(skill.execution, `${skill.id} là active nhưng thiếu execution policy`).toBeTruthy()
      }
    }
  })
})
