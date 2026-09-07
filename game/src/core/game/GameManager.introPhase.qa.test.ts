import { describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import type { Stage } from '../stage/Stage'

// QA quick-mode reproduction probes for the intro phase (2026-09-07 Task 4).
// Attack operators: timing boundary (exact tick threshold), interruption
// (abandon mid-intro), stale state (startStage during intro), determinism
// (fixed deltas), repeat (double startStage), catch-up (large delta).
function stageFixture(id: string, enemyId: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function buildGameManager(): { gameManager: GameManager; player: ReturnType<typeof createDefaultPlayer> } {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()
  const stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])

  const enemy = defineEnemy({
    id: 'qa_intro_dummy', name: 'QA Intro Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  gameManager.registerEnemyTemplates([enemy])
  gameManager.registerStages([stageFixture('qa_intro_stage', 'qa_intro_dummy')])
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

describe('QA quick — intro phase adversarial probes (2026-09-07 Task 4)', () => {
  it('timing boundary: one extra tick past INTRO_TOTAL_TICKS stays countdown (no double flip, no skip into fighting)', () => {
    const { gameManager, player } = buildGameManager()

    expect(gameManager.startStage(player, stats0(player), gameManager.getStage('qa_intro_stage')!, false)).toBe(true)

    for (let i = 0; i < INTRO_TOTAL_TICKS; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('countdown')
    expect(gameManager.getTurnBattle()?.countdownTurnsRemaining).toBe(30)

    // One MORE tick: countdown decrements once, state stays 'countdown'.
    gameManager.update(0.1)

    expect(gameManager.getTurnBattle()?.state).toBe('countdown')
    expect(gameManager.getTurnBattle()?.countdownTurnsRemaining).toBe(29)
  })

  it('interruption: abandoning mid-intro terminals the battle and frees the stage slot immediately', () => {
    const { gameManager, player } = buildGameManager()

    expect(gameManager.startStage(player, stats0(player), gameManager.getStage('qa_intro_stage')!, false)).toBe(true)

    gameManager.update(0.1)
    gameManager.update(0.1)

    expect(gameManager.getTurnBattle()?.state).toBe('intro')

    expect(gameManager.abandonBattle()).toBe(true)
    expect(gameManager.getTurnBattle()?.state).toBe('defeat')
    expect(gameManager.getStageProgress()).toBeNull()

    // Stage slot must be released — refight starts cleanly.
    expect(gameManager.startStage(player, stats0(player), gameManager.getStage('qa_intro_stage')!, false)).toBe(true)
    expect(gameManager.getTurnBattle()?.state).toBe('intro')
  })

  it('repeat: startStage while a battle is mid-intro is rejected (pre-existing single-slot StageManager contract) and the intro battle keeps running', () => {
    const { gameManager, player } = buildGameManager()

    expect(gameManager.startStage(player, stats0(player), gameManager.getStage('qa_intro_stage')!, false)).toBe(true)

    // Partially drain intro.
    gameManager.update(0.1)
    gameManager.update(0.1)
    gameManager.update(0.1)

    // Single-slot StageManager rejects a second start while one is active.
    // Pre-existing contract: identical rejection applied during the old
    // countdown phase (StageManager.start L23-26, untouched by Task 4).
    expect(gameManager.startStage(player, stats0(player), gameManager.getStage('qa_intro_stage')!, false)).toBe(false)

    // The original battle is untouched and still in intro.
    expect(gameManager.getTurnBattle()?.state).toBe('intro')
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(INTRO_TOTAL_TICKS - 3)
  })

  it('catch-up: a large delta (2s, exactly the intro length) advances intro to countdown in ONE update call', () => {
    const { gameManager, player } = buildGameManager()

    expect(gameManager.startStage(player, stats0(player), gameManager.getStage('qa_intro_stage')!, false)).toBe(true)

    // BATTLE_MAX_CATCHUP_SECONDS is 5s per the fixed-step catch-up contract;
    // a 2s lumped delta must be sliced into 20 fixed 0.1s steps internally.
    gameManager.update(2)

    expect(gameManager.getTurnBattle()?.state).toBe('countdown')
    expect(gameManager.getTurnBattle()?.countdownTurnsRemaining).toBe(30)
  })
})

function stats0(player: ReturnType<typeof createDefaultPlayer>) {
  return calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])
}
