// @vitest-environment jsdom
//
// Walk sway đã XÓA HẴN (yêu cầu 2026-08-26 — "không dùng flag tạm thời,
// xóa hẳn để tránh quay lại lỗi cũ"): positionSprite chỉ còn tọa độ
// projection/interpolation + action offset (lunge/recoil) + rotation của
// death animation. Test này khóa hành vi: di chuyển bình thường KHÔNG
// BAO GIỜ sinh offset/bob/tilt — rotation luôn 0, vị trí bám đúng điểm
// chiếu.
import { describe, expect, it } from 'vitest'
import { CombatScene } from './CombatScene'

function chainableRect() {
  const state = {
    rotation: 123 as number,

    positions: [] as Array<{ x: number; y: number }>,

    setRotation(value: number) {
      state.rotation = value

      return state
    },

    setPosition(x: number, y: number) {
      state.positions.push({ x, y })

      return state
    },

    setDisplaySize() {
      return state
    },

    setScale(_value: number) {
      return state
    },
  }

  return state
}

function createScene(renderMode: 'flat' | 'perspective') {
  const scene = Object.create(CombatScene.prototype) as any

  scene.renderMode = renderMode
  scene.projection = {
    gridToScreen(row: number, column: number) {
      // Điểm chiếu tuyến tính theo column — mô phỏng unit đang đi.
      return { x: 100 + column * 10, y: 200 + row * 5, scale: 1 }
    },
  }
  scene.dyingIds = new Set<string>()

  const rect = chainableRect()

  const sprite = {
    kind: 'sprite',
    rect,
    label: { setPosition: () => undefined },
    color: 0xffffff,
    offsetX: 0,
    row: 2,
    sizeMultiplier: 1,
    boost: { value: 1 },
    footY: 0,
    columnFloat: 0,
    shadow: undefined,
    healthBar: undefined,
    sourceSize: { w: 1254, h: 1254 },
  }

  return { scene, sprite, rect }
}

describe('CombatScene — walk sway bị xóa hoàn toàn', () => {
  it('di chuyển liên tục: rotation giữ nguyên, không bao giờ bị xoay', () => {
    const { scene, sprite, rect } = createScene('perspective')

    // Sentinel 123 rad — mọi lệnh setRotation ngoài death tween đều lộ.
    for (let frame = 0; frame < 40; frame++) {
      scene.positionSprite(sprite, frame * 0.25, 'enemy_walk')
    }

    expect(rect.rotation).toBe(123)
  })

  it('vị trí bám đúng điểm chiếu (không cộng sway/bob), footY cập nhật', () => {
    const { scene, sprite, rect } = createScene('perspective')

    for (let column = -3; column <= 3; column += 0.5) {
      scene.positionSprite(sprite, column, 'enemy_walk')

      const last = rect.positions.at(-1)!

      expect(last.x).toBe(100 + column * 10)

      expect(last.y).toBe(210)
    }

    expect(sprite.footY).toBe(210)

    expect(sprite.columnFloat).toBe(3)
  })

  it('action offset (lunge) vẫn hoạt động — nhân depth scale, vẫn không xoay', () => {
    const { scene, sprite, rect } = createScene('perspective')

    sprite.offsetX = 8

    scene.positionSprite(sprite, 0, 'enemy_lunge')

    expect(rect.positions[0]).toEqual({ x: 108, y: 210 })

    expect(rect.rotation).toBe(123)
  })

  it('flat mode: vị trí thẳng, không xoay, boost áp qua setScale', () => {
    const { scene, sprite, rect } = createScene('flat')

    const scales: number[] = []

    rect.setScale = (value: number) => {
      scales.push(value)

      return rect
    }

    sprite.boost.value = 1

    scene.positionSprite(sprite, 2, 'enemy_flat')

    expect(rect.positions[0]).toEqual({ x: 120, y: 210 })

    expect(scales).toEqual([1])
  })
})
