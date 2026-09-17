// VitalsShieldAdapter.test.ts -- M3 shield-authority adapter.
// apply_shield routes through the vitals-level ward grant
// (EntityVitalsSystem.grantWard) -- never a direct `currentWard +=`.

import { describe, expect, it } from 'vitest'

import type { CombatEntity } from '../../../../combat/CombatEntity'
import { CombatSystem } from '../../../../combat/CombatSystem'
import type { EntityVitalsChangedEvent } from '../../../../combat/EntityVitalsSystem'
import { EventBus } from '../../../../events/EventBus'
import { createBaseStats } from '../../../../stats/StatBlock'
import type { Stats } from '../../../../stats/StatBlock'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatOperationOrigin } from '../../../contracts/origin'
import type { CombatEntityId } from '../../../contracts/ids'

import { CombatOperationSkip } from '../CombatOperationExecutor'
import { VitalsShieldAdapter } from './VitalsShieldAdapter'

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
  adapter: VitalsShieldAdapter
  vitalsEvents: EntityVitalsChangedEvent[]
}

function makeHarness(entities: CombatEntity[]): Harness {
  const bus = new EventBus()
  const combat = new CombatSystem(bus)
  const vitalsEvents: EntityVitalsChangedEvent[] = []
  bus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (e) => vitalsEvents.push(e))
  const map = new Map<CombatEntityId, CombatEntity>(entities.map((e) => [e.id, e]))
  return { adapter: new VitalsShieldAdapter(combat.vitals, (id) => map.get(id)), vitalsEvents }
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

describe('VitalsShieldAdapter', () => {
  it("grants ward through the vitals authority and reports { applied, shieldAfter } with reason 'ward_grant'", () => {
    const target = makeEntity('target', { wardMax: 200 })
    const h = makeHarness([target])

    const result = h.adapter.applyShield('target', 50, CTX)

    expect(result).toEqual({ applied: 50, shieldAfter: 50 })
    expect(target.currentWard).toBe(50)
    expect(h.vitalsEvents.map((e) => e.reason)).toEqual(['ward_grant'])
    expect(h.vitalsEvents[0]?.sourceId).toBe('source')
  })

  it('clamps the grant at the live wardMax ceiling', () => {
    const target = makeEntity('target', { wardMax: 60 }, { currentWard: 40 })
    const h = makeHarness([target])

    const result = h.adapter.applyShield('target', 50, CTX)

    expect(result).toEqual({ applied: 20, shieldAfter: 60 })
    expect(target.currentWard).toBe(60)
  })

  it('throws CombatOperationSkip(invalid_target_state) on an unresolvable or dead target', () => {
    const dead = makeEntity('dead', { wardMax: 100 }, { alive: false, currentHp: 0 })
    const h = makeHarness([dead])

    for (const targetId of ['ghost', 'dead']) {
      try {
        h.adapter.applyShield(targetId, 10, CTX)
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CombatOperationSkip)
        expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
      }
    }
  })
})
