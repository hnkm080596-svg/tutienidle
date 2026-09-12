// @vitest-environment jsdom
// Spec v3 D3/D8 (2026-09-11): the tinh_anh tag must reproduce the retired
// createEliteVariant's STAT/FLAG/NAME output exactly - locked here as
// literal values (the legacy function was deleted in Task 4). Rewards are
// NOT asserted - v1 tags keep authored rewards untouched.
// Priority order is locked here for FUTURE tags (spec B3) even though
// the v1 registry holds a single tag.
import { describe, expect, it } from 'vitest'
import { applyEnemyTags, type EnemyTagRegistry } from './EnemyTag'
import { ENEMY_TAGS } from '../../data/enemy/EnemyTags'
import { defineEnemy } from './Enemy'
import { applyEliteMultiplier } from './EnemyStatInput'

const BASE = defineEnemy({
  id: 'tag_test_beast',
  name: 'Nham Trư',
  level: 3,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 440,
    attack: 38,
    attackSpeed: 1.6,
    attackRangeRanks: 1,
    criticalRate: 0.08,
    criticalDamage: 2,
    armor: 21,
    resistances: { fire: 12 },
    elemental: { element: 'fire', power: 10 },
  },
  rewards: { techniqueInsight: 40, spiritStone: 12 },
})

describe('applyEnemyTags (D3)', () => {
  it('tinh_anh output matches the retired createEliteVariant on stats/flag/name (characterization)', () => {
    const viaTag = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)

    // Locked values of the retired createEliteVariant(BASE):
    expect(viaTag.stats).toEqual(applyEliteMultiplier(BASE.stats))
    expect(viaTag.isElite).toBe(true)
    expect(viaTag.name).toBe('Tinh Anh ' + BASE.name)
    // currentHp/maxHp follow the final stats, like the legacy variants.
    expect(viaTag.currentHp).toBe(viaTag.stats.maxHp)
    expect(viaTag.maxHp).toBe(viaTag.stats.maxHp)
  })

  it('rewards are NOT modified by tags in v1 (D8 - authored rewards stay)', () => {
    const viaTag = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)

    expect(viaTag.rewards).toBe(BASE.rewards)
  })

  it('tinh_anh multiplies HP by the referenced elite formula (2.5)', () => {
    const viaTag = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)

    expect(viaTag.stats.maxHp).toBeCloseTo(BASE.stats.maxHp * 2.5)
  })

  it('dedupes repeated tags - each tag applies exactly once', () => {
    const once = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    const twice = applyEnemyTags(BASE, ['tinh_anh', 'tinh_anh'], ENEMY_TAGS)

    expect(twice.stats.maxHp).toBe(once.stats.maxHp)
    expect(twice.name).toBe(once.name)
  })

  it('higher priority applies first in the fold; later-applied prefix ends up outermost (B3)', () => {
    // Throwaway registry proves the priority sort contract for future
    // tags (B3): sort DESC by priority, then fold. The observable of fold
    // order is prefix nesting - the tag applied LAST wraps outermost.
    // (Stat multiplication is commutative, so only names show the order.)
    const reg: EnemyTagRegistry = new Map([
      ['low', { id: 'low', priority: 1, namePrefix: 'Thấp ' }],
      ['high', { id: 'high', priority: 9, namePrefix: 'Cao ' }],
    ])
    const out = applyEnemyTags(BASE, ['low', 'high'], reg)

    // 'high' sorted first and applied first -> its prefix sits innermost.
    expect(out.name).toBe('Thấp Cao ' + BASE.name)
  })

  it('unknown tag id is ignored safely (no throw, no change)', () => {
    const untouched = applyEnemyTags(BASE, ['khong_ton_tai'], ENEMY_TAGS)

    expect(untouched.stats).toEqual(BASE.stats)
    expect(untouched.name).toBe(BASE.name)
  })

  it('base enemy is never mutated (pure function)', () => {
    applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)

    expect(BASE.name).toBe('Nham Trư')
    expect(BASE.stats.maxHp).toBe(440)
    expect(BASE.isElite).toBeUndefined()
  })
})
