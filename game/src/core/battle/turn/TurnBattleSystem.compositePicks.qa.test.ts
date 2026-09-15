import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'

// AR-18 QA Probe:
// Generic composite actions must execute based on declarative compositePicks
// configuration on TurnSkillDefinition, without checking hardcoded content IDs.

const ELEMENTAL_BASIC_A: TurnSkillDefinition = {
  id: 'basic_a',
  cooldownTurns: 0,
  damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'fire', ratio: 1 }] },
  targeting: { shape: 'single' },
}

const ELEMENTAL_BASIC_B: TurnSkillDefinition = {
  id: 'basic_b',
  cooldownTurns: 0,
  damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'water', ratio: 1 }] },
  targeting: { shape: 'single' },
}

function makeEntity(id: string): CombatEntity {
  // M8 flake fix — stats.maxHp must agree with the 1M currentHp/maxHp
  // fixture below: refreshParticipantStats clamps currentHp to the
  // EFFECTIVE maxHp, so the old default (100) silently turned this
  // "immortal" target into a 100-hp one that a random ~5% crit (143)
  // killed, dropping the second composite pick's hit (~2-5% flake).
  const stats = createBaseStats({ might: 100, accuracyRating: 9999, evasionRate: 0, maxHp: 1_000_000 })
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
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

describe('AR-18: Generic composite skill policy', () => {
  it('executes composite picks for a skill with compositePicks policy and an arbitrary ID', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const pool = [ELEMENTAL_BASIC_A, ELEMENTAL_BASIC_B]

    const system = new TurnBattleSystem(
      combat,
      10,
      undefined,
      undefined,
      pool, // reactionPathPool
    )

    const player = makeEntity('player')
    const enemy = makeEntity('enemy')
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    // A custom skill ID that is NOT REACTION_PATH_SPECIAL_ID
    const customCompositeSkill: TurnSkillDefinition = {
      id: 'custom_composite_skill_999',
      cooldownTurns: 2,
      compositePicks: { poolType: 'reaction_path', count: 2 },
      targeting: { shape: 'single' },
    }

    playerP.basic = customCompositeSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const hits: Array<{ damageType: string }> = []
    eventBus.on<{ damageType: string }>('damage', (e) => hits.push(e))

    system.resolveNextStep(battle)

    // Should have picked both elemental skills from pool and executed 2 hits.
    expect(hits).toHaveLength(2)
  })
})
