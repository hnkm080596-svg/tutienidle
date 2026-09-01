import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration — compact', () => {
  it('chỉ giây', () => {
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(59)).toBe('59s')
  })

  it('phút + giây, giây pad 2 chữ số', () => {
    expect(formatDuration(90)).toBe('1p 30s')
    expect(formatDuration(310)).toBe('5p 10s')
  })

  it('giây lẻ làm tròn xuống', () => {
    expect(formatDuration(45.9)).toBe('45s')
  })

  it('giờ > 0 luôn kèm phút', () => {
    expect(formatDuration(3600)).toBe('1h 0p')
    expect(formatDuration(3661)).toBe('1h 1p 01s')
    expect(formatDuration(9000)).toBe('2h 30p 00s')
  })

  it('giờ tròn không lọt unit 0 bị bỏ (nội bộ: h>0 luôn có p)', () => {
    expect(formatDuration(7200)).toBe('2h 0p')
  })
})

describe('formatDuration — precise', () => {
  it('luôn đủ h/m/s', () => {
    expect(formatDuration(0, 'precise')).toBe('0h 0m 0s')
    expect(formatDuration(45, 'precise')).toBe('0h 0m 45s')
    expect(formatDuration(90, 'precise')).toBe('0h 1m 30s')
    expect(formatDuration(3600, 'precise')).toBe('1h 0m 0s')
    expect(formatDuration(3661, 'precise')).toBe('1h 1m 1s')
    expect(formatDuration(9015.7, 'precise')).toBe('2h 30m 15s')
  })
})

describe('formatDuration — countdown', () => {
  it('tổng giây nguyên', () => {
    expect(formatDuration(15, 'countdown')).toBe('15s')
    expect(formatDuration(90, 'countdown')).toBe('90s')
    expect(formatDuration(3661, 'countdown')).toBe('3661s')
  })

  it('làm tròn GẦN cho giá trị lẻ', () => {
    expect(formatDuration(14.6, 'countdown')).toBe('15s')
    expect(formatDuration(14.4, 'countdown')).toBe('14s')
  })
})

describe('formatDuration — edge cases', () => {
  it('âm kẹp về 0', () => {
    expect(formatDuration(-5)).toBe('0s')
    expect(formatDuration(-5, 'precise')).toBe('0h 0m 0s')
    expect(formatDuration(-5, 'countdown')).toBe('0s')
  })

  it('giá trị không hữu hạn kẹp về 0', () => {
    expect(formatDuration(Number.NaN)).toBe('0s')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s')
  })

  it('mặc định là compact', () => {
    expect(formatDuration(90)).toBe('1p 30s')
  })
})
