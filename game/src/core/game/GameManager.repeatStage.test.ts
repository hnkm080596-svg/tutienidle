import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'
import type { BattleRewardParticleEvent } from '../battle/BattleEvents'

describe('GameManager continuous repeat stage', () => {
  it('starts another spawn cycle in the same battle without restoring the player', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    // Plan Workstream F — Linh Thạch credit vào MaterialBag, cần registry.
    gameManager.catalogOps.registerMaterials([SPIRIT_STONE_MATERIAL])
    const enemy = defineEnemy({
      id: 'repeat_dummy',
      name: 'Repeat Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1,
        attack: 0,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 1 },
    })
    const stage: Stage = {
      id: 'repeat_stage',
      name: 'Repeat Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    expect(gameManager.skillSystem.learn(SKILLS[0]!)).toBe(true)
    // Execution policy rework (plan §8.6) — Trảm chiếm slot mặc định 0.
    expect(gameManager.skillSystem.equipToSlot('tram', 0)).toBe(true)
    const rewardParticles: BattleRewardParticleEvent[] = []
    gameManager.eventBus.on<BattleRewardParticleEvent>('reward_particle', event => rewardParticles.push(event))

    // Slice 6 cutover: turn engine pacing đọc battle-context qua activePlayer
    // — tương đương boot flow thật.
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stats, stage, true)).toBe(true)

    // Plan Workstream F — Linh Thạch credit vào MaterialBag.
    const spiritStoneBalance = () => gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL.id)

    for (let index = 0; index < 300 && spiritStoneBalance() < 2; index++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(spiritStoneBalance()).toBeGreaterThanOrEqual(2)
    expect(gameManager.getBattle()?.state).toBe('fighting')
    expect(gameManager.turnBattleOps.getStageProgress()).not.toBeNull()
    expect(player.completedStageIds).toContain(stage.id)
    // Drop-system (2026-09-12): mortal table pays 1-2 stone per kill, so
    // kill count no longer equals particle count — >=1 proves the
    // currency flow still fires inside the repeated cycle.
    expect(rewardParticles.filter(event => event.kind === 'currency').length).toBeGreaterThanOrEqual(1)
  })

  it('can abandon during intro and releases the active stage immediately', () => {
    const gameManager = new GameManager()
    const enemy = defineEnemy({
      id: 'countdown_dummy', name: 'Countdown Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 10, attack: 0, attackSpeed: 1, attackRangeRanks: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage: Stage = {
      id: 'countdown_stage', name: 'Countdown Stage', description: '', floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }], totalEnemyCount: 1, waves: [1], spawnIntervalSeconds: 1,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats(player.baseStats, [])

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])

    expect(gameManager.turnBattleOps.startStage(player, stats, stage)).toBe(true)
    // Intro (2026-09-07 plan Task 4) is the first wait phase - abandoning
    // during it keeps the exact same semantics the countdown phase had.
    expect(gameManager.getBattle()?.state).toBe('intro')
    expect(gameManager.abandonBattle()).toBe(true)
    expect(gameManager.getBattle()?.state).toBe('defeat')
    expect(gameManager.turnBattleOps.getStageProgress()).toBeNull()
    expect(gameManager.turnBattleOps.startStage(player, stats, stage)).toBe(true)
  })
})
