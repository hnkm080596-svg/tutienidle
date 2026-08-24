// Depth sort entity — projected Y phải thắng tuyệt đối, column/id chỉ
// phá hòa; cùng input cho cùng depth (không flicker giữa các frame).
import { describe, expect, it } from 'vitest'
import {
  DEPTH_ENTITY_SPRITE_BASE,
  DEPTH_ENTITY_SPRITE_SPAN,
  DEPTH_UPRIGHT_VFX,
  ID_TIE_BREAKER_MAX,
  UPRIGHT_VFX_DEPTH_BIAS,
  entitySpriteDepth,
  spatialEntityDepth,
  uprightVfxDepth,
} from './BattleLayers'

describe('entitySpriteDepth', () => {
  it('entity foot Y LỚN HƠN (gần camera) có depth lớn hơn — gần đè xa', () => {
    const far = entitySpriteDepth(200, 100, 500, 8, 'enemy_a')
    const near = entitySpriteDepth(480, 100, 500, 0, 'enemy_b')

    expect(near).toBeGreaterThan(far)
  })

  it('cùng hàng (Y trùng): column lớn hơn (bên phải) vẽ trên', () => {
    const left = entitySpriteDepth(300, 100, 500, 2, 'enemy_a')
    const right = entitySpriteDepth(300, 100, 500, 9, 'enemy_b')

    expect(right).toBeGreaterThan(left)
  })

  it('column trùng: id khác nhau vẫn phân thứ tự ổn định (deterministic)', () => {
    const first = entitySpriteDepth(300, 100, 500, 4, 'enemy_a')
    const second = entitySpriteDepth(300, 100, 500, 4, 'enemy_b')

    expect(first).not.toBe(second)
    expect(entitySpriteDepth(300, 100, 500, 4, 'enemy_a')).toBe(first)
  })

  it('depth luôn nằm trong dải lớp entity sprite, không tràn sang upright VFX', () => {
    for (let row = 0; row <= 10; row++) {
      for (let column = -2; column <= 18; column += 5) {
        const depth = entitySpriteDepth(row * 50 + 20, 20, 520, column, `id_${row}_${column}`)

        expect(depth).toBeGreaterThanOrEqual(DEPTH_ENTITY_SPRITE_BASE)
        expect(depth).toBeLessThan(DEPTH_ENTITY_SPRITE_BASE + DEPTH_ENTITY_SPRITE_SPAN)
        expect(depth).toBeLessThan(DEPTH_UPRIGHT_VFX)
      }
    }
  })

  it('Y phẳng (min === max) không chia 0, depth vẫn trong dải lớp', () => {
    const depth = entitySpriteDepth(123, 123, 123, 3, 'solo')

    expect(Number.isFinite(depth)).toBe(true)
    expect(depth).toBeGreaterThanOrEqual(DEPTH_ENTITY_SPRITE_BASE)
    expect(depth).toBeLessThan(DEPTH_ENTITY_SPRITE_BASE + DEPTH_ENTITY_SPRITE_SPAN)
  })
})

describe('uprightVfxDepth — occlusion 2.5D', () => {
  const MIN = 100
  const MAX = 500

  it('bias PHẢI lớn hơn toàn bộ dải ID tie-breaker (bất kể hash)', () => {
    expect(UPRIGHT_VFX_DEPTH_BIAS).toBeGreaterThan(ID_TIE_BREAKER_MAX)

    // Property test: với MỌI entity id, effect cùng foot Y + column luôn
    // phủ entity — không phụ thuộc may rủi hash của key.
    const ids = ['enemy_a', 'enemy_b', 'boss_1', 'player', 'x', 'zz-99-đạo', '']

    for (const id of ids) {
      const targetDepth = entitySpriteDepth(300, MIN, MAX, 5, id)
      const vfxDepth = uprightVfxDepth(300, MIN, MAX, 5)

      expect(vfxDepth).toBeGreaterThan(targetDepth)
    }
  })

  it('entity hàng GẦN hơn vẫn che được effect ở hàng sau', () => {
    // Effect nổ ở hàng xa (foot 160); entity đứng gần camera (foot 460).
    const vfxDepth = uprightVfxDepth(160, MIN, MAX, 8)
    const foregroundEntity = entitySpriteDepth(460, MIN, MAX, 0, 'enemy_near')

    expect(foregroundEntity).toBeGreaterThan(vfxDepth)
  })

  it('spatialEntityDepth thuần — không có thành phần hash', () => {
    const depthA = spatialEntityDepth(300, MIN, MAX, 5)
    const depthB = spatialEntityDepth(300, MIN, MAX, 5)

    expect(depthA).toBe(depthB)
    expect(depthA).toBeGreaterThanOrEqual(DEPTH_ENTITY_SPRITE_BASE)
  })
})
