import { describe, expect, it } from 'vitest'
import { validateAssetDefinitions, validateRasterFacts } from './inkWashAssetValidation'

describe('ink-wash asset validation', () => {
  it('rejects duplicate IDs and impossible horizontal slice geometry', () => {
    const errors = validateAssetDefinitions([
      { id: 'x', width: 64, height: 64, left: 40, right: 40, top: 12, bottom: 12 },
      { id: 'x', width: 64, height: 64, left: 12, right: 12, top: 12, bottom: 12 },
    ])

    expect(errors).toContain('duplicate asset id: x')
    expect(errors).toContain('x: left + right exceeds source width')
  })

  it('rejects non-integer dimensions and impossible vertical slice geometry', () => {
    const errors = validateAssetDefinitions([
      { id: 'bad', width: 64.5, height: 32, left: 8, right: 8, top: 20, bottom: 20 },
    ])

    expect(errors).toContain('bad: width must be a positive integer')
    expect(errors).toContain('bad: top + bottom exceeds source height')
  })

  it('requires exact dimensions and alpha for transparent-center frames', () => {
    expect(validateRasterFacts(
      {
        id: 'frame-xs-ink-line',
        sourceWidth: 64,
        sourceHeight: 64,
        center: 'transparent',
      },
      { width: 63, height: 64, centerAlpha: 255 },
    )).toEqual([
      'frame-xs-ink-line: expected 64x64, received 63x64',
      'frame-xs-ink-line: transparent center contains opaque pixels',
    ])
  })

  it('allows opaque centers for filled surfaces', () => {
    expect(validateRasterFacts(
      { id: 'button-s-paper', sourceWidth: 192, sourceHeight: 64, center: 'fill' },
      { width: 192, height: 64, centerAlpha: 255 },
    )).toEqual([])
  })
})
