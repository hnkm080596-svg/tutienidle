import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'

// Combat speed gauge + round indicator (2026-09-12) — the round-limit chip
// needs the stage THAT LAUNCHED the current battle, not the UI's
// selectedStageId (which can point at a different stage). The accessor must
// also not leak a stale stage into a later non-stage battle (tribulation
// uses startBattleWithPlayer without any stage).
function stageFixture(id: string, enemyId: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function buildGameManager() {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100  })

  const enemy = defineEnemy({
    id: 'stage_probe', name: 'Stage Probe', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })

  gameManager.catalogOps.registerEnemyTemplates([enemy])
  gameManager.catalogOps.registerStages([stageFixture('bound_stage', 'stage_probe')])
  gameManager.setActivePlayer(player)

  return { gameManager, player, enemy }
}

describe('GameManager.getActiveTurnBattleStage', () => {
  it('returns null before any stage battle has been launched', () => {
    const { gameManager } = buildGameManager()

    expect(gameManager.getActiveTurnBattleStage()).toBeNull()
  })

  it('returns the stage that launched the current stage battle', () => {
    const { gameManager, player } = buildGameManager()

    expect(gameManager.turnBattleOps.startStage(player, gameManager.catalogOps.getStage('bound_stage')!, false)).toBe(true)
    expect(gameManager.getActiveTurnBattleStage()?.id).toBe('bound_stage')
  })

  it('does not leak a stale stage into a later non-stage battle', () => {
    const { gameManager, player, enemy } = buildGameManager()

    expect(gameManager.turnBattleOps.startStage(player, gameManager.catalogOps.getStage('bound_stage')!, false)).toBe(true)
    expect(gameManager.getActiveTurnBattleStage()?.id).toBe('bound_stage')

    // Tribulation-style battle: launched without a stage — the previous
    // stage binding must be dropped or the round chip would show that
    // stage's perfect-clear limit during a battle it does not apply to.
    gameManager.startBattleWithPlayer(player, enemy)

    expect(gameManager.getActiveTurnBattleStage()).toBeNull()
  })
})
