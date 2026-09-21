import { describe, expect, it } from 'vitest'
import {
  applyBossMultiplier,
  applyEliteMultiplier,
  normalizeEnemyAttackSpeed,
  normalizeEnemyStats,
} from './EnemyStatInput'
import { defineEnemy } from './Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { EnemyDefinition } from './Enemy'
import type { EnemyStatInput } from './EnemyStatInput'

function baseEnemyStats() {
  return normalizeEnemyStats({
    maxHp: 100,
    might: 20,
    attackSpeed: 5,
    criticalRate: 0.05,
    criticalDamage: 1.5,
    armor: 10,
    elemental: { element: 'fire', power: 8 },
  })
}

describe('enemy combat stat normalization', () => {
  it('quy đổi tốc đánh legacy và giữ dữ liệu authored theo thang mới', () => {
    expect(normalizeEnemyAttackSpeed(3)).toBeCloseTo(1.2)
    expect(normalizeEnemyAttackSpeed(5)).toBe(2)
    expect(normalizeEnemyAttackSpeed(7)).toBe(2.5)
    expect(normalizeEnemyAttackSpeed(1.5)).toBe(1.5)
    expect(normalizeEnemyAttackSpeed(0.2)).toBe(0.8)
  })

  // stat-system-reimagined Task 3 (D16/D17) -- attackRange is retired:
  // reach is a skill/action-targeting concern, not a character stat.
  // EnemyStatInput no longer declares a range-rank field; a stale
  // authored field is ignored by normalization, and neither the
  // normalized enemy Stats nor the player createBaseStats() record
  // carries attackRange.
  it('stale range-rank authored input is ignored -- output has no attackRange key', () => {
    const legacyAuthored = {
      maxHp: 100,
      might: 20,
      attackSpeed: 1,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    }

    const stats = normalizeEnemyStats(legacyAuthored)

    expect('attackRange' in stats).toBe(false)
  })

  it('createBaseStats() output has no attackRange key', () => {
    expect('attackRange' in createBaseStats()).toBe(false)
  })

  it('Elite ưu tiên độ bền hơn burst damage', () => {
    const elite = applyEliteMultiplier(baseEnemyStats())

    expect(elite.maxHp).toBe(250)
    expect(elite.might).toBe(27)
    expect(elite.defense).toBeCloseTo(11.5)
    expect(elite.accuracyRating).toBeCloseTo(88)
  })

  it('Boss có profile công thủ riêng và kháng hành chủ đạo', () => {
    const boss = applyBossMultiplier(baseEnemyStats())

    expect(boss.maxHp).toBe(700)
    expect(boss.might).toBe(40)
    expect(boss.defense).toBe(12)
    expect(boss.accuracyRating).toBeCloseTo(92)
    expect(boss.criticalAvoidance).toBe(0.15)
    expect(boss.fireResistance).toBe(15)
    expect(boss.woodResistance).toBe(0)
  })
})

// stat-system-reimagined Task 10 (D9/D21, INV-8/INV-14) -- the enemy
// input gate. EnemyStatInput is a BASE-value channel: a Phap Tu boss
// authors the MP trio through declared `special` slots, but gated stats
// may not arrive through any other channel (modifier arrays, undeclared
// keys), reactionEffectPercent is invalid enemy input outright, and no
// reaction-tagged skill/buff id may hang off an enemy definition.
describe('enemy input gate (D9/D21)', () => {
  const baseInput = {
    maxHp: 100,
    might: 10,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
  }

  function minimalDefinition(overrides: Partial<EnemyDefinition> = {}): EnemyDefinition {
    return {
      id: 'fixture_gate',
      name: 'Fixture Gate',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: { ...baseInput },
      rewards: { techniqueMastery: 1, spiritStone: 1 },
      ...overrides,
    }
  }

  it('accepts a Phap Tu boss authoring the MP trio as base values', () => {
    const stats = normalizeEnemyStats({
      ...baseInput,
      special: { maxMp: 80, manaShieldPercent: 0.4, manaRegenPerTurn: 3 },
    })

    expect(stats.maxMp).toBe(80)
    expect(stats.manaShieldPercent).toBe(0.4)
    expect(stats.manaRegenPerTurn).toBe(3)
  })

  it('rejects authored reactionEffectPercent inside special', () => {
    const smuggled = { ...baseInput, special: { reactionEffectPercent: 0.5 } }

    expect(() => normalizeEnemyStats(smuggled as unknown as EnemyStatInput)).toThrow(
      /reactionEffectPercent/,
    )
  })

  it('rejects authored reactionEffectPercent at top level', () => {
    const smuggled = { ...baseInput, reactionEffectPercent: 0.5 }

    expect(() => normalizeEnemyStats(smuggled)).toThrow(/reactionEffectPercent/)
  })

  it('rejects a gated meta stat smuggled onto special', () => {
    const smuggled = { ...baseInput, special: { productionSpeedMultiplier: 2 } }

    expect(() => normalizeEnemyStats(smuggled as unknown as EnemyStatInput)).toThrow(
      /productionSpeedMultiplier/,
    )
  })

  it('rejects a smuggled modifiers channel targeting a gated stat', () => {
    const smuggled = {
      ...baseInput,
      modifiers: [{ id: 'm1', stat: 'maxMp', flat: 50, sourceType: 'buff', sourceId: 'x' }],
    }

    expect(() => normalizeEnemyStats(smuggled)).toThrow(/modifier/i)
  })

  it('rejects any smuggled modifiers channel -- enemies have none', () => {
    const smuggled = {
      ...baseInput,
      modifiers: [{ id: 'm1', stat: 'might', flat: 5, sourceType: 'buff', sourceId: 'x' }],
    }

    expect(() => normalizeEnemyStats(smuggled)).toThrow(/modifier/i)
  })

  it('rejects a reaction-tagged bossTrigger buff id', () => {
    expect(() =>
      defineEnemy(
        minimalDefinition({
          bossTrigger: { afterTurns: 5, buffDefinitionId: 'phap_tu_reaction_surge' },
        }),
      ),
    ).toThrow(/reaction/i)
  })

  it('rejects a reaction-tagged tribulation buff id', () => {
    expect(() =>
      defineEnemy(
        minimalDefinition({
          tribulationPhases: [
            {
              hpThresholdPercent: 0.5,
              buff: {
                id: 'boss_reaction_overload',
                name: 'x',
                kind: 'buff',
                instanceScope: 'per_source',
                stacking: {
                  maxStacks: 1,
                  onReapplyStacks: 'replace',
                  onReapplyDuration: 'refresh',
                  replaceInstanceOnReapply: true,
                },
                lifetime: { clock: 'permanent', scaling: 'fixed' },
                dispellable: false,
              },
            },
          ],
        }),
      ),
    ).toThrow(/reaction/i)
  })

  it('rejects a reaction-tagged enrage buff convertsToId', () => {
    expect(() =>
      defineEnemy(
        minimalDefinition({
          enrage: {
            afterSeconds: 10,
            buff: {
              id: 'boss_enrage',
              name: 'x',
              kind: 'buff',
              instanceScope: 'per_source',
              stacking: {
                maxStacks: 1,
                onReapplyStacks: 'replace',
                onReapplyDuration: 'refresh',
                replaceInstanceOnReapply: true,
              },
              lifetime: { clock: 'permanent', scaling: 'fixed' },
              convertsToId: 'reaction_aftershock',
              dispellable: false,
            },
          },
        }),
      ),
    ).toThrow(/reaction/i)
  })

  it('rejects an embedded buff statModifier on a gated stat', () => {
    expect(() =>
      defineEnemy(
        minimalDefinition({
          enrage: {
            afterSeconds: 10,
            buff: {
              id: 'boss_enrage',
              name: 'x',
              kind: 'buff',
              instanceScope: 'per_source',
              stacking: {
                maxStacks: 1,
                onReapplyStacks: 'replace',
                onReapplyDuration: 'refresh',
                replaceInstanceOnReapply: true,
              },
              lifetime: { clock: 'permanent', scaling: 'fixed' },
              statModifiers: [{ stat: 'maxMp', flat: 50 }],
              dispellable: false,
            },
          },
        }),
      ),
    ).toThrow(/gated|maxMp/i)
  })

  it('accepts an ordinary definition with a universal-stat enrage buff', () => {
    const enemy = defineEnemy(
      minimalDefinition({
        enrage: {
          afterSeconds: 10,
          buff: {
            id: 'boss_enrage_might',
            name: 'x',
            kind: 'buff',
            instanceScope: 'per_source',
            stacking: {
              maxStacks: 1,
              onReapplyStacks: 'replace',
              onReapplyDuration: 'refresh',
              replaceInstanceOnReapply: true,
            },
            lifetime: { clock: 'permanent', scaling: 'fixed' },
            statModifiers: [{ stat: 'might', percent: 0.5 }],
            dispellable: false,
          },
        },
      }),
    )

    expect(enemy.enrage?.buff.id).toBe('boss_enrage_might')
  })
})
