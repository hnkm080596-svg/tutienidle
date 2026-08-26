import { describe, expect, it } from 'vitest'
import {
  ENEMY_SOURCE_SIZE,
  enemyTextureUrl,
  resolveEnemyTextureKey,
} from './EnemyArt'

// Mortal enemy art batch (plan) — map id runtime → texture, prefix match
// xử lý id spawn `<templateId>_<uuid>`.
describe('EnemyArt — resolveEnemyTextureKey', () => {
  it('id template khớp trực tiếp', () => {
    expect(resolveEnemyTextureKey('mortal_wild_boar')).toBe('mortal-wild-boar-v1')
    expect(resolveEnemyTextureKey('mortal_ferocious_water_wolf')).toBe(
      'mortal-ferocious-water-wolf-v1',
    )
  })

  it('id spawn kèm uuid — longest-prefix match không nhầm base với ferocious', () => {
    expect(resolveEnemyTextureKey('mortal_wild_boar_ab12cd34')).toBe('mortal-wild-boar-v1')

    // Ferocious PHẢI khớp bản ferocious (dài hơn đứng trước trong bảng).
    expect(resolveEnemyTextureKey('mortal_ferocious_wild_boar_ff09')).toBe(
      'mortal-ferocious-wild-boar-v1',
    )

    expect(resolveEnemyTextureKey('mortal_ferocious_giant_crocodile_x1')).toBe(
      'mortal-ferocious-giant-crocodile-v1',
    )
  })

  it('id ngoài batch Mortal → undefined (fallback Rectangle màu)', () => {
    expect(resolveEnemyTextureKey('enemy_1')).toBeUndefined()
    expect(resolveEnemyTextureKey('wild_wolf_ab12')).toBeUndefined()
    expect(resolveEnemyTextureKey('boss')).toBeUndefined()
  })

  it('đủ 20 texture, url trỏ đúng thư mục mortal', () => {
    const keys = new Set(
      [
        'mortal_wild_boar',
        'mortal_mountain_bandit',
        'mortal_feral_dog',
        'mortal_savage_tiger',
        'mortal_stone_lynx',
        'mortal_mud_ox',
        'mortal_silver_fox',
        'mortal_iron_boar',
        'mortal_water_wolf',
        'mortal_giant_crocodile',
        'mortal_ferocious_wild_boar',
        'mortal_ferocious_mountain_bandit',
        'mortal_ferocious_feral_dog',
        'mortal_ferocious_savage_tiger',
        'mortal_ferocious_stone_lynx',
        'mortal_ferocious_mud_ox',
        'mortal_ferocious_silver_fox',
        'mortal_ferocious_iron_boar',
        'mortal_ferocious_water_wolf',
        'mortal_ferocious_giant_crocodile',
      ].map((id) => resolveEnemyTextureKey(id)),
    )

    expect(keys.size).toBe(20)

    for (const key of keys) {
      expect(enemyTextureUrl(key!)).toMatch(/^\/assets\/enemies\/mortal\/mortal-.+-v1\.png$/)
    }

    expect(ENEMY_SOURCE_SIZE).toEqual({ w: 1254, h: 1254 })
  })
})
