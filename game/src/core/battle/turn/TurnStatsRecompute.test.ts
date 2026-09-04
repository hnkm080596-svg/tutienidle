import { describe, it, expect } from 'vitest'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'

function qaEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats }
  const { stats: _drop, ...rest } = overrides
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...rest,
  } as CombatEntity
}

class FixtureBuffRegistry implements TurnBuffRegistry {
  private readonly definitions = new Map<string, TurnBuffDefinition>()
  constructor(definitions: TurnBuffDefinition[]) {
    for (const d of definitions) this.definitions.set(d.id, d)
  }
  get(id: string): TurnBuffDefinition {
    const d = this.definitions.get(id)
    if (!d) throw new Error(`fixture buff not found: ${id}`)
    return d
  }
}

const ATTACK_UP_DEFINITION: TurnBuffDefinition = {
  id: 'fixture_attack_up',
  name: 'Fixture Attack Up',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'attack', flat: 50 }],
}

describe('recomputeEffectiveStats', () => {
  it('folds active statModifier buff effects into the base stats via the live StatCalculator pipeline', () => {
    const base = { ...createBaseStats(), attack: 100 }
    const pool = new TurnBuffPool()
    const registry = new FixtureBuffRegistry([ATTACK_UP_DEFINITION])
    const source = qaEntity({ id: 'src' })
    const target = qaEntity({ id: 'tgt' })

    new TurnBuffSystem(pool).apply(ATTACK_UP_DEFINITION, source, target, registry)

    const effective = recomputeEffectiveStats(base, pool)

    // calculateStats() pass-2 (deriveAttributeModifiers) c?ng strength×0.6:
    // 100 (base) + 50 (flat buff) + 0.6 (strength 1) = 150.6.
    expect(effective.attack).toBeCloseTo(150.6, 5)
  })

  it('returns base stats unchanged when no statModifier buffs are active', () => {
    const base = { ...createBaseStats(), attack: 100 }
    const pool = new TurnBuffPool()

    const effective = recomputeEffectiveStats(base, pool)

    // Không buff: ch? attribute-derived t? strength 1 (+0.6).
    expect(effective.attack).toBeCloseTo(100.6, 5)
  })

  it('percent statModifier folds multiplicatively with base via the same pipeline as equipment modifiers', () => {
    const base = { ...createBaseStats(), attack: 100 }
    const percentDef: TurnBuffDefinition = {
      id: 'fixture_attack_percent', name: 'Pct', polarity: 'buff', duration: 3, stackMode: 'refresh',
      effects: [{ type: 'statModifier', stat: 'attack', percent: 0.5 }],
    }
    const pool = new TurnBuffPool()
    const registry = new FixtureBuffRegistry([percentDef])

    new TurnBuffSystem(pool).apply(percentDef, qaEntity({ id: 's' }), qaEntity({ id: 't' }), registry)

    const effective = recomputeEffectiveStats(base, pool)

    // percent tang theo dúng pipeline: (100 + 0.6 attr) × (1 + 0.5) = 150.9.
    expect(effective.attack).toBeCloseTo(150.9, 5)
  })
})
