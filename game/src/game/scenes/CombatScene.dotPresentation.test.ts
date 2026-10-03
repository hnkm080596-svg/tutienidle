// @vitest-environment jsdom
//
// DoT presentation (combat-skill-flow-element-power-dot-plan.md sec7) -
// bo gom damage text 3 lan/giay: nhieu fixed tick trong cua so
// 333,33ms chi sinh MOT text/khoa; tong hien thI bang tong event da
// gom; direct hit KHONG di qua accumulator; don khi target chet.
import { describe, expect, it } from 'vitest'
import { formatDotDamageText } from './CombatScene'
import { createTestScene } from './combat/combatTestHarness'

function createScene() {
  const scene = createTestScene('bare')

  scene.time = { now: 0 }
  scene.dotAccumulators = new Map()

  // Sprite registry toi thieu cho spriteFor().
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

describe('CombatScene â€” DoT accumulator 3 láº§n/giÃ¢y (plan Â§7)', () => {
  it('nhiá»u tick trong 333ms chá»‰ flush ÄÃšNG 1 text cho má»—i khÃ³a', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    // 5 tick trong cung cua so dau tien (moi tick 50ms < 333ms).
    for (let i = 0; i < 5; i++) {
      scene.time.now = i * 50

      scene.onDamageNumber(EFFECT_EVENT({}))
    }

    expect(shown).toHaveLength(0)

    // Qua cua so - frame ke flush dung 1 text.
    scene.time.now = 400

    scene.flushDueDotTexts()

    expect(shown).toHaveLength(1)
    expect(shown[0]!.id).toBe('enemy_1')
  })

  it('tá»•ng text báº±ng tá»•ng event Ä‘Ã£ gom trong cá»­a sá»•', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    for (let i = 0; i < 3; i++) {
      scene.onDamageNumber(EFFECT_EVENT({ value: 2.5 }))
    }

    scene.time.now = 400

    scene.flushDueDotTexts()

    expect(shown[0]!.value).toBeCloseTo(7.5, 6)
  })

  it('khÃ¡c khÃ³a (effectId hoáº·c target khÃ¡c nhau) flush RIÃŠNG má»—i khÃ³a', () => {
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

  it('direct hit (khÃ´ng effectId) KHÃ”NG Ä‘i qua accumulator', () => {
    const { scene, addSprite } = createScene()

    addSprite('enemy_1')

    // onDamageNumber vOi event khong effectId phai re nhanh direct path -
    // direct path goi showDamageNumber (khong stub o day) nen chi can
    // chac chan accumulator TRONG la du cho hop dong accumulator.
    try {
      scene.onDamageNumber({ type: 'damage', targetId: 'enemy_1', value: 10 })
    } catch {
      // showDamageNumber that can Phaser objects - jsdom khong co;
      // quan trong la KHONG co bucket nao duoc tao.
    }

    expect(scene.dotAccumulators.size).toBe(0)
  })

  it('bucket cá»§a target cháº¿t bá»‹ xÃ³a, khÃ´ng flush text má»“ cÃ´i', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    scene.onDamageNumber(EFFECT_EVENT({}))

    // Mo phong purge khi chet (cung logic onDeath dung).
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

  it('battle_end dá»n TOÃ€N Bá»˜ accumulator â€” bucket cÅ© khÃ´ng rÃ² sang tráº­n káº¿', () => {
    const { scene, addSprite } = createScene()

    addSprite('enemy_1')
    addSprite('enemy_2')

    scene.onDamageNumber(EFFECT_EVENT({}))
    scene.onDamageNumber(EFFECT_EVENT({ targetId: 'enemy_2' }))

    expect(scene.dotAccumulators.size).toBeGreaterThan(0)

    // renderMode 'flat' -> prepareThanhVanBackdropForNextBattle no-op,
    // onBattleEnd chay an toan vOi stub toi thieu.
    scene.renderMode = 'flat'
    scene.inBattle = true

    scene.onBattleEnd()

    expect(scene.dotAccumulators.size).toBe(0)
    expect(scene.inBattle).toBe(false)
  })

  it('format sá»‘ nhá»: 0<x<1 hiá»‡n 1 chá»¯ sá»‘ tháº­p phÃ¢n, sÃ n 0.1 â€” KHÃ”NG bao giá» -0.0', () => {
    expect(formatDotDamageText(0.4)).toBe('-0.4')
    expect(formatDotDamageText(0.04)).toBe('-0.1')

    // Ky vong SAI cu (da sua): 0.04 tung bI ky vong thanh '-0.0'.
    expect(formatDotDamageText(0.04)).not.toBe('-0.0')
    expect(formatDotDamageText(-0)).not.toContain('-0.0')

    expect(formatDotDamageText(1.4)).toBe('-1')
    expect(formatDotDamageText(7.5)).toBe('-8')
  })
})
