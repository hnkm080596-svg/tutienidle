import { describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import type { Stage } from '../stage/Stage'

// Intro/transition phase (plan 2026-09-07 Task 4): a fresh battle starts in
// the 'intro' phase (curtain + zone/stage reveal, INTRO_TOTAL_TICKS pacing
// ticks) BEFORE the existing 3-2-1 countdown. Mirrors the fixture style of
// GameManager.stageRestart.test.ts - no parallel fixture builder.
function stageFixture(id: string, enemyId: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function buildStartedGameManager(): GameManager {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()
  const stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])

  const enemy = defineEnemy({
    id: 'intro_dummy', name: 'Intro Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  gameManager.registerEnemyTemplates([enemy])
  gameManager.registerStages([stageFixture('intro_stage', 'intro_dummy')])
  gameManager.setActivePlayer(player)

  expect(gameManager.startStage(player, stats, gameManager.getStage('intro_stage')!, false)).toBe(true)

  return gameManager
}

describe('GameManager - intro/transition phase before countdown (plan 2026-09-07 Task 4)', () => {
  it('starts a new battle in the intro phase before countdown', () => {
    const gameManager = buildStartedGameManager()

    expect(gameManager.getTurnBattle()?.state).toBe('intro')
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(INTRO_TOTAL_TICKS)
  })

  it('advances from intro to countdown after exactly INTRO_TOTAL_TICKS ticks', () => {
    const gameManager = buildStartedGameManager()

    // INTRO_TOTAL_TICKS - 1 ticks: still in intro (last decrement pending).
    for (let i = 0; i < INTRO_TOTAL_TICKS - 1; i++) {
      gameManager.update(0.1)

      expect(gameManager.getTurnBattle()?.state).toBe('intro')
    }

    // The final tick flips intro -> countdown.
    gameManager.update(0.1)

    expect(gameManager.getTurnBattle()?.state).toBe('countdown')
  })

  it('keeps the battle paused for the whole intro - no pacing ticks reach the engine', () => {
    const gameManager = buildStartedGameManager()

    for (let i = 0; i < INTRO_TOTAL_TICKS; i++) {
      gameManager.update(0.1)
    }

    const battle = gameManager.getTurnBattle()

    // Intro must not advance combat: no turn elapsed, gauges untouched
    // (participants start at 0 gauge and only tickPacing advances them).
    expect(battle?.state).toBe('countdown')
    expect(battle?.totalTurnsElapsed ?? 0).toBe(0)
    expect(battle?.players.every((participant) => participant.actionGauge === 0)).toBe(true)
  })
})
