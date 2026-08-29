import { describe, expect, it } from 'vitest'
import { SKILLS } from './Skills'

// Combat Balance Pass (2026-08-29) — Task 2 "dọn dữ liệu cost chết".
// Quyết định người dùng: mana KHÔNG phải tài nguyên cast skill (mana là
// Linh lực hộ thể — manaShieldPercent). Invariant này chống hồi quy dữ
// liệu cost/resourceType: một skill khai cost thật PHẢI có resourceType
// tương ứng để cost có nghĩa, và skill không tốn tài nguyên KHÔNG được
// khai cost (tránh noise khi đọc data).
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
