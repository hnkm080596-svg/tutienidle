import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinitionId } from '../contracts/ids'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// 9.5 #9 — cast counting revived on the turn engine. The engine fires
// onSkillCast(actor, skillId) once per COMMITTED action (same point as
// commitAction): normal casts and charge-initiation count; charge
// ticks/resolution and CC-blocked turns do not. The engine is generic —
// it reports every actor's cast; consumers (GameManagerTurnBattleOps)
// filter to the primary player.

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

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id, entity: combatEntity, speed, priority, actionGauge: 0,
    alive: combatEntity.alive, consecutiveHardCcTurns: 0,
    basic: { id: `${id}_basic`, cooldownTurns: 0, damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' } },
  }
}

function fixture() {
  const player = createCombatant({
    id: 'player', type: 'player', row: 4,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, speed: 100, might: 10 }),
  })
  const enemyEntity = createCombatant({ id: 'enemy', currentHp: 1_000_000, maxHp: 1_000_000 })

  const playerParticipant = makeParticipant('player', player, 100, 0)
  const enemyParticipant = makeParticipant('enemy', enemyEntity, 50, 1)

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  return { battle, playerParticipant, enemyParticipant }
}

describe('TurnBattleSystem.onSkillCast — committed-cast callback', () => {
  it('đòn thường bắn callback ĐÚNG 1 lần với (actor, skillId)', () => {
    const { battle, playerParticipant } = fixture()
    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    system.applyActionImpact(battle, declared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'player_basic')
  })

  it('engine generic: cast của enemy cũng bắn (consumer tự lọc player)', () => {
    const { battle, enemyParticipant } = fixture()
    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, enemyParticipant)
    system.applyActionImpact(battle, declared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(enemyParticipant, 'enemy_basic')
  })

  it('CC-blocked (stun) → KHÔNG bắn (cast không xảy ra)', () => {
    const { battle, playerParticipant, enemyParticipant } = fixture()
    const registry = makeTestBuffRegistry([STUN_DEF])
    const combat = new CombatSystem(new EventBus())
    const runtime = makeTurnRuntime({
      registry,
      participants: () => [playerParticipant, enemyParticipant],
      combatSystem: combat,
    })
    runtime.applyBuff('qa_stun', playerParticipant)

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(combat, 10_000, registry, undefined, runtime, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    expect(declared.ccBlocked).toBe(true)

    system.applyActionImpact(battle, declared)

    expect(onSkillCast).not.toHaveBeenCalled()
  })

  it('charge-initiation tính 1 cast + commit cooldownTurns; tick/resolve KHÔNG bắn lại', () => {
    const { battle, playerParticipant } = fixture()
    playerParticipant.special = {
      skill: {
        id: 'fixture_charge',
        cooldownTurns: 5,
        chargeTurns: 2,
        damage: { kind: 'physical', multiplier: 6 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, onSkillCast)

    // Lượt 1: charge-init — cast commits (cooldown + resource), callback fires.
    const initDeclared = system.declareActorAction(battle, playerParticipant)
    expect(initDeclared.skillId).toBe('fixture_charge')
    system.applyActionImpact(battle, initDeclared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'fixture_charge')
    expect(playerParticipant.special.remainingCooldownTurns).toBe(5)

    // Lượt 2: charge tick — không cast mới.
    const tickDeclared = system.declareActorAction(battle, playerParticipant)
    expect(tickDeclared.isCharging).toBe(true)
    system.applyActionImpact(battle, tickDeclared)
    expect(onSkillCast).toHaveBeenCalledTimes(1)

    // Lượt 3: charge-resolve — hit lands, nhưng cast đã tính ở initiation.
    const resolveDeclared = system.declareActorAction(battle, playerParticipant)
    expect(resolveDeclared.chargeResolved).toBe(true)
    system.applyActionImpact(battle, resolveDeclared)
    expect(onSkillCast).toHaveBeenCalledTimes(1)
  })

  it('self-target skill (affected=[actor]) vẫn bắn đúng 1 lần', () => {
    const { battle, playerParticipant } = fixture()
    playerParticipant.special = {
      skill: {
        id: 'self_buff',
        cooldownTurns: 3,
        targetScope: 'self',
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const onSkillCast = vi.fn()
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, undefined, undefined, undefined, onSkillCast)

    const declared = system.declareActorAction(battle, playerParticipant)
    system.applyActionImpact(battle, declared)

    expect(onSkillCast).toHaveBeenCalledTimes(1)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'self_buff')
  })
})
