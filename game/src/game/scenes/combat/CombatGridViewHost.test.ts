// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { CombatGridViewHost } from './CombatGridViewHost'
import { CombatScene } from '../CombatScene'

describe('CombatScene implements CombatGridViewHost', () => {
  it('fallbackSpriteTextureKey() luôn trả undefined — combat thật KHÔNG đổi hành vi Rectangle fallback', () => {
    const scene = Object.create(CombatScene.prototype) as CombatScene

    expect(scene.fallbackSpriteTextureKey('anything')).toBeUndefined()
    expect(scene.fallbackSpriteTextureKey('')).toBeUndefined()
  })

  it('type-check: CombatScene thoả CombatGridViewHost (biên dịch được là đủ chứng minh)', () => {
    const assertHost = (_host: CombatGridViewHost) => {}
    const scene = Object.create(CombatScene.prototype) as CombatScene

    // Khong throw o runtime - muc dich DUY NHAT cua dong nay la buoc
    // TypeScript kiem tra CombatScene thoa CombatGridViewHost luc bien dich.
    expect(() => assertHost(scene)).not.toThrow()
  })
})
