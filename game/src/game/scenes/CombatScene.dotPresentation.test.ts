// @vitest-environment jsdom
//
// DoT presentation (combat-skill-flow-element-power-dot-plan.md §7) —
// bộ gom damage text 3 lần/giây: nhiều fixed tick trong cửa sổ
// 333,33ms chỉ sinh MỘT text/khóa; tổng hiển thị bằng tổng event đã
// gom; direct hit KHÔNG đi qua accumulator; dọn khi target chết.
import { describe, expect, it } from 'vitest'
import { CombatScene, formatDotDamageText } from './CombatScene'

function createScene() {
  const scene = Object.create(CombatScene.prototype) as any

  scene.time = { now: 0 }
  scene.dotAccumulators = new Map()

  // Sprite registry tối thiểu cho spriteFor().
  const sprites = new Map<string, unknown>()

  scene.sprites = sprites

  scene.spriteForRaw = (id?: string) => (id ? sprites.get(id) : undefined)

  const shown: Array<{ id: string; value: number; color: string }> = []

  scene.showDotDamageNumber = (sprite: { id: string }, value: number, color: string) => {
    shown.push({ id: sprite.id, value, color })
  }

  return {
    scene,

    shown,

    addSprite(id: string) {
      sprites.set(id, { id })
    },
  }
}

const EFFECT_EVENT = (over: Partial<Record<string, unknown>>) => ({
  type: 'damage',

  targetId: 'enemy_1',

  sourceId: 'player',

  effectId: 'bong',

  value: 1,

  ...over,
})

describe('CombatScene — DoT accumulator 3 lần/giây (plan §7)', () => {
  it('nhiều tick trong 333ms chỉ flush ĐÚNG 1 text cho mỗi khóa', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    // 5 tick trong cùng cửa sổ đầu tiên (mỗi tick 50ms < 333ms).
    for (let i = 0; i < 5; i++) {
      scene.time.now = i * 50

      scene.onDamageNumber(EFFECT_EVENT({}))
    }

    expect(shown).toHaveLength(0)

    // Quá cửa sổ — frame kế flush đúng 1 text.
    scene.time.now = 400

    scene.flushDueDotTexts()

    expect(shown).toHaveLength(1)
    expect(shown[0]!.id).toBe('enemy_1')
  })

  it('tổng text bằng tổng event đã gom trong cửa sổ', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    for (let i = 0; i < 3; i++) {
      scene.onDamageNumber(EFFECT_EVENT({ value: 2.5 }))
    }

    scene.time.now = 400

    scene.flushDueDotTexts()

    expect(shown[0]!.value).toBeCloseTo(7.5, 6)
  })

  it('khác khóa (effectId hoặc target khác nhau) flush RIÊNG mỗi khóa', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')
    addSprite('enemy_2')

    scene.onDamageNumber(EFFECT_EVENT({}))
    scene.onDamageNumber(EFFECT_EVENT({ effectId: 'chay_mau' }))
    scene.onDamageNumber(EFFECT_EVENT({ targetId: 'enemy_2' }))

    scene.time.now = 400

    scene.flushDueDotTexts()

    expect(shown).toHaveLength(3)
  })

  it('direct hit (không effectId) KHÔNG đi qua accumulator', () => {
    const { scene, addSprite } = createScene()

    addSprite('enemy_1')

    // onDamageNumber với event không effectId phải rẽ nhánh direct path —
    // direct path gọi showDamageNumber (không stub ở đây) nên chỉ cần
    // chắc chắn accumulator TRỐNG là đủ cho hợp đồng accumulator.
    try {
      scene.onDamageNumber({ type: 'damage', targetId: 'enemy_1', value: 10 })
    } catch {
      // showDamageNumber thật cần Phaser objects — jsdom không có;
      // quan trọng là KHÔNG có bucket nào được tạo.
    }

    expect(scene.dotAccumulators.size).toBe(0)
  })

  it('bucket của target chết bị xóa, không flush text mồ côi', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    scene.onDamageNumber(EFFECT_EVENT({}))

    // Mô phỏng purge khi chết (cùng logic onDeath dùng).
    for (const key of [...scene.dotAccumulators.keys()]) {
      if (key.split('|')[0] === 'enemy_1') {
        scene.dotAccumulators.delete(key)
      }
    }

    scene.sprites.delete('enemy_1')

    scene.time.now = 400

    scene.flushDueDotTexts()

    expect(shown).toHaveLength(0)
  })

  it('battle_end dọn TOÀN BỘ accumulator — bucket cũ không rò sang trận kế', () => {
    const { scene, addSprite } = createScene()

    addSprite('enemy_1')
    addSprite('enemy_2')

    scene.onDamageNumber(EFFECT_EVENT({}))
    scene.onDamageNumber(EFFECT_EVENT({ targetId: 'enemy_2' }))

    expect(scene.dotAccumulators.size).toBeGreaterThan(0)

    // renderMode 'flat' → prepareThanhVanBackdropForNextBattle no-op,
    // onBattleEnd chạy an toàn với stub tối thiểu.
    scene.renderMode = 'flat'
    scene.inBattle = true

    scene.onBattleEnd()

    expect(scene.dotAccumulators.size).toBe(0)
    expect(scene.inBattle).toBe(false)
  })

  it('format số nhỏ: 0<x<1 hiện 1 chữ số thập phân, sàn 0.1 — KHÔNG bao giờ -0.0', () => {
    expect(formatDotDamageText(0.4)).toBe('-0.4')
    expect(formatDotDamageText(0.04)).toBe('-0.1')

    // Kỳ vọng SAI cũ (đã sửa): 0.04 từng bị kỳ vọng thành '-0.0'.
    expect(formatDotDamageText(0.04)).not.toBe('-0.0')
    expect(formatDotDamageText(-0)).not.toContain('-0.0')

    expect(formatDotDamageText(1.4)).toBe('-1')
    expect(formatDotDamageText(7.5)).toBe('-8')
  })
})
