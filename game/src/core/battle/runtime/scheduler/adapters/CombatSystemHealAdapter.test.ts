// CombatSystemHealAdapter.test.ts -- M3 heal-authority adapter.
// Routes HealOperation payloads through CombatSystem.applyHealing and
// reports { requested, healed, after }.

import { describe, expect, it } from 'vitest'

import type { CombatEntity } from '../../../../combat/CombatEntity'
import { CombatSystem } from '../../../../combat/CombatSystem'
import { EventBus } from '../../../../events/EventBus'
import { createBaseStats } from '../../../../stats/StatBlock'
import type { Stats } from '../../../../stats/StatBlock'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatOperationOrigin } from '../../../contracts/origin'
import type { CombatEntityId } from '../../../contracts/ids'

import { CombatOperationSkip } from '../CombatOperationExecutor'
import { CombatSystemHealAdapter } from './CombatSystemHealAdapter'

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

function makeAdapter(entities: CombatEntity[]) {
  const map = new Map<CombatEntityId, CombatEntity>(entities.map((e) => [e.id, e]))
  const combat = new CombatSystem(new EventBus())
  return new CombatSystemHealAdapter(combat, (id) => map.get(id))
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

describe('CombatSystemHealAdapter', () => {
  it('heals through applyHealing and reports { requested, healed, after }', () => {
    const target = makeEntity('target', { maxHp: 200 }, { currentHp: 80 })
    const adapter = makeAdapter([target])

    const result = adapter.heal({ targetId: 'target', amount: 30 }, CTX)

    expect(result).toEqual({ requested: 30, healed: 30, after: 110 })
    expect(target.currentHp).toBe(110)
  })

  it('caps at maxHp and scales with healingEffectivenessPercent', () => {
    const target = makeEntity(
      'target',
      { maxHp: 200, healingEffectivenessPercent: 1 },
      { currentHp: 100 },
    )
    const adapter = makeAdapter([target])

    const result = adapter.heal({ targetId: 'target', amount: 60 }, CTX)

    // 60 * (1 + 1) = 120 requested-effective, clamped to the 100 missing.
    expect(result).toEqual({ requested: 60, healed: 100, after: 200 })
  })

  it('throws CombatOperationSkip(invalid_target_state) on an unresolvable or dead target', () => {
    const dead = makeEntity('dead', {}, { alive: false, currentHp: 0 })
    const adapter = makeAdapter([dead])

    for (const targetId of ['ghost', 'dead']) {
      try {
        adapter.heal({ targetId, amount: 10 }, CTX)
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(CombatOperationSkip)
        expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
      }
    }
  })
})
