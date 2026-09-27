import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinitionId } from '../contracts/ids'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

const STUN_DEF: BuffDefinition = {
  id: 'qa_stun' as BuffDefinitionId,
  name: 'Stun',
  kind: 'debuff',
  instanceScope: 'per_target',
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 10, scaling: 'fixed' },
  controls: [{ type: 'stun' }],
  dispellable: true,
}

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  } as CombatEntity
}

describe('TurnBattleSystem — charging actor is immune to the CC counter side-effect', () => {
  it('consecutiveHardCcTurns stays 0 across charging+stunned turns (no premature Bá Thể clear)', () => {
    const player = createCombatant({
      id: 'player', type: 'player', row: 4,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 100 }),
    })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

    const playerParticipant: TurnBattleParticipant = {
      id: 'player', entity: player, speed: 100, priority: 0, actionGauge: 0, alive: true,
      consecutiveHardCcTurns: 0,
      chargingTurnsRemaining: 3,
      pendingChargedSkillId: 'player_special',
      special: { skill: { id: 'player_special', cooldownTurns: 0, chargeTurns: 3, damage: { kind: 'physical', multiplier: 5 }, targeting: { shape: 'single' } }, remainingCooldownTurns: 0 },
      basic: { id: 'player_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }
    const enemyParticipant: TurnBattleParticipant = {
      id: 'enemy', entity: enemyEntity, speed: 100, priority: 1, actionGauge: 0, alive: true,
      consecutiveHardCcTurns: 0,
      basic: { id: 'enemy_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }

    const registry = makeTestBuffRegistry([STUN_DEF])
    const combat = new CombatSystem(new EventBus())
    const runtime = makeTurnRuntime({
      registry,
      participants: () => [playerParticipant, enemyParticipant],
      combatSystem: combat,
    })
    runtime.applyBuff('qa_stun', playerParticipant)

    const battle: TurnBattle = { players: [playerParticipant], enemies: [enemyParticipant], state: 'fighting' }
    const system = new TurnBattleSystem(combat, 10_000, registry, undefined, runtime)

    for (let turn = 0; turn < 2; turn += 1) {
      const declared = system.declareActorAction(battle, playerParticipant)

      expect(declared.ccBlocked).toBe(false)
      expect(declared.isCharging).toBe(true)
      expect(playerParticipant.consecutiveHardCcTurns).toBe(0)
    }
  })
})

describe('TurnBattleSystem — self-scoped charge init queues no follow-up executions', () => {
  it('a self-targeted charge skill with repeatCasts initiates the charge and queues nothing', () => {
    // Latent-defect pin: self scope used to set affected=[actor] without
    // the isChargeInit gate the enemy branch has, so a charge init
    // carrying repeatCasts would queue executions that resolve the
    // charged root instantly and uncharged. No live content combines
    // the two; this synthetic def pins the gate.
    const player = createCombatant({
      id: 'player', type: 'player', row: 4,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 100 }),
    })
    const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

    const playerParticipant: TurnBattleParticipant = {
      id: 'player', entity: player, speed: 100, priority: 0, actionGauge: 0, alive: true,
      consecutiveHardCcTurns: 0,
      special: {
        skill: {
          id: 'player_self_charge', cooldownTurns: 0, chargeTurns: 2, repeatCasts: 2,
          targetScope: 'self', targeting: { shape: 'single' },
        },
        remainingCooldownTurns: 0,
      },
      basic: { id: 'player_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }
    const enemyParticipant: TurnBattleParticipant = {
      id: 'enemy', entity: enemyEntity, speed: 10, priority: 1, actionGauge: 0, alive: true,
      consecutiveHardCcTurns: 0,
      basic: { id: 'enemy_basic', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
    }

    const battle: TurnBattle = { players: [playerParticipant], enemies: [enemyParticipant], state: 'fighting' }
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))

    const declared = system.declareActorAction(battle, playerParticipant, 'special')

    // Charge INIT: the charge state commits, no target set resolves
    // (enemy scope behaves the same -- targets materialize at resolve).
    expect(playerParticipant.chargingTurnsRemaining).toBe(2)
    expect(declared.affected).toEqual([])

    const { targetIds } = system.applyActionImpact(battle, declared)
    system.completeAction(battle, playerParticipant, declared, targetIds)

    expect(battle.queuedExecutions).toBeUndefined()
  })
})
