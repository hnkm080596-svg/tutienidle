import { describe, expect, it } from 'vitest'
import { clamp } from './clamp'

describe('clamp — kẹp giá trị vào [min, max]', () => {
  it('giá trị trong khoảng giữ nguyên', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('giá trị dưới min kẹp về min', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
  })

  it('giá trị trên max kẹp về max', () => {
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('min = max (giá trị cố định)', () => {
    expect(clamp(0, 5, 5)).toBe(5)
    expect(clamp(100, 5, 5)).toBe(5)
  })

  it('giá trị âm và khoảng âm', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(-20, -10, -1)).toBe(-10)
  })

  it('hỗ trợ số thập phân và biên lẻ', () => {
    expect(clamp(0.5, 0.1, 0.9)).toBe(0.5)
    expect(clamp(0.05, 0.1, 0.9)).toBe(0.1)
  })

  it('giá trị phi số (NaN/Infinity) đi qua theo thứ tự Math.min/max', () => {
    expect(clamp(Number.NaN, 0, 10)).toBeNaN()
    expect(clamp(Number.POSITIVE_INFINITY, 0, 10)).toBe(10)
    expect(clamp(Number.NEGATIVE_INFINITY, 0, 10)).toBe(0)
  })
})
