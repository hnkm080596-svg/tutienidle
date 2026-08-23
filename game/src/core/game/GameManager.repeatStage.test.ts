import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import type { BattleRewardParticleEvent } from '../battle/BattleEvents'

describe('GameManager continuous repeat stage', () => {
  it('starts another spawn cycle in the same battle without restoring the player', () => {
    const gameManager = new GameManager()
    const enemy = defineEnemy({
      id: 'repeat_dummy',
      name: 'Repeat Dummy',
      level: 1,
      realmId: 'pham_nhan',
      lane: 'ground',
      statsInput: {
        maxHp: 1,
        attack: 0,
        attackSpeed: 1,
        movementSpeed: 200,
        attackRange: 20,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { experience: 0, cultivation: 0, spiritStone: 1 },
    })
    const stage: Stage = {
      id: 'repeat_stage',
      name: 'Repeat Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1,
      spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.registerSkillTemplates(SKILLS)
    expect(gameManager.skillSystem.learn(SKILLS[0]!)).toBe(true)
    expect(gameManager.skillSystem.equipWithoutSlot('basic_strike')).toBe(true)
    const rewardParticles: BattleRewardParticleEvent[] = []
    gameManager.eventBus.on<BattleRewardParticleEvent>('reward_particle', event => rewardParticles.push(event))

    expect(gameManager.startStage(player, stats, stage, true)).toBe(true)

    for (let index = 0; index < 300 && player.spiritStone < 2; index++) {
      gameManager.update(0.05)
    }

    expect(player.spiritStone).toBeGreaterThanOrEqual(2)
    expect(gameManager.getBattle()?.state).toBe('fighting')
    expect(gameManager.getStageProgress()).not.toBeNull()
    expect(player.completedStageIds).toContain(stage.id)
    expect(rewardParticles.filter(event => event.kind === 'currency')).toHaveLength(2)
  })

  it('can abandon during countdown and releases the active stage immediately', () => {
    const gameManager = new GameManager()
    const enemy = defineEnemy({
      id: 'countdown_dummy', name: 'Countdown Dummy', level: 1, realmId: 'pham_nhan', lane: 'ground',
      statsInput: { maxHp: 10, attack: 0, attackSpeed: 1, movementSpeed: 1, attackRange: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { experience: 0, cultivation: 0, spiritStone: 0 },
    })
    const stage: Stage = {
      id: 'countdown_stage', name: 'Countdown Stage', description: '', floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }], totalEnemyCount: 1, spawnIntervalSeconds: 1,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, [])

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])

    expect(gameManager.startStage(player, stats, stage)).toBe(true)
    expect(gameManager.getBattle()?.state).toBe('countdown')
    expect(gameManager.abandonBattle()).toBe(true)
    expect(gameManager.getBattle()?.state).toBe('defeat')
    expect(gameManager.getStageProgress()).toBeNull()
    expect(gameManager.startStage(player, stats, stage)).toBe(true)
  })
})
