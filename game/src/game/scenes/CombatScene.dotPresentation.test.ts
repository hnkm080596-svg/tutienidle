// @vitest-environment jsdom
//
// DoT presentation (combat-skill-flow-element-power-dot-plan.md Â§7) â€”
// bá»™ gom damage text 3 láº§n/giÃ¢y: nhiá»u fixed tick trong cá»­a sá»•
// 333,33ms chá»‰ sinh Má»˜T text/khÃ³a; tá»•ng hiá»ƒn thá»‹ báº±ng tá»•ng event Ä‘Ã£
// gom; direct hit KHÃ”NG Ä‘i qua accumulator; dá»n khi target cháº¿t.
import { describe, expect, it } from 'vitest'
import { formatDotDamageText } from './CombatScene'
import { createTestScene } from './combat/combatTestHarness'

function createScene() {
  const scene = createTestScene('bare')

  scene.time = { now: 0 }
  scene.dotAccumulators = new Map()

  // Sprite registry tá»‘i thiá»ƒu cho spriteFor().
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

    // 5 tick trong cÃ¹ng cá»­a sá»• Ä‘áº§u tiÃªn (má»—i tick 50ms < 333ms).
    for (let i = 0; i < 5; i++) {
      scene.time.now = i * 50

      scene.onDamageNumber(EFFECT_EVENT({}))
    }

    expect(shown).toHaveLength(0)

    // QuÃ¡ cá»­a sá»• â€” frame káº¿ flush Ä‘Ãºng 1 text.
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

    // onDamageNumber vá»›i event khÃ´ng effectId pháº£i ráº½ nhÃ¡nh direct path â€”
    // direct path gá»i showDamageNumber (khÃ´ng stub á»Ÿ Ä‘Ã¢y) nÃªn chá»‰ cáº§n
    // cháº¯c cháº¯n accumulator TRá»NG lÃ  Ä‘á»§ cho há»£p Ä‘á»“ng accumulator.
    try {
      scene.onDamageNumber({ type: 'damage', targetId: 'enemy_1', value: 10 })
    } catch {
      // showDamageNumber tháº­t cáº§n Phaser objects â€” jsdom khÃ´ng cÃ³;
      // quan trá»ng lÃ  KHÃ”NG cÃ³ bucket nÃ o Ä‘Æ°á»£c táº¡o.
    }

    expect(scene.dotAccumulators.size).toBe(0)
  })

  it('bucket cá»§a target cháº¿t bá»‹ xÃ³a, khÃ´ng flush text má»“ cÃ´i', () => {
    const { scene, shown, addSprite } = createScene()

    addSprite('enemy_1')

    scene.onDamageNumber(EFFECT_EVENT({}))

    // MÃ´ phá»ng purge khi cháº¿t (cÃ¹ng logic onDeath dÃ¹ng).
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

    // renderMode 'flat' â†’ prepareThanhVanBackdropForNextBattle no-op,
    // onBattleEnd cháº¡y an toÃ n vá»›i stub tá»‘i thiá»ƒu.
    scene.renderMode = 'flat'
    scene.inBattle = true

    scene.onBattleEnd()

    expect(scene.dotAccumulators.size).toBe(0)
    expect(scene.inBattle).toBe(false)
  })

  it('format sá»‘ nhá»: 0<x<1 hiá»‡n 1 chá»¯ sá»‘ tháº­p phÃ¢n, sÃ n 0.1 â€” KHÃ”NG bao giá» -0.0', () => {
    expect(formatDotDamageText(0.4)).toBe('-0.4')
    expect(formatDotDamageText(0.04)).toBe('-0.1')

    // Ká»³ vá»ng SAI cÅ© (Ä‘Ã£ sá»­a): 0.04 tá»«ng bá»‹ ká»³ vá»ng thÃ nh '-0.0'.
    expect(formatDotDamageText(0.04)).not.toBe('-0.0')
    expect(formatDotDamageText(-0)).not.toContain('-0.0')

    expect(formatDotDamageText(1.4)).toBe('-1')
    expect(formatDotDamageText(7.5)).toBe('-8')
  })
})
