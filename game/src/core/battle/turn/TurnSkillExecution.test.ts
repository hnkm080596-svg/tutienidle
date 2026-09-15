import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnDeclaredAction } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { TurnSkillDefinition } from './TurnSkillAction'

// Phap Tu Reimagined Task 9 — TurnSkillExecution separates the cast's
// ROOT identity (cast count, slot cooldown, progression identity) from
// the RESOLVED payload (damage/ailments/targeting actually applied).
// source 'repeat'/'multicast' executions never re-consume the slot
// cooldown or fire the cast sink; 'original'/'empowered'/'composite'
// do — always under rootSkillId.

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function harness() {
  const player = createCombatant('player')
  const enemyEntity = createCombatant('enemy')
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = BASIC

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const onSkillCast = vi.fn()
  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100, undefined, undefined, undefined, undefined, onSkillCast)

  return { battle, playerParticipant, enemyParticipant, system, onSkillCast }
}

describe('TurnSkillExecution — root identity vs resolved payload (Task 9)', () => {
  it('a plain cast records an original execution under its own skill id', () => {
    const { battle, system } = harness()

    const result = system.resolveNextStep(battle)

    expect(result.execution).toBeDefined()
    expect(result.execution).toMatchObject({
      rootSkillId: 'qa_basic',
      source: 'original',
    })
    expect(result.execution!.resolvedSkill?.id).toBe('qa_basic')
  })

  it('cast count + cooldown land on rootSkillId, not the payload skill', () => {
    const { battle, playerParticipant, onSkillCast, system } = harness()

    const special: TurnSkillDefinition = {
      id: 'qa_special_root',
      cooldownTurns: 4,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
    }
    playerParticipant.special = { skill: special, remainingCooldownTurns: 0 }

    system.resolveNextStep(battle)

    expect(playerParticipant.special!.remainingCooldownTurns).toBe(4)
    expect(onSkillCast).toHaveBeenCalledWith(playerParticipant, 'qa_special_root')
  })

  it('a repeat-sourced execution resolves the payload but never touches slot cooldown or the cast sink', () => {
    const { battle, playerParticipant, enemyParticipant, onSkillCast, system } = harness()

    const special: TurnSkillDefinition = {
      id: 'qa_special_root',
      cooldownTurns: 4,
      damage: { kind: 'physical', multiplier: 2 },
      targeting: { shape: 'single' },
    }
    playerParticipant.special = { skill: special, remainingCooldownTurns: 0 }

    // Craft the declared action a repeat follow-up would carry: root
    // owns identity, resolvedSkill is the payload, source 'repeat'
    // forbids commit/cast-count.
    const declared: TurnDeclaredAction = {
      actorId: 'player',
      skillId: 'qa_special_root',
      ccBlocked: false,
      isCharging: false,
      chargeResolved: false,
      chargeTargetIds: [],
      chargedSkill: null,
      markerNoPool: false,
      action: {
        skillId: 'qa_special_root',
        skill: special,
        damage: special.damage,
        targeting: special.targeting,
        slot: playerParticipant.special!,
      },
      opposingSide: [enemyParticipant],
      affected: [enemyParticipant],
      scaledDamage: special.damage!,
      isReactionPath: false,
      suddenDeathMultiplier: 1,
      reactionPathPicks: null,
      isFollowUpBypass: true,
      execution: {
        rootSkillId: 'qa_special_root',
        resolvedSkill: special,
        source: 'repeat',
      },
    }

    const { targetIds } = system.applyActionImpact(battle, declared)

    // The payload still resolved (damage landed on the target)...
    expect(targetIds).toContain('enemy')
    expect(enemyParticipant.entity.currentHp).toBeLessThan(1_000_000)
    // ...but the root's cooldown and the cast sink were NOT touched.
    expect(playerParticipant.special!.remainingCooldownTurns).toBe(0)
    expect(onSkillCast).not.toHaveBeenCalled()
  })

  it('a multicast-sourced execution follows the same no-commit rule', () => {
    const { battle, playerParticipant, enemyParticipant, onSkillCast, system } = harness()

    const declared: TurnDeclaredAction = {
      actorId: 'player',
      skillId: 'qa_basic',
      ccBlocked: false,
      isCharging: false,
      chargeResolved: false,
      chargeTargetIds: [],
      chargedSkill: null,
      markerNoPool: false,
      action: {
        skillId: 'qa_basic',
        skill: BASIC,
        damage: BASIC.damage,
        targeting: BASIC.targeting,
        slot: null,
      },
      opposingSide: [enemyParticipant],
      affected: [enemyParticipant],
      scaledDamage: BASIC.damage!,
      isReactionPath: false,
      suddenDeathMultiplier: 1,
      reactionPathPicks: null,
      isFollowUpBypass: true,
      execution: {
        rootSkillId: 'qa_basic',
        resolvedSkill: BASIC,
        source: 'multicast',
      },
    }

    system.applyActionImpact(battle, declared)

    expect(enemyParticipant.entity.currentHp).toBeLessThan(1_000_000)
    expect(onSkillCast).not.toHaveBeenCalled()
  })
})
