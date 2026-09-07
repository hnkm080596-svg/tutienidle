import { describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import type { Stage } from '../stage/Stage'

function stageFixture(id: string, enemyId: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

describe('GameManager — stage restart clears stale Action Playback pending state (Defect Task 6)', () => {
  it('startStage() resets pendingReadyActor/pendingDeclaredAction/pendingImpact', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])

    const enemyA = defineEnemy({
      id: 'restart_dummy_a', name: 'Dummy A', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const enemyB = defineEnemy({
      id: 'restart_dummy_b', name: 'Dummy B', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    gameManager.registerEnemyTemplates([enemyA, enemyB])
    const stageA = stageFixture('restart_stage_a', 'restart_dummy_a')
    const stageB = stageFixture('restart_stage_b', 'restart_dummy_b')
    gameManager.registerStages([stageA, stageB])
    gameManager.setActivePlayer(player)

    expect(gameManager.startStage(player, stats, stageA, false)).toBe(true)

    gameManager.setPresentationActive(true)

    // Intro 20 ticks (2026-09-07 plan Task 4) + countdown 30 ticks.
    for (let i = 0; i < INTRO_TOTAL_TICKS + 30; i++) {
      gameManager.update(0.1)
    }

    // Fighting reached — run battle A to victory with presentation still on:
    // a pending phase forms each time an actor becomes ready (Action Playback
    // 5-phase machine); the test drives the 3 acknowledgements (like Phaser
    // would) then lets ticks continue, until the victory terminal fires and
    // stopRepeat releases the StageManager slot.
    for (let i = 0; i < 3000 && gameManager.getTurnBattle()?.state === 'fighting'; i++) {
      gameManager.update(0.1)

      if (gameManager.isActionPlaybackWaiting()) {
        gameManager.acknowledgeTurnReady()
        gameManager.acknowledgeActionImpact()
        gameManager.acknowledgeActionComplete()
      }
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')

    // One more tick: grantTurnBattleRewards()'s victory terminal (incl.
    // stopRepeat releasing the StageManager slot) runs inside the fixed-step
    // loop AFTER the turn that flipped state to victory.
    gameManager.update(0.1)

    // NOW a fresh stage — stale pending fields (if any survived the victory
    // terminal) would leak into battle B. startStage resets them (Defect
    // Task 6) so the new battle starts clean.
    expect(gameManager.startStage(player, stats, stageB, false)).toBe(true)

    expect(gameManager.isActionPlaybackWaiting()).toBe(false)
  })
})