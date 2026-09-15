import { describe, expect, it } from 'vitest'
import { BuffSystem } from './BuffSystem'
import { BuffPool } from './BuffPool'
import type { BuffDefinition } from './BuffTypes'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

// The Tu Reimagined (plan v2.4 review P0) — "3 holder-turns" is skill
// semantics, not an ailment base. durationPolicy:'fixed_holder_turns'
// skips BOTH the target's ailmentResistPercent multiplier and the
// source's ailmentDurationPercent multiplier; default/omitted keeps the
// legacy ailment_scaled formula.

function makeEntity(id: string, statOverrides: Partial<ReturnType<typeof createBaseStats>> = {}): CombatEntity {
  const stats = createBaseStats(statOverrides)

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 0,
    alive: true,
  } as CombatEntity
}

const FIXED_DEF: BuffDefinition = {
  id: 'fixed_holder_buff',
  name: 'Fixed',
  polarity: 'buff',
  duration: 3,
  stackMode: 'refresh',
  durationPolicy: 'fixed_holder_turns',
  effects: [],
}

const SCALED_DEF: BuffDefinition = {
  id: 'scaled_buff',
  name: 'Scaled',
  polarity: 'debuff',
  duration: 3,
  stackMode: 'refresh',
  effects: [],
}

describe('BuffSystem durationPolicy', () => {
  it('fixed_holder_turns ignores target ailmentResistPercent and source ailmentDurationPercent', () => {
    const pool = new BuffPool()
    const source = makeEntity('source', { ailmentDurationPercent: 1.0 })
    const target = makeEntity('target', { ailmentResistPercent: 0.75 })

    new BuffSystem(pool).apply(FIXED_DEF, source, target)

    expect(pool.getAll()[0]?.remainingTurns).toBe(3)
  })

  it('ailment_scaled (default) still applies both multipliers', () => {
    const pool = new BuffPool()
    const source = makeEntity('source', { ailmentDurationPercent: 1.0 })
    const target = makeEntity('target', { ailmentResistPercent: 0.5 })

    new BuffSystem(pool).apply(SCALED_DEF, source, target)

    // 3 * (1 - 0.5) * (1 + 1.0) = 3
    expect(pool.getAll()[0]?.remainingTurns).toBeCloseTo(3)
  })

  it('durationOverride composes with fixed_holder_turns (node +1 -> exactly 4)', () => {
    const pool = new BuffPool()
    const source = makeEntity('source', { ailmentDurationPercent: 0.5 })
    const target = makeEntity('target', { ailmentResistPercent: 0.75 })

    new BuffSystem(pool).apply(FIXED_DEF, source, target, undefined, 4)

    expect(pool.getAll()[0]?.remainingTurns).toBe(4)
  })

  it('uniquePerTarget replaces instances from EVERY source (newest wins)', () => {
    const pool = new BuffPool()
    const sourceA = makeEntity('source_a')
    const sourceB = makeEntity('source_b')
    const target = makeEntity('target')
    const uniqueDef: BuffDefinition = { ...SCALED_DEF, uniquePerTarget: true }

    const system = new BuffSystem(pool)
    system.apply(uniqueDef, sourceA, target)
    system.apply(uniqueDef, sourceB, target)

    const instances = pool.getAllById(uniqueDef.id)
    expect(instances).toHaveLength(1)
    expect(instances[0]?.sourceId).toBe('source_b')
  })

  it('without uniquePerTarget, two sources keep separate instances (default unchanged)', () => {
    const pool = new BuffPool()
    const sourceA = makeEntity('source_a')
    const sourceB = makeEntity('source_b')
    const target = makeEntity('target')

    const system = new BuffSystem(pool)
    system.apply(SCALED_DEF, sourceA, target)
    system.apply(SCALED_DEF, sourceB, target)

    expect(pool.getAllById(SCALED_DEF.id)).toHaveLength(2)
  })
})
