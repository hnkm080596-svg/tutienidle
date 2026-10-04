import { describe, expect, it } from 'vitest'
import { ELEMENT_ORDER } from './ElementLabels'

// Spec 2026-08-30-phap-tu-dao-sac sec5 - bo Phong/Loi toan he: ElementType
// con dung 5 hanh Ngu Hanh, ELEMENT_ORDER khong con 'wind'/'lightning'.
describe('ElementType sau khi bỏ Phong/Lôi', () => {
  it('ELEMENT_ORDER đúng 5 hành Ngũ Hành, không wind/lightning', () => {
    expect(ELEMENT_ORDER).toEqual(['wood', 'fire', 'earth', 'metal', 'water'])
  })

  it('type-level: wind/lightning không còn là ElementType hợp lệ', async () => {
    // @ts-expect-error - 'wind' da bi xoa khoi union, gan nay phai sai
    const invalid: (typeof ELEMENT_ORDER)[number] = 'wind'
    expect(invalid).toBe('wind')
  })
})
