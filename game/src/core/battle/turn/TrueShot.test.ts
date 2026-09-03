import { describe, expect, it } from 'vitest'
import { bypassesEvasion } from './TrueShot'

describe('bypassesEvasion', () => {
  it('true khi skill có ignoresEvasion: true', () => {
    expect(bypassesEvasion({ ignoresEvasion: true })).toBe(true)
  })

  it('false khi ignoresEvasion: false hoặc không khai báo', () => {
    expect(bypassesEvasion({ ignoresEvasion: false })).toBe(false)
    expect(bypassesEvasion({})).toBe(false)
  })
})
