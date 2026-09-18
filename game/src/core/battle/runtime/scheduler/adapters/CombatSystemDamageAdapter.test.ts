// CombatSystemDamageAdapter.test.ts -- M3 damage-authority adapter.
//
// Proves the representative PROFILES route to their intended channels
// (review-locked rule): the profile dispatches, origin is context.
//   'legacy_dot'  -> applyDotDamage (dotResistance / dotRecovery economy)
//   'reaction_*' or origin.kind 'reaction' -> reaction channel
//     (applyReactionDamage: NO hit-layer modifiers, NO dotResistance /
//     dotRecovery, vitals reason 'reaction', canCrit:false by construction)
//   everything else -> standard hit channel (applyModifiedDirectDamage
//     semantics: finalDamagePercent/finalDamageReductionPercent)

import { describe, expect, it } from 'vitest'

import type { CombatEntity } from '../../../../combat/CombatEntity'
import { CombatSystem } from '../../../../combat/CombatSystem'
import type { EntityVitalsChangedEvent } from '../../../../combat/EntityVitalsSystem'
import type { ActiveCapabilityGrant } from '../../../contracts/capability'
import { EventBus } from '../../../../events/EventBus'
import { createBaseStats } from '../../../../stats/StatBlock'
import type { Stats } from '../../../../stats/StatBlock'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatEventPayload } from '../../../contracts/events'
import type { CombatOperationOrigin } from '../../../contracts/origin'
import type { DealDamageOperation } from '../../../contracts/operations'
import type { CombatEntityId } from '../../../contracts/ids'

import { CombatOperationSkip } from '../CombatOperationExecutor'
import { CombatSystemDamageAdapter } from './CombatSystemDamageAdapter'

function makeEntity(
  id: string,
  statOverrides: Partial<Stats> = {},
  overrides: Partial<CombatEntity> = {},
): CombatEntity {
  const stats = createBaseStats(statOverrides)
  return {
    id,
    name: id,
    type: 'enemy',
    stats,
    baseStats: stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: 0,
    realmIndex: 0,
    x: 0,
    row: 0 as never,
    alive: true,
    ...overrides,
  }
}

interface Harness {
  adapter: CombatSystemDamageAdapter
  bus: EventBus
  vitalsEvents: EntityVitalsChangedEvent[]
  emitted: CombatEventPayload[]
  ctx: (origin?: Partial<CombatOperationOrigin>) => CombatAuthorityExecutionContext
  entities: Map<CombatEntityId, CombatEntity>
  rngCalls: () => number
  sourceBuffsCalls: () => number
}

function makeHarness(entities: CombatEntity[]): Harness {
  const bus = new EventBus()
  const combat = new CombatSystem(bus)
  let rolls = 0
  combat.setRandomSource(() => {
    rolls += 1
    return 0
  })

  const vitalsEvents: EntityVitalsChangedEvent[] = []
  bus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (e) => vitalsEvents.push(e))

  const map = new Map<CombatEntityId, CombatEntity>(entities.map((e) => [e.id, e]))

  let buffsCalls = 0
  // Deliberately feeds a recovery trigger if a channel consumes it: the
  // reaction/hit channels must never read this.
  const recoveryGrant: ActiveCapabilityGrant = {
    instanceId: 'inst.recovery',
    definitionId: 'doc_the',
    capability: { id: 'test.dot_recovery', type: 'dot_recovery', payload: { healPercent: 1 } },
    sourceId: 'source',
    targetId: 'source',
    stacks: 1,
  }
  const resolveSourceGrants = (): readonly ActiveCapabilityGrant[] => {
    buffsCalls += 1
    return [recoveryGrant]
  }

  const adapter = new CombatSystemDamageAdapter(combat, (id) => map.get(id), {
    resolveSourceGrants,
  })

  const emitted: CombatEventPayload[] = []
  const ctx = (origin: Partial<CombatOperationOrigin> = {}): CombatAuthorityExecutionContext => ({
    operationId: 'op.test',
    origin: {
      kind: 'skill',
      originId: 'test.origin',
      sourceId: 'source',
      rootActionId: 'root.test',
      ...origin,
    },
    events: { emit: (e) => emitted.push(e) },
    combatSequence: 0,
  })

  return {
    adapter,
    bus,
    vitalsEvents,
    emitted,
    ctx,
    entities: map,
    rngCalls: () => rolls,
    sourceBuffsCalls: () => buffsCalls,
  }
}

function payload(overrides: Partial<DealDamageOperation['payload']> = {}): DealDamageOperation['payload'] {
  return {
    targetId: 'target',
    damageProfile: 'standard_hit',
    coefficient: 100,
    hitCount: 1,
    canCrit: false,
    canMiss: false,
    ...overrides,
  }
}

describe('CombatSystemDamageAdapter -- reaction channel', () => {
  it("routes damageProfile 'reaction_*' to the reaction channel: no dotResistance, no dotRecovery, reason 'reaction', no crit roll", () => {
    // dotResistancePercent 0.75 would leave only 25 HP damage if this
    // tick routed through the DoT economy; dotRecovery on the source
    // would heal it. Neither may fire on the reaction channel.
    const source = makeEntity('source', {}, { currentHp: 10 })
    const target = makeEntity('target', { maxHp: 500, dotResistancePercent: 0.75 }, { currentHp: 500 })
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'reaction_khac_che', coefficient: 100, element: 'fire', canCrit: false }),
      h.ctx({ kind: 'reaction', reactionId: 'khac_che' }),
    )

    expect(result).toEqual({ rawDamage: 100, hpDamage: 100, killed: false })
    expect(target.currentHp).toBe(400)
    expect(h.vitalsEvents.map((e) => e.reason)).toEqual(['reaction'])
    // No dotRecovery: the source's pool is never consulted.
    expect(h.sourceBuffsCalls()).toBe(0)
    expect(source.currentHp).toBe(10)
    // canCrit:false honored by construction -- the channel consumes no
    // rolls at all (no crit/miss roll exists on the direct path).
    expect(h.rngCalls()).toBe(0)
  })

  it("routes origin.kind 'reaction' to the reaction channel even when the profile is not reaction_* (origin is context)", () => {
    const source = makeEntity('source')
    const target = makeEntity('target', { maxHp: 500, dotResistancePercent: 0.75 }, { currentHp: 500 })
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'burst_flat', coefficient: 80 }),
      h.ctx({ kind: 'reaction' }),
    )

    expect(result.hpDamage).toBe(80)
    expect(h.vitalsEvents.map((e) => e.reason)).toEqual(['reaction'])
  })

  it('reports killed when the reaction burst drops the target to 0', () => {
    const source = makeEntity('source')
    const target = makeEntity('target', { maxHp: 50 }, { currentHp: 50 })
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'reaction_khac_che', coefficient: 999 }),
      h.ctx({ kind: 'reaction' }),
    )

    expect(result).toEqual({ rawDamage: 999, hpDamage: 50, killed: true })
    expect(target.alive).toBe(false)
  })
})

describe('CombatSystemDamageAdapter -- legacy_dot channel', () => {
  it("routes 'legacy_dot' to applyDotDamage: dotResistance mitigation, reason 'dot', effectId from periodicId", () => {
    const source = makeEntity('source')
    const target = makeEntity(
      'target',
      { maxHp: 500, defense: 0, dotResistancePercent: 0.5 },
      { currentHp: 500 },
    )
    const h = makeHarness([source, target])

    const damageEvents: { effectId?: string }[] = []
    h.bus.on<{ effectId?: string }>('damage', (e) => damageEvents.push(e))

    const result = h.adapter.dealDamage(
      // coefficient is an intent-level ratio: might 10 x 20 = 200 raw.
      payload({ damageProfile: 'legacy_dot', coefficient: 20, periodicId: 'poison.tick' }),
      h.ctx({ kind: 'buff_periodic' }),
    )

    expect(result).toEqual({ rawDamage: 200, hpDamage: 100, killed: false })
    expect(target.currentHp).toBe(400)
    // Target-side vitals reason is 'dot'; the source-side 'healing' event
    // is the authored dotRecovery trigger doing its job on this channel.
    expect(
      h.vitalsEvents.filter((e) => e.entityId === 'target').map((e) => e.reason),
    ).toEqual(['dot'])
    expect(damageEvents[0]?.effectId).toBe('poison.tick')
  })

  it('passes the resolved source buffs into the DoT channel (dotRecovery stays reachable)', () => {
    const source = makeEntity('source', { maxHp: 200, woodPower: 90 }, { currentHp: 50 })
    const target = makeEntity('target', { maxHp: 500 }, { currentHp: 500 })
    const h = makeHarness([source, target])

    h.adapter.dealDamage(
      // might 10 + woodPower 90 = 100 base power x coefficient 1 = 100.
      payload({ damageProfile: 'legacy_dot', coefficient: 1, element: 'wood' }),
      h.ctx({ kind: 'buff_periodic' }),
    )

    // The dotRecovery trigger heals the source for the HP actually lost.
    expect(h.sourceBuffsCalls()).toBe(1)
    expect(source.currentHp).toBe(150)
  })
})

describe('CombatSystemDamageAdapter -- standard hit channel', () => {
  it('routes any other profile to applyModifiedDirectDamage semantics (finalDamagePercent applies)', () => {
    const source = makeEntity('source', { finalDamagePercent: 0.5 })
    const target = makeEntity('target', { maxHp: 500 }, { currentHp: 500 })
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'skill_burst', coefficient: 100 }),
      h.ctx({ kind: 'skill' }),
    )

    // rawDamage reports the intent amount (coefficient); hpDamage is the
    // vitals truth after the channel's hit-layer multiplier: 100 * 1.5.
    expect(result).toEqual({ rawDamage: 100, hpDamage: 150, killed: false })
    expect(h.vitalsEvents.map((e) => e.reason)).toEqual(['damage'])
  })

  it('skips when the standard-hit attacker entity cannot be resolved', () => {
    const target = makeEntity('target')
    const h = makeHarness([target]) // 'source' absent

    expect(() =>
      h.adapter.dealDamage(payload(), h.ctx({ kind: 'skill', sourceId: 'ghost' })),
    ).toThrow(CombatOperationSkip)
  })
})

describe('CombatSystemDamageAdapter -- dispatch tie-break (locked: profile-first)', () => {
  it("legacy_dot profile beats a contradictory origin.kind 'reaction' (exact profile match owns the channel)", () => {
    const source = makeEntity('source')
    const target = makeEntity(
      'target',
      { maxHp: 500, defense: 0, dotResistancePercent: 0.5 },
      { currentHp: 500 },
    )
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'legacy_dot', coefficient: 20 }),
      h.ctx({ kind: 'reaction' }),
    )

    // DoT economy proves the channel: dotResistance halves the tick,
    // the sourceBuffs resolver is consulted, vitals reason is 'dot'.
    expect(result.hpDamage).toBe(100)
    expect(h.vitalsEvents.filter((e) => e.entityId === 'target').map((e) => e.reason)).toEqual(['dot'])
    expect(h.sourceBuffsCalls()).toBe(1)
  })

  it("origin.kind 'reaction' routes a non-prefixed profile to the reaction channel (origin fallback)", () => {
    const source = makeEntity('source')
    const target = makeEntity('target', { maxHp: 500, dotResistancePercent: 0.75 }, { currentHp: 500 })
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'standard_hit', coefficient: 100 }),
      h.ctx({ kind: 'reaction' }),
    )

    // dotResistancePercent NOT consumed, reason 'reaction' -- this is
    // the same dispatch as the 'reaction_*' profile test above, reached
    // via the origin fallback rather than the profile prefix.
    expect(result.hpDamage).toBe(100)
    expect(h.vitalsEvents.map((e) => e.reason)).toEqual(['reaction'])
    expect(h.sourceBuffsCalls()).toBe(0)
  })
})

describe('CombatSystemDamageAdapter -- target validity', () => {
  it('throws CombatOperationSkip(invalid_target_state) on an unresolvable target', () => {
    const source = makeEntity('source')
    const h = makeHarness([source])

    try {
      h.adapter.dealDamage(payload({ targetId: 'ghost' }), h.ctx())
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CombatOperationSkip)
      expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
    }
  })

  it('throws CombatOperationSkip(invalid_target_state) on a dead target', () => {
    const source = makeEntity('source')
    const target = makeEntity('target', {}, { alive: false, currentHp: 0 })
    const h = makeHarness([source, target])

    try {
      h.adapter.dealDamage(payload(), h.ctx())
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CombatOperationSkip)
      expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
    }
    expect(h.vitalsEvents).toHaveLength(0)
  })
})
