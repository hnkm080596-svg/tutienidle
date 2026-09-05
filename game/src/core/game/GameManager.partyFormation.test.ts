import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 100, criticalRate: 0 }

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test', name: 'Basic', description: '', type: 'active', level: 1, maxLevel: 10,
    cooldown: 0, remainingCooldown: 0, cost: 0, target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' }, resourceType: 'none',
    unlocked: true, equipped: true, loadoutSlot: 0, loadoutSlots: [0],
  }
}

function createDummy() {
  return defineEnemy({
    id: 'formation_dummy', name: 'Formation Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('GameManager.buildTurnBattle — reads DEFAULT_PARTY_FORMATION when no formation is configured', () => {
  it('places the single player participant at HERO_LANE_INDEX/HERO_COLUMN, id "player"', () => {
    const gameManager = new GameManager()
    const player = createPlayer()

    gameManager.registerSkillTemplates([createBasicSkill()])
    gameManager.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)
    gameManager.startBattle(player, createDummy())

    const battle = gameManager.getTurnBattle()!

    expect(battle.players).toHaveLength(1)
    expect(battle.players[0]!.id).toBe('player')
    expect(battle.players[0]!.entity.row).toBe(HERO_LANE_INDEX)
    expect(battle.players[0]!.entity.x).toBe(HERO_COLUMN)
  })
})
