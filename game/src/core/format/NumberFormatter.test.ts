import { describe, expect, it } from 'vitest'
import { formatNumber } from './NumberFormatter'

describe('formatNumber', () => {
  it('hiện số nhỏ hơn 10,000 nguyên dạng có dấu phẩy', () => {
    expect(formatNumber(1250)).toBe('1,250')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(0)).toBe('0')
  })

  it('rút gọn theo hậu tố K/M/B/T, bỏ số 0 thừa', () => {
    expect(formatNumber(125_000)).toBe('125K')
    expect(formatNumber(2_400_000)).toBe('2.4M')
    expect(formatNumber(8_700_000_000)).toBe('8.7B')
    expect(formatNumber(1_250_000_000_000)).toBe('1.25T')
  })

  it('dùng ký hiệu khoa học vượt ngưỡng 1e15', () => {
    expect(formatNumber(1.23e18)).toBe('1.23e18')
  })

  it('giữ dấu âm', () => {
    expect(formatNumber(-125_000)).toBe('-125K')
  })

  it('không vỡ với giá trị không hữu hạn', () => {
    expect(formatNumber(NaN)).toBe('0')
    expect(formatNumber(Infinity)).toBe('0')
  })
})
