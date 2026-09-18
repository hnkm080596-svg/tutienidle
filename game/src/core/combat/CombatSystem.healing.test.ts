import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import type { ActiveCapabilityGrant } from '../battle/contracts/capability'
import type { BuffDefinitionId, BuffInstanceId, CombatEntityId } from '../battle/contracts/ids'

// stat-system-reimagined Task 4 (D18 / INV-13) — healingEffectivenessPercent:
// receiver-side amplification of HP restores that are NOT damage-derived
// (hpRegenPerTurn ticks, direct heal effects, authored dotRecovery triggers
// like Doc Can). leechPercent stays the SOLE leech lever — its output is
// hpDamage * leechPercent, bitwise unchanged. Ward/MP regen and shield
// absorb are never scaled either.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

let grantSeq = 0

/** Doc Can-shaped authored trigger grant: heal the DoT source for a
    fraction of the wood damage actually dealt, per stack (stacks live
    on the grant — the buff2 capability descriptor). */
function dotRecoveryGrant(holder: CombatEntity, stacks: number): ActiveCapabilityGrant {
  grantSeq += 1
  return {
    instanceId: `buff.test.recovery.${grantSeq}` as BuffInstanceId,
    definitionId: 'qa_dot_recovery' as BuffDefinitionId,
    capability: {
      id: 'qa_dot_recovery.recovery',
      type: 'dot_recovery',
      payload: { element: 'wood', healPercent: 0.25 },
    },
    sourceId: holder.id as CombatEntityId,
    targetId: holder.id as CombatEntityId,
    stacks,
  }
}

describe('healingEffectivenessPercent (INV-13)', () => {
  it('amplifies the hpRegenPerTurn leg of turn regen; mp/ward legs stay bitwise', () => {
    const combat = new CombatSystem(new EventBus())
    const stats = createBaseStats({ maxMp: 100, wardMax: 100 })
    const entity = createCombatant({
      stats,
      baseStats: stats,
      currentHp: 500,
      maxHp: 1000,
      currentMp: 0,
      currentWard: 0,
    })

    entity.stats.healingEffectivenessPercent = 0.5

    const applied = combat.applyTurnRegen(entity, { hp: 10, mp: 10, ward: 10 }, entity.id)

    expect(applied.hp).toBeCloseTo(15, 5)
    expect(applied.mp).toBe(10)
    expect(applied.ward).toBe(10)
  })

  it('amplifies direct heals (reason healing) by the receiver stat', () => {
    const combat = new CombatSystem(new EventBus())
    const entity = createCombatant({ currentHp: 100, maxHp: 10_000 })

    entity.stats.healingEffectivenessPercent = 0.5

    expect(combat.applyHealing(entity, 100, 'src', 'healing')).toBeCloseTo(150, 5)
  })

  it('never amplifies leech — leechPercent output stays bitwise identical', () => {
    const combat = new CombatSystem(new EventBus())
    const entity = createCombatant({ currentHp: 100, maxHp: 10_000 })

    entity.stats.healingEffectivenessPercent = 0.5

    expect(combat.applyHealing(entity, 100, entity.id, 'leech')).toBe(100)
  })

  it('dotRecovery trigger: wood DoT tick heals the living source, scaled by heal effectiveness', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const sourceStats = createBaseStats({ woodPower: 10 })
    const source = createCombatant({
      id: 'source',
      type: 'player',
      baseStats: sourceStats,
      stats: sourceStats,
      currentHp: 500,
      maxHp: 1000,
    })
    source.stats.healingEffectivenessPercent = 0.5

    const targetStats = createBaseStats()
    const target = createCombatant({
      id: 'target',
      baseStats: targetStats,
      stats: targetStats,
      currentHp: 10_000,
      maxHp: 10_000,
    })

    combat.applyDotDamage({
      sourceId: source.id,
      source,
      sourceGrants: [dotRecoveryGrant(source, 1)],
      target,
      rawDamage: 20,
      element: 'wood',
      effectId: 'qa_wood_dot',
    })

    // Recovery 0.25 * 20 = 5, amplified 1.5x -> 7.5.
    expect(target.currentHp).toBeCloseTo(10_000 - 20, 5)
    expect(source.currentHp).toBeCloseTo(507.5, 5)
  })

  it('dotRecovery trigger without the stat heals the unamplified amount', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const sourceStats = createBaseStats({ woodPower: 10 })
    const source = createCombatant({
      id: 'source',
      type: 'player',
      baseStats: sourceStats,
      stats: sourceStats,
      currentHp: 500,
      maxHp: 1000,
    })

    const target = createCombatant({ id: 'target', currentHp: 10_000, maxHp: 10_000 })

    combat.applyDotDamage({
      sourceId: source.id,
      source,
      sourceGrants: [dotRecoveryGrant(source, 2)],
      target,
      rawDamage: 20,
      element: 'wood',
      effectId: 'qa_wood_dot',
    })

    // 2 stacks x 0.25 = 0.5 recovery -> 20 * 0.5 = 10 healed, no amp.
    expect(source.currentHp).toBeCloseTo(510, 5)
  })

  it('dotRecovery scales on actual HP lost — an overkill tick cannot recover more than the target had', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player', currentHp: 100, maxHp: 1000 })
    const target = createCombatant({ id: 'target', currentHp: 5, maxHp: 10_000 })

    combat.applyDotDamage({
      sourceId: source.id,
      source,
      sourceGrants: [dotRecoveryGrant(source, 1)],
      target,
      rawDamage: 100,
      element: 'wood',
      effectId: 'qa_wood_dot',
    })

    expect(target.currentHp).toBe(0)
    // 0.25 x 5 actual HP lost = 1.25 — not 0.25 x 100 post-resist.
    expect(source.currentHp).toBeCloseTo(101.25, 5)
  })

  it("'heal' event reports the actual HP gained post-clamp, not the attempted amount", () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const heals: Array<{ value: number }> = []
    eventBus.on('heal', (e) => heals.push(e as (typeof heals)[number]))

    const entity = createCombatant({ currentHp: 99, maxHp: 100 })

    combat.applyHealing(entity, 100, 'src', 'healing')

    expect(heals).toHaveLength(1)
    expect(heals[0]?.value).toBe(1)
  })

  it('non-matching element DoT does not feed a wood-scoped recovery trigger', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({ id: 'source', type: 'player', currentHp: 500, maxHp: 1000 })
    const target = createCombatant({ id: 'target', currentHp: 10_000, maxHp: 10_000 })

    combat.applyDotDamage({
      sourceId: source.id,
      source,
      sourceGrants: [dotRecoveryGrant(source, 3)],
      target,
      rawDamage: 20,
      element: 'fire',
      effectId: 'qa_fire_dot',
    })

    expect(source.currentHp).toBe(500)
  })

  it('missing source grants or dead source produces no recovery', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({ id: 'source', type: 'player', currentHp: 500, maxHp: 1000 })
    const deadSource = createCombatant({ id: 'dead', type: 'player', currentHp: 0, maxHp: 1000, alive: false })
    const target = createCombatant({ id: 'target', currentHp: 10_000, maxHp: 10_000 })

    combat.applyDotDamage({
      sourceId: source.id,
      source,
      target,
      rawDamage: 20,
      element: 'wood',
      effectId: 'qa_wood_dot',
    })

    combat.applyDotDamage({
      sourceId: deadSource.id,
      source: deadSource,
      sourceGrants: [dotRecoveryGrant(deadSource, 1)],
      target,
      rawDamage: 20,
      element: 'wood',
      effectId: 'qa_wood_dot',
    })

    expect(source.currentHp).toBe(500)
    expect(deadSource.currentHp).toBe(0)
  })
})
