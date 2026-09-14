import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'
import { BUFF_REGISTRY } from '../buff/BuffRegistry'

const FOUNDATION_IDS = [
  'foundation_wood_ape',
  'foundation_stone_fungus',
  'foundation_ferocious_wood_ape',
  'foundation_ferocious_stone_fungus',
  'foundation_lava_hound',
  'foundation_sand_scorpion',
  'foundation_ferocious_lava_hound',
  'foundation_ferocious_sand_scorpion',
  'foundation_rock_tortoise',
  'foundation_mud_golem',
  'foundation_ferocious_rock_tortoise',
  'foundation_ferocious_mud_golem',
  'foundation_metal_beetle_swarm',
  'foundation_blade_hawk_king',
  'foundation_ferocious_metal_beetle_swarm',
  'foundation_ferocious_blade_hawk_king',
  'foundation_mist_shark',
  'foundation_flood_dragon_whelp',
  'foundation_ferocious_mist_shark',
  'foundation_ferocious_flood_dragon_whelp',
]

describe('enemy speed band (turn-based parity rule)', () => {
  // Balance ruling (2026-09-13, B3 fix): attackSpeed is authored on the new
  // 0.8-2.5 attacks/sec scale -> speed = x100. Speed is a high-leverage stat
  // and may only grow a small fraction vs the other stats - the whole roster
  // stays in the parity band around player base 100 (80..130), never x2/x3
  // like the legacy data (authored 3-7 -> speed 120-250).
  it('moi enemy co speed trong band 80-130 (khong vuot ~1.3x player base)', () => {
    for (const enemy of ENEMIES) {
      expect(enemy.stats.speed, `${enemy.id} speed ${enemy.stats.speed}`).toBeGreaterThanOrEqual(80)
      expect(enemy.stats.speed, `${enemy.id} speed ${enemy.stats.speed}`).toBeLessThanOrEqual(130)
    }
  })
})

describe('foundation enemy data', () => {
  it('có đủ 20 enemy foundation (10 loài + 10 Hung)', () => {
    const foundation = ENEMIES.filter((enemy) => enemy.id.startsWith('foundation_'))
    expect(foundation.map((enemy) => enemy.id).sort()).toEqual(FOUNDATION_IDS.slice().sort())
  })

  it('mọi enemy foundation thuộc realm foundation_establishment', () => {
    const foundation = ENEMIES.filter((enemy) => enemy.id.startsWith('foundation_'))
    expect(foundation.every((enemy) => enemy.realmId === 'foundation_establishment')).toBe(true)
  })

  it('enemy foundation có stat hợp lệ (HP/ATK > 0, speed 80-250 (turn-based pacing thang))', () => {
    const foundation = ENEMIES.filter((enemy) => enemy.id.startsWith('foundation_'))
    for (const enemy of foundation) {
      expect(enemy.stats.maxHp).toBeGreaterThan(0)
      expect(enemy.stats.might).toBeGreaterThan(0)
      expect(enemy.stats.speed).toBeGreaterThanOrEqual(80)
      expect(enemy.stats.speed).toBeLessThanOrEqual(250)
    }
  })

  it('enemy foundation tầng cao có stat cao hơn tầng thấp', () => {
    const t1 = ENEMIES.find((enemy) => enemy.id === 'foundation_wood_ape')!
    const t10 = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_mist_shark')!
    expect(t10.stats.maxHp).toBeGreaterThan(t1.stats.maxHp)
    expect(t10.stats.might).toBeGreaterThan(t1.stats.might)
  })
})

describe('foundation_floor_10 boss', () => {
  it('boss tầng 10 có 2 phase + enrage', () => {
    const boss = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_flood_dragon_whelp')!
    expect(boss.tribulationPhases).toHaveLength(2)
    expect(boss.enrage).toBeDefined()
    expect(boss.enrage!.afterSeconds).toBe(60)
  })

  it('phase boss sắp XUỐNG DẦN theo hpThresholdPercent', () => {
    const boss = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_flood_dragon_whelp')!
    const thresholds = boss.tribulationPhases!.map((phase) => phase.hpThresholdPercent)
    expect(thresholds).toEqual([...thresholds].sort((a, b) => b - a))
  })

  it('boss tầng 10 mạnh hơn boss tầng 9', () => {
    const t9 = ENEMIES.find((enemy) => enemy.id === 'foundation_flood_dragon_whelp')!
    const t10 = ENEMIES.find((enemy) => enemy.id === 'foundation_ferocious_flood_dragon_whelp')!
    expect(t10.stats.maxHp).toBeGreaterThan(t9.stats.maxHp)
    expect(t10.stats.might).toBeGreaterThan(t9.stats.might)
  })
})
describe('Phase A2 boss enrage content', () => {
  const bossIds = [
    'mortal_ferocious_giant_crocodile',
    'ferocious_flood_serpent',
    'foundation_ferocious_flood_dragon_whelp',
  ]

  it.each(bossIds)('%s has a bossTrigger with a resolvable buff in BUFF_REGISTRY', (id) => {
    const boss = ENEMIES.find((enemy) => enemy.id === id)
    expect(boss).toBeDefined()
    expect(boss?.bossTrigger).toBeDefined()
    expect(boss?.bossTrigger?.afterTurns).toBe(60)

    expect(() => BUFF_REGISTRY.get(boss!.bossTrigger!.buffDefinitionId)).not.toThrow()
  })

  it('each boss enrage buff is a permanent +might/+speed statModifier', () => {
    for (const id of bossIds) {
      const boss = ENEMIES.find((enemy) => enemy.id === id)
      const definition = BUFF_REGISTRY.get(boss!.bossTrigger!.buffDefinitionId)

      expect(definition.duration).toBe(Infinity)
      expect(definition.effects.some((effect) => effect.type === 'statModifier' && effect.stat === 'might')).toBe(true)
      expect(definition.effects.some((effect) => effect.type === 'statModifier' && effect.stat === 'speed')).toBe(true)
    }
  })
})
