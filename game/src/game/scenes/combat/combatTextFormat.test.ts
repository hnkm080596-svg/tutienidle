import { describe, expect, it } from 'vitest'
import { fitEntityLabelText, formatDotDamageText } from './combatTextFormat'

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

// ui-combat reskin (2026-10-04) - the width cap that keeps a long enemy
// name inside its grid column: a stub `measure` standing in for the
// Phaser text width.
describe('fitEntityLabelText', () => {
  const widthOf = (text: string, fontSize: number): number => text.length * fontSize * 0.5

  it('keeps the full name at the default size when it fits', () => {
    expect(fitEntityLabelText('Bo', widthOf, 100)).toEqual({ text: 'Bo', fontSize: 14 })
  })

  it('shrinks to the smaller size when the name only fits there', () => {
    // 'Beast' at 14px measures 35px > 30 cap; at 12px it is 30 <= 30.
    expect(fitEntityLabelText('Beast', widthOf, 30)).toEqual({ text: 'Beast', fontSize: 12 })
  })

  it('ellipsizes at the smallest size when no size fits', () => {
    const fitted = fitEntityLabelText('Con Heo Rung Dai', widthOf, 20)

    expect(fitted.fontSize).toBe(12)
    expect(fitted.text.endsWith('…')).toBe(true)
    expect(fitted.text.length).toBeLessThan('Con Heo Rung Dai'.length)
    expect(widthOf(fitted.text, fitted.fontSize)).toBeLessThanOrEqual(20)
  })

  it('degrades to a bare ellipsis when even one char overflows', () => {
    expect(fitEntityLabelText('XX', widthOf, 1)).toEqual({ text: '…', fontSize: 12 })
  })

  it('honours a custom font-size ladder', () => {
    // 'Name' measures 20px at 10, 18px at 9, 16px at 8 -> only 8 fits 17.
    expect(fitEntityLabelText('Name', widthOf, 17, [10, 9, 8])).toEqual({ text: 'Name', fontSize: 8 })
  })
})
