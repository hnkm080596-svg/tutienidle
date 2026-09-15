import { describe, expect, it } from 'vitest'
import { recomputeEffectiveStats } from './TurnStatsRecompute'
import { calculateStats } from '../../stats/StatCalculator'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'

// R2 (AR-02) — recomputeEffectiveStats now treats its first argument as an
// ALREADY-RESOLVED base (attribute derivation happened exactly once when
// the entity was built). Fixture mirrors the audit probe: raw might 10 +
// strength 100 resolves to might 70; an in-battle +50% might buff must
// fold onto 70 (=105), not re-derive strength (+60) first (=130).

function qaEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, criticalRate: 0, blockChance: 0, ...overrides.stats })
  const { stats: _drop, ...rest } = overrides
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,

    currentMomentum: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...rest,
  } as CombatEntity
}

class FixtureBuffRegistry implements BuffDefinitionCatalog {
  private readonly definitions = new Map<string, BuffDefinition>()
  constructor(definitions: BuffDefinition[]) {
    for (const d of definitions) this.definitions.set(d.id, d)
  }
  get(id: string): BuffDefinition {
    const d = this.definitions.get(id)
    if (!d) throw new Error(`fixture buff not found: ${id}`)
    return d
  }
}

const ATTACK_UP_DEFINITION: BuffDefinition = {
  id: 'fixture_attack_up',
  name: 'Fixture Attack Up',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'might', flat: 50 }],
}

function makePoolWithAttackBuff(percent: number, stacks: number): BuffPool {
  const pool = new BuffPool()
  const definition: BuffDefinition = {
    id: 'qa_atk_buff',
    name: 'QA Attack Buff',
    polarity: 'buff',
    duration: 5,
    maxStacks: 5,
    stackMode: 'stack',
    effects: [{ type: 'statModifier', stat: 'might', percent }],
  }
  const registry: BuffDefinitionCatalog = {
    get: (id: string): BuffDefinition => {
      if (id === definition.id) {
        return definition
      }
      throw new Error(`unknown fixture buff id: ${id}`)
    },
  }
  // Minimal entity stub: statModifier folding never reads entity fields,
  // but BuffSystem.apply requires real CombatEntity-shaped args.
  const entity = {
    id: 'src',
    stats: { ailmentResistPercent: 0, ailmentDurationPercent: 0 },
  } as unknown as CombatEntity

  const system = new BuffSystem(pool)

  for (let i = 0; i < stacks; i++) {
    system.apply(definition, entity, entity, registry)
  }

  return pool
}

describe('recomputeEffectiveStats (R2 effective boundary)', () => {
  it('folds buff modifiers onto the RESOLVED base without re-deriving attributes', () => {
    const raw = createBaseStats({ strength: 100, might: 10 })
    const resolved = calculateStats(raw, [])
    expect(resolved.might).toBe(70)

    // 2 stacks × +50% increased pool → 70 × (1 + 0.5 + 0.5) = 140.
    const effective = recomputeEffectiveStats(resolved, makePoolWithAttackBuff(0.5, 2))
    expect(effective.might).toBe(140)
  })

  it('no buffs: effective equals resolved base exactly', () => {
    const raw = createBaseStats({ strength: 100, might: 10 })
    const resolved = calculateStats(raw, [])

    expect(recomputeEffectiveStats(resolved, new BuffPool())).toEqual(resolved)
  })
})

describe('recomputeEffectiveStats', () => {
  it('folds active statModifier buff effects into the resolved base via the effective pipeline', () => {
    // R2: the input is a RESOLVED base — attribute derivation must NOT
    // run again, so the old strength-derivation expectations (+0.6) are
    // gone. Resolved might 100 + flat buff 50 = 150 exactly.
    const base = createBaseStats({ might: 100 })
    const pool = new BuffPool()
    const registry = new FixtureBuffRegistry([ATTACK_UP_DEFINITION])
    const source = qaEntity({ id: 'src' })
    const target = qaEntity({ id: 'tgt' })

    new BuffSystem(pool).apply(ATTACK_UP_DEFINITION, source, target, registry)

    const effective = recomputeEffectiveStats(base, pool)

    expect(effective.might).toBeCloseTo(150, 5)
  })

  it('returns resolved base unchanged when no statModifier buffs are active', () => {
    // R2: no re-derivation — the resolved snapshot comes back untouched.
    const base = createBaseStats({ might: 100 })
    const pool = new BuffPool()

    const effective = recomputeEffectiveStats(base, pool)

    expect(effective.might).toBeCloseTo(100, 5)
  })

  it('percent statModifier folds multiplicatively with the resolved base', () => {
    // R2: (100 resolved) × (1 + 0.5) = 150 — attribute derivation no
    // longer inflates the base before the percent fold.
    const base = createBaseStats({ might: 100 })
    const percentDef: BuffDefinition = {
      id: 'fixture_attack_percent', name: 'Pct', polarity: 'buff', duration: 3, stackMode: 'refresh',
      effects: [{ type: 'statModifier', stat: 'might', percent: 0.5 }],
    }
    const pool = new BuffPool()
    const registry = new FixtureBuffRegistry([percentDef])

    new BuffSystem(pool).apply(percentDef, qaEntity({ id: 's' }), qaEntity({ id: 't' }), registry)

    const effective = recomputeEffectiveStats(base, pool)

    expect(effective.might).toBeCloseTo(150, 5)
  })
})
