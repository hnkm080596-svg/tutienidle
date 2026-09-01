import { describe, expect, it } from 'vitest'
import { formatDotDamageText } from './combatTextFormat'

describe('formatDotDamageText', () => {
  it('integer values round and display with minus sign', () => {
    expect(formatDotDamageText(123)).toBe('-123')
    expect(formatDotDamageText(7.5)).toBe('-8')
    expect(formatDotDamageText(1.4)).toBe('-1')
    expect(formatDotDamageText(0.9)).toBe('-1')
  })

  it('decimal values 0<x<1 show 1 decimal place with floor 0.1', () => {
    expect(formatDotDamageText(0.4)).toBe('-0.4')
    expect(formatDotDamageText(0.04)).toBe('-0.1')
    expect(formatDotDamageText(0.09)).toBe('-0.1')
  })

  it('large values format correctly', () => {
    expect(formatDotDamageText(1234.5)).toBe('-1,235')
    expect(formatDotDamageText(9999)).toBe('-9,999')
  })

  it('zero-like values never render -0.0', () => {
    expect(formatDotDamageText(0)).toBe('-0.1')
    expect(formatDotDamageText(-0)).not.toContain('-0.0')
  })
})
