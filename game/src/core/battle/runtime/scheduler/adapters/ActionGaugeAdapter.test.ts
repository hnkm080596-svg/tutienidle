// ActionGaugeAdapter.test.ts -- M3 gauge-authority adapter.
// pushGauge takes a SIGNED fraction of GAUGE_MAX and applies it through
// refundGauge's clamped [0, GAUGE_MAX] additive delta; the result reports
// fraction-of-max units (the port's own unit).

import { describe, expect, it } from 'vitest'

import type { GaugeActor } from '../../../../battle/turn/ActionGauge'
import { GAUGE_MAX } from '../../../../battle/turn/ActionGauge'
import type { CombatEntity } from '../../../../combat/CombatEntity'
import { createBaseStats } from '../../../../stats/StatBlock'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatOperationOrigin } from '../../../contracts/origin'
import type { CombatEntityId } from '../../../contracts/ids'

import { CombatOperationSkip } from '../CombatOperationExecutor'
import { ActionGaugeAdapter } from './ActionGaugeAdapter'

function makeActor(id: string, actionGauge: number, alive = true): GaugeActor {
  return { id, speed: 100, actionGauge, alive }
}

/** Minimal CombatEntity -- the adapter only reads id + alive. */
function makeEntity(id: string, alive = true): CombatEntity {
  const stats = createBaseStats()
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
    alive,
  }
}

function makeAdapter(actors: GaugeActor[], entities?: CombatEntity[]) {
  const actorMap = new Map<CombatEntityId, GaugeActor>(actors.map((a) => [a.id, a]))
  // Default: mirror each actor's flag onto a backing entity -- the
  // override list lets a test diverge the cache from the live truth.
  const entityMap = new Map<CombatEntityId, CombatEntity>(
    (entities ?? actors.map((a) => makeEntity(a.id, a.alive))).map((e) => [e.id, e]),
  )
  return new ActionGaugeAdapter(
    (id) => actorMap.get(id),
    (id) => entityMap.get(id),
  )
}

const CTX: CombatAuthorityExecutionContext = {
  operationId: 'op.test',
  origin: {
    kind: 'skill',
    originId: 'test.origin',
    sourceId: 'source',
    rootActionId: 'root.test',
  } satisfies CombatOperationOrigin,
  events: { emit: () => {} },
  combatSequence: 0,
}

describe('ActionGaugeAdapter', () => {
  it('applies a positive fraction push and reports fraction-of-max units', () => {
    const actor = makeActor('actor', 200)
    const adapter = makeAdapter([actor])

    const result = adapter.pushGauge('actor', 0.35, CTX)

    expect(result).toEqual({ before: 0.2, requestedDelta: 0.35, appliedDelta: 0.35, after: 0.55 })
    expect(actor.actionGauge).toBe(0.55 * GAUGE_MAX)
  })

  it('clamps a negative pushback at 0 (never below empty)', () => {
    const actor = makeActor('actor', 100)
    const adapter = makeAdapter([actor])

    const result = adapter.pushGauge('actor', -0.5, CTX)

    // Requested -500 but only -100 could apply before hitting empty.
    expect(result).toEqual({ before: 0.1, requestedDelta: -0.5, appliedDelta: -0.1, after: 0 })
    expect(actor.actionGauge).toBe(0)
  })

  it('caps a positive push at GAUGE_MAX', () => {
    const actor = makeActor('actor', 800)
    const adapter = makeAdapter([actor])

    const result = adapter.pushGauge('actor', 0.5, CTX)

    expect(result).toEqual({ before: 0.8, requestedDelta: 0.5, appliedDelta: 0.2, after: 1 })
    expect(actor.actionGauge).toBe(GAUGE_MAX)
  })

  it('clamps an over-max gauge down to GAUGE_MAX on any delta', () => {
    // advanceGauge is unclamped -- an actor can hold > GAUGE_MAX.
    const actor = makeActor('actor', GAUGE_MAX + 200)
    const adapter = makeAdapter([actor])

    const result = adapter.pushGauge('actor', -0.05, CTX)

    expect(result.after).toBe(1)
    expect(actor.actionGauge).toBe(GAUGE_MAX)
  })

  it('throws CombatOperationSkip(invalid_target_state) on an unresolvable or dead actor', () => {
    const dead = makeActor('dead', 0, false)
    const adapter = makeAdapter([dead])

    for (const targetId of ['ghost', 'dead']) {
      try {
        adapter.pushGauge(targetId, 0.1, CTX)
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CombatOperationSkip)
        expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
      }
    }
  })

  it('skips when the live entity is dead even though the participant cache still reads alive', () => {
    // M4 review fix: participant.alive is a cache synced only inside the
    // pacing loop -- a just-killed participant can read stale-true
    // mid-resolution. The gate must read entity.alive.
    const staleCache = makeActor('victim', 100, true)
    const adapter = makeAdapter([staleCache], [makeEntity('victim', false)])

    try {
      adapter.pushGauge('victim', 0.1, CTX)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CombatOperationSkip)
      expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
    }
    // The skip must land BEFORE any gauge mutation.
    expect(staleCache.actionGauge).toBe(100)
  })
})
