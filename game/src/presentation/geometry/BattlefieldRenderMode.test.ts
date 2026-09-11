// Feature flag renderer — default phải là perspective (renderer mới),
// giá trị lạ/broken storage rơi về default, set/get bền qua localStorage.
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getBattlefieldRenderMode, setBattlefieldRenderMode } from './BattlefieldRenderMode'

const STORAGE_KEY = 'tutienidle.battlefieldRenderMode'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe('BattlefieldRenderMode', () => {
  it('mặc định là perspective khi chưa có gì lưu', () => {
    expect(getBattlefieldRenderMode()).toBe('perspective')
  })

  it('set/get round-trip cả 2 mode', () => {
    setBattlefieldRenderMode('flat')
    expect(getBattlefieldRenderMode()).toBe('flat')

    setBattlefieldRenderMode('perspective')
    expect(getBattlefieldRenderMode()).toBe('perspective')
  })

  it('giá trị rác trong storage rơi về default thay vì vỡ', () => {
    localStorage.setItem(STORAGE_KEY, 'hologram')

    expect(getBattlefieldRenderMode()).toBe('perspective')
  })
})
