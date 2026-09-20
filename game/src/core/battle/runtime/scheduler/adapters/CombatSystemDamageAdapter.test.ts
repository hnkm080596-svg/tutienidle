// CombatSystemDamageAdapter.test.ts -- M3 damage-authority adapter.
//
// Proves the representative PROFILES route to their intended channels
// (review-locked rule): the profile dispatches, origin is context.
//   'legacy_dot'  -> applyDotDamage (dotResistance / dotRecovery economy)
//   'reaction_*' or origin.kind 'reaction' -> reaction channel
//     (applyReactionDamage: elemental power x coefficient mitigated by
//     the target's matching resistance; NO hit-layer modifiers, NO
//     dotResistance / dotRecovery, vitals reason 'reaction', canCrit:false
//     by construction)
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
import { FunctionCombatRng } from '../../rng/FunctionCombatRng'
import { ScriptedCombatRng } from '../../rng/ScriptedCombatRng'
import { SeededCombatRng } from '../../rng/SeededCombatRng'
import type { CombatRng } from '../../../contracts/rng'
import {
  CombatSystemDamageAdapter,
  type CombatSystemDamageAdapterDeps,
} from './CombatSystemDamageAdapter'

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

function makeHarness(
  entities: CombatEntity[],
  opts: { rng?: CombatRng; engineSource?: () => number } = {},
): Harness {
  const bus = new EventBus()
  const combat = new CombatSystem(bus)
  let rolls = 0
  combat.setRandomSource(() => {
    rolls += 1
    return opts.engineSource === undefined ? 0 : opts.engineSource()
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
    rng: opts.rng ?? new FunctionCombatRng(() => 0),
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
    const source = makeEntity('source', { might: 10, firePower: 90 }, { currentHp: 10 })
    const target = makeEntity('target', { maxHp: 500, dotResistancePercent: 0.75 }, { currentHp: 500 })
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'reaction_khac_che', coefficient: 1, element: 'fire', canCrit: false }),
      h.ctx({ kind: 'reaction', reactionId: 'khac_che' }),
    )

    // elementalBasePower = might 10 + firePower 90 = 100; coefficient 1;
    // fireResistance 0 -> raw 100 through the vitals channel.
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

  it('mitigates through the TARGET resistance channel matching the op element (0 vs 40 -> different damage)', () => {
    // The locked ruling: khac damage carries the ATTACKER's element so
    // the target's matching resistance applies -- elementless flat
    // damage was rejected. Same source, same coefficient: the only
    // variable is the target's metalResistance.
    const source = makeEntity('source', { might: 0, metalPower: 100, metalPenetration: 0 })
    const t0 = makeEntity('target0', { maxHp: 10_000, metalResistance: 0 })
    const t40 = makeEntity('target40', { maxHp: 10_000, metalResistance: 40 })
    const h = makeHarness([source, t0, t40])

    const op = (targetId: string): DealDamageOperation['payload'] =>
      payload({
        damageProfile: 'reaction',
        coefficient: 1.5,
        element: 'metal',
        targetId,
        canCrit: false,
      })
    const r0 = h.adapter.dealDamage(op('target0'), h.ctx({ kind: 'reaction' }))
    const r40 = h.adapter.dealDamage(op('target40'), h.ctx({ kind: 'reaction' }))

    // power 100 x 1.5 = 150 raw; mitigation 0 -> 150, 0.4 -> 90.
    expect(r0.rawDamage).toBe(150)
    expect(r0.hpDamage).toBe(150)
    expect(r40.rawDamage).toBe(90)
    expect(r40.hpDamage).toBe(90)
    expect(r0.hpDamage).not.toBe(r40.hpDamage)
  })

  it('reads the resistance channel matching the ATTACKER element -- a walled element mitigates, an open element lands full', () => {
    // Same source, same coefficient: only the op's element changes which
    // resistance channel the target contributes.
    const source = makeEntity('source', { might: 0, metalPower: 100, firePower: 100 })
    const target = makeEntity(
      'target',
      { maxHp: 10_000, metalResistance: 80, fireResistance: 0 },
      { currentHp: 10_000 },
    )
    const h = makeHarness([source, target])

    const metal = h.adapter.dealDamage(
      payload({ damageProfile: 'reaction', coefficient: 1, element: 'metal', canCrit: false }),
      h.ctx({ kind: 'reaction' }),
    )
    const fire = h.adapter.dealDamage(
      payload({ damageProfile: 'reaction', coefficient: 1, element: 'fire', canCrit: false }),
      h.ctx({ kind: 'reaction' }),
    )

    // metal: net 80 -> capped 0.75 -> 25; fire: net 0 -> 100.
    expect(metal.hpDamage).toBe(25)
    expect(fire.hpDamage).toBe(100)
  })

  it('source penetration offsets target resistance on the reaction channel', () => {
    const source = makeEntity('source', { might: 0, metalPower: 100, metalPenetration: 20 })
    const target = makeEntity(
      'target',
      { maxHp: 10_000, metalResistance: 40 },
      { currentHp: 10_000 },
    )
    const h = makeHarness([source, target])

    const result = h.adapter.dealDamage(
      payload({ damageProfile: 'reaction', coefficient: 1, element: 'metal', canCrit: false }),
      h.ctx({ kind: 'reaction' }),
    )

    // net 40 - 20 = 20 -> mitigation 0.2 -> 100 x 0.8.
    expect(result.hpDamage).toBe(80)
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

  it('elementalPenetrationBonus ADDS points to the source stat at resolution -- 40 resistance resolves as net 20 with +20 (canonical-seals addendum)', () => {
    const source = makeEntity('source', { might: 0, metalPower: 100, metalPenetration: 0 })
    const target = makeEntity(
      'target',
      { maxHp: 10_000, metalResistance: 40, dotResistancePercent: 0 },
      { currentHp: 10_000 },
    )
    const h = makeHarness([source, target])

    // power = might 0 + metalPower 100 = 100, coefficient 1.
    // baseline: net resistance 40 -> mitigation 0.4 -> hpDamage 60.
    const baseline = h.adapter.dealDamage(
      payload({ damageProfile: 'legacy_dot', coefficient: 1, element: 'metal' }),
      h.ctx({ kind: 'buff_periodic' }),
    )
    expect(baseline.hpDamage).toBe(60)

    // bonus +20: net resistance 20 -> mitigation 0.2 -> hpDamage 80.
    const withBonus = h.adapter.dealDamage(
      payload({
        damageProfile: 'legacy_dot',
        coefficient: 1,
        element: 'metal',
        elementalPenetrationBonus: 20,
      }),
      h.ctx({ kind: 'buff_periodic' }),
    )
    expect(withBonus.hpDamage).toBe(80)

    // Never a stats mutation -- a third op without the bonus resolves
    // against the untouched source stat again.
    expect(source.stats.metalPenetration).toBe(0)
    const again = h.adapter.dealDamage(
      payload({ damageProfile: 'legacy_dot', coefficient: 1, element: 'metal' }),
      h.ctx({ kind: 'buff_periodic' }),
    )
    expect(again.hpDamage).toBe(60)
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

// The adapter is the DamageAuthority: it OWNS every declared-policy
// roll (crit bonus / armor bypass) on the 'skill_hit' channel. The rng
// is a required dependency -- canonical combat damage never mints or
// falls back to an implicit random source. These tests pin the
// contract; the production wiring (GameManagerTurnBattleOps) binds the
// shared cycle rng, and the engine's own hit/crit/block rolls ride the
// same instance via combat.setRandomSource.
describe('CombatSystemDamageAdapter -- CombatRng contract', () => {
  it('refuses construction without an explicit CombatRng (no implicit random source)', () => {
    const combat = new CombatSystem(new EventBus())
    const entities = new Map<CombatEntityId, CombatEntity>()
    // What an untyped caller could still pass: the interface makes the
    // missing dep a compile error, the guard makes it executable.
    const missing = { resolveSourceGrants: () => undefined }
    expect(
      () =>
        new CombatSystemDamageAdapter(
          combat,
          (id: CombatEntityId) => entities.get(id),
          missing as unknown as CombatSystemDamageAdapterDeps,
        ),
    ).toThrow(/explicit CombatRng/)
  })

  it('critPolicy.bonusChance rolls on the injected rng -- success forces the crit', () => {
    const attacker = makeEntity('source', { might: 100, criticalRate: 0 })
    const target = makeEntity('target', { maxHp: 10_000, defense: 0 }, { currentHp: 10_000 })
    // Adapter roll 0.4 < 0.5 forces the crit; the engine source fails
    // high everywhere else (no natural crit/block/ignore-resistance).
    // ScriptedCombatRng throws on a second roll -- exactly one
    // declared-policy roll is consumed.
    const h = makeHarness([attacker, target], {
      rng: new ScriptedCombatRng([0.4]),
      engineSource: () => 0.999999,
    })

    const result = h.adapter.dealDamage(
      payload({
        damageProfile: 'skill_hit',
        coefficient: 1,
        canCrit: true,
        canMiss: true,
        hitPolicy: { guaranteedHit: true },
        critPolicy: { bonusChance: 0.5 },
      }),
      h.ctx(),
    )

    expect(result.landed).toBe(true)
    expect(result.crit).toBe(true)
  })

  it('a failed critPolicy.bonusChance roll hands the crit decision back to the engine channel', () => {
    const run = (engineSource: () => number): boolean | undefined => {
      const attacker = makeEntity('source', { might: 100, criticalRate: 0.5 })
      const target = makeEntity('target', { maxHp: 10_000, defense: 0 }, { currentHp: 10_000 })
      const h = makeHarness([attacker, target], {
        // 0.9 >= 0.5 -> options.critical stays undefined; the engine's
        // rollCritical decides on the ENGINE stream.
        rng: new ScriptedCombatRng([0.9]),
        engineSource,
      })
      return h.adapter.dealDamage(
        payload({
          damageProfile: 'skill_hit',
          coefficient: 1,
          canCrit: true,
          canMiss: true,
          hitPolicy: { guaranteedHit: true },
          critPolicy: { bonusChance: 0.5 },
        }),
        h.ctx(),
      ).crit
    }

    expect(run(() => 0.999999)).toBe(false)
    expect(run(() => 0.1)).toBe(true)
  })

  it('rolls crit policy before armor policy on the injected rng (legacy perInstanceOptions order)', () => {
    // Scripted [crit roll, armor roll]. [0.9, 0.1]: crit bonus fails,
    // armor bypass fires -> uncritted, unmitigated damage. [0.1, 0.9]:
    // crit bonus fires, bypass fails -> critted, fully mitigated
    // damage. Swapping which roll feeds which policy changes both
    // outcomes -- the order is observable, not incidental.
    const run = (rolls: readonly number[]) => {
      const attacker = makeEntity('source', { might: 100, criticalRate: 0 })
      const target = makeEntity(
        'target',
        { maxHp: 100_000, defense: 2_000 },
        { currentHp: 100_000 },
      )
      const h = makeHarness([attacker, target], {
        rng: new ScriptedCombatRng(rolls),
        engineSource: () => 0.999999,
      })
      return h.adapter.dealDamage(
        payload({
          damageProfile: 'skill_hit',
          coefficient: 1,
          canCrit: true,
          canMiss: true,
          hitPolicy: { guaranteedHit: true },
          critPolicy: { bonusChance: 0.5 },
          armorPolicy: { bypassChance: 0.5 },
        }),
        h.ctx(),
      )
    }

    const bypassed = run([0.9, 0.1])
    expect(bypassed.crit).toBe(false)

    const crittedArmored = run([0.1, 0.9])
    expect(crittedArmored.crit).toBe(true)

    // Bypassed armor lands far more HP damage than a fully-mitigated
    // crit on a 2000-defense target -- the second scripted roll really
    // did feed the armor policy.
    expect(bypassed.hpDamage).toBeGreaterThan(crittedArmored.hpDamage)
  })

  it('same-seed streams produce identical skill_hit outcomes; different seeds diverge', () => {
    const run = (seed: number) => {
      const rng = new SeededCombatRng(seed)
      // Production shape (GameManagerTurnBattleOps): ONE CombatRng feeds
      // the adapter's declared-policy rolls AND the engine's own
      // hit/crit/block/ignore-resistance rolls.
      const h = makeHarness(
        [
          makeEntity('source', { might: 100, criticalRate: 0.25, accuracyRating: 80 }),
          makeEntity(
            'target',
            { maxHp: 1_000_000, defense: 40, evasionRate: 20, blockChance: 0.1 },
            { currentHp: 1_000_000 },
          ),
        ],
        { rng, engineSource: () => rng.roll() },
      )
      const outcomes: unknown[] = []
      for (let i = 0; i < 6; i++) {
        outcomes.push(
          h.adapter.dealDamage(
            payload({
              damageProfile: 'skill_hit',
              coefficient: 1,
              canCrit: true,
              canMiss: true,
              critPolicy: { bonusChance: 0.2 },
              armorPolicy: { bypassChance: 0.3, pierceFractionOnFail: 0.5 },
            }),
            h.ctx(),
          ),
        )
      }
      return outcomes
    }

    expect(run(11)).toEqual(run(11))
    const streams = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(run(seed))))
    expect(streams.size).toBeGreaterThan(1)
  })
})
