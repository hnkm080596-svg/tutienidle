import { describe, expect, it } from 'vitest'
import { ELEMENT_ORDER } from './ElementLabels'

// Spec 2026-08-30-phap-tu-dao-sac §5 — bỏ Phong/Lôi toàn hệ: ElementType
// còn đúng 5 hành Ngũ Hành, ELEMENT_ORDER không còn 'wind'/'lightning'.
describe('ElementType sau khi bỏ Phong/Lôi', () => {
  it('ELEMENT_ORDER đúng 5 hành Ngũ Hành, không wind/lightning', () => {
    expect(ELEMENT_ORDER).toEqual(['wood', 'fire', 'earth', 'metal', 'water'])
  })

  it('type-level: wind/lightning không còn là ElementType hợp lệ', async () => {
    // @ts-expect-error — 'wind' đã bị xoá khỏi union, gán này phải sai
    const invalid: (typeof ELEMENT_ORDER)[number] = 'wind'
    expect(invalid).toBe('wind')
  })
})
