import { describe, expect, it } from 'vitest'
import { resolveSpriteBodyAnchor } from './SpriteBodyAnchor'

// Body anchor resolver (plan §5.2 + §9): normalized anchor → screen
// point, tính đủ origin center/foot, flipX, rotation và extra scale.
describe('resolveSpriteBodyAnchor', () => {
  it('origin center (flat legacy) — chest ở giữa trên', () => {
    const point = resolveSpriteBodyAnchor(
      { x: 0.5, y: 0.25 },
      {
        x: 100,
        y: 200,
        displayWidth: 40,
        displayHeight: 80,
        originX: 0.5,
        originY: 0.5,
      },
    )

    // offset = (0, (0.25-0.5)*80) = (0, -20).
    expect(point).toEqual({ x: 100, y: 180 })
  })

  it('origin foot (perspective) — castHand dưới gốc tọa độ sprite', () => {
    const point = resolveSpriteBodyAnchor(
      { x: 0.7, y: 0.4 },
      {
        x: 300,
        y: 500,
        displayWidth: 60,
        displayHeight: 120,
        originX: 0.5,
        originY: 1,
      },
    )

    // offset = ((0.7-0.5)*60, (0.4-1)*120) = (12, -72).
    expect(point).toEqual({ x: 312, y: 428 })
  })

  it('flipX mirror hoành độ quanh origin', () => {
    const base = {
      x: 0,
      y: 0,

      displayWidth: 100,

      displayHeight: 50,

      originX: 0.5,

      originY: 1,
    }

    // castHand phải (x=0.8): thường lệch phải; flip → lệch trái.
    const normal = resolveSpriteBodyAnchor({ x: 0.8, y: 0.6 }, base)
    const flipped = resolveSpriteBodyAnchor({ x: 0.8, y: 0.6 }, { ...base, flipX: true })

    expect(normal.x).toBeCloseTo(30, 5)
    expect(flipped.x).toBeCloseTo(-30, 5)
    expect(normal.y).toBeCloseTo(flipped.y, 5)
  })

  it('rotation xoay offset quanh origin (90° = π/2)', () => {
    const point = resolveSpriteBodyAnchor(
      { x: 0.5, y: 0 },

      {
        x: 10,

        y: 10,

        displayWidth: 20,

        displayHeight: 40,

        originX: 0.5,

        originY: 1,

        rotation: Math.PI / 2,
      },
    )

    // offset (0, -40) quay 90° theo chiều kim đồng hồ (y xuống dưới) →
    // (+40, ~0) — điểm nằm bên PHẢI origin.
    expect(point.x).toBeCloseTo(50, 5)
    expect(point.y).toBeCloseTo(10, 5)
  })

  it('extraScale nhân thêm offset khi display size chưa bake depth scale', () => {
    const point = resolveSpriteBodyAnchor(
      { x: 1, y: 1 },

      {
        x: 0,

        y: 0,

        displayWidth: 10,

        displayHeight: 10,

        originX: 0,

        originY: 0,

        extraScale: 2,
      },
    )

    expect(point).toEqual({ x: 20, y: 20 })
  })

  it('castHand bám tay khi sprite bob (y đổi) — sustained VFX giải live', () => {
    const anchor = { x: 0.66, y: 0.46 }

    const standing = resolveSpriteBodyAnchor(anchor, {
      x: 200,

      y: 400,

      displayWidth: 48,

      displayHeight: 64,

      originX: 0.5,

      originY: 1,
    })

    const bobbing = resolveSpriteBodyAnchor(anchor, {
      x: 200,

      y: 397,

      displayWidth: 48,

      displayHeight: 64,

      originX: 0.5,

      originY: 1,
    })

    // Bob -3px → anchor dịch theo ĐÚNG -3px (không lag, không cache).
    expect(bobbing.y).toBeCloseTo(standing.y - 3, 5)
  })
})
