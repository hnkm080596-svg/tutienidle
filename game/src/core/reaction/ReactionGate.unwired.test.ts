import { describe, expect, it } from 'vitest'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { CombatEntity } from '../combat/CombatEntity'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { asBaseStats, createBaseStats } from '../stats/StatBlock'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import {
  makeTestBuffRegistry,
  makeTurnRuntime,
} from '../battle/turn/testing/TurnRuntimeFixtures'

// Reaction gate wiring coverage (post-activation): production DOES wire
// the reaction engine -- GameManagerTurnBattleOps constructs
// ReactionRegistry / ReactionSystem / ReactionDispatcher and registers
// the 'elemental_application_committed' immediate handler on the
// scheduler. This file pins the complement: a minted runtime WITHOUT
// that registration stays inert. The fixture omits the dispatcher, so a
// canonical application emits `elemental_application_committed` and
// nothing consumes it -- the gate is the wiring, not the emission path.

const HOA_AN_DEF: BuffDefinition = {
  id: 'hoa_an' as BuffDefinitionId,
  name: 'Hoa An (test binding)',
  kind: 'ailment',
  element: 'fire',
  instanceScope: 'per_source',
  stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
  application: { resistance: 'ailment' },
  dispellable: true,
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  const entity = {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
  entity.baseStats = (overrides.baseStats ?? overrides.stats ?? entity.baseStats) as CombatEntity['baseStats']
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}

function makeParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  return {
    id, entity, speed: 100, priority: 0, actionGauge: 0, alive: entity.alive,
    consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture() {
  const player = createCombatant({ id: 'player', type: 'player', row: 4 })
  const enemy = createCombatant({ id: 'enemy' })
  const playerParticipant = makeParticipant('player', player)
  const enemyParticipant = makeParticipant('enemy', enemy)
  const registry = makeTestBuffRegistry([HOA_AN_DEF])
  const runtime = makeTurnRuntime({
    registry,
    participants: () => [playerParticipant, enemyParticipant],
    combatSystem: new CombatSystem(new EventBus()),
  })
  return { player, enemy, playerParticipant, enemyParticipant, registry, runtime }
}

describe('reaction gate without dispatcher wiring (runtime stays inert)', () => {
  it('a canonical hoa_an application on an unwired runtime emits the committed event and triggers NO reaction', () => {
    const { playerParticipant, enemyParticipant, enemy, runtime } = fixture()

    runtime.applyBuff('hoa_an', enemyParticipant, playerParticipant)

    // Canonical binding proves the registry sees hoa_an -> fire (the M-INT
    // piece that IS installed): the committed event is emitted.
    const committed = runtime.events.filter((e) => e.type === 'elemental_application_committed')
    expect(committed).toHaveLength(1)

    // ...and nothing consumes it on an unwired runtime: no reaction
    // damage, no reaction-originated events, no follow-up ops.
    expect(enemy.currentHp).toBe(enemy.maxHp)
    const reactionEvents = runtime.events.filter(
      (e) => e.type !== 'elemental_application_committed' && /reaction/i.test(e.type),
    )
    expect(reactionEvents).toHaveLength(0)
  })

  it('an unwired runtime carries no reaction members and no downstream reaction events', () => {
    const { runtime } = fixture()

    // The fixture's runtime surface is buffs/procs/scheduler/gaugeHandler
    // only -- production keeps the same member shape (the dispatcher is
    // registered ON the scheduler, not held as a runtime member), so this
    // assertion pins that the unwired lane adds nothing either.
    for (const key of Object.keys(runtime)) {
      expect(key).not.toMatch(/reaction/i)
    }

    // Without the dispatcher registration the scheduler has no consumer:
    // a canonical application + full lifecycle tick emits the committed
    // event and nothing downstream.
    const { playerParticipant, enemyParticipant, runtime: rt } = fixture()
    rt.applyBuff('hoa_an', enemyParticipant, playerParticipant)
    rt.tickHolderTurnsEnd(enemyParticipant.entity.id)
    const types = rt.events.map((e) => e.type)
    expect(types).toContain('elemental_application_committed')
    expect(types.filter((t) => /reaction/i.test(t))).toEqual([])
    expect(rt.buffs.getForTarget(enemyParticipant.entity.id)).toHaveLength(1)
  })
})
