import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Phase A0 (2026-09-07) — CombatTopBar's "alive" enemy count used to read
// the legacy battleSystem's enemy list (always empty during real
// turn-based gameplay), so the HUD counter was stuck at 0 for the whole
// fight. After the fix, GameManager.getStageProgress() composes `alive`
// from the LIVE turnBattle.enemies (filtering on entity.alive). This
// suite proves the live count with real production wiring.

function makeEnemy(id: string, maxHp: number) {
  return defineEnemy({
    id,
    name: id,
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp,
      attack: 0,
      attackSpeed: 1,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function makeStage(id: string, enemyId: string, total: number): Stage {
  return {
    id,
    name: id,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: total,
    waves: [total],
    spawnIntervalSeconds: 0,
  }
}

describe('getStageProgress alive count (A0 fix)', () => {
  it('reflects the live turn-based enemy count, not the empty legacy one', () => {
    const gameManager = new GameManager()

    const enemy = makeEnemy('a0_progress_dummy', 500)
    const stage = makeStage('a0_progress_stage', enemy.id, 2)

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])

    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 0 }, [])

    gameManager.setActivePlayer(player)
    expect(gameManager.startStage(player, stats, stage, false)).toBe(true)

    // Both enemies of the single wave materialize through the turn-based
    // telegraph; drive ticks until the arena is fully populated.
    for (let i = 0; i < 60 && gameManager.getTurnBattle()!.enemies.length < 2; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.getTurnBattle()!.enemies.length).toBe(2)

    // The core A0 assertion: alive is NOT the legacy 0 while enemies are
    // alive, and equals the count of living turn-based enemies.
    const progress = gameManager.getStageProgress()
    expect(progress).not.toBeNull()
    expect(progress!.alive).toBe(2)
    expect(progress!.spawned).toBe(2)
    expect(progress!.total).toBe(2)

    // Kill one enemy through the real production damage path and confirm
    // the HUD count tracks the LIVE pool, not a stale list.
    const firstEnemy = gameManager.getTurnBattle()!.enemies[0]!
    gameManager.combatSystem.applyDirectDamage(firstEnemy.entity, 999_999, 'player')

    const after = gameManager.getStageProgress()
    expect(after!.alive).toBe(1)
    expect(gameManager.getTurnBattle()!.enemies.filter((e) => e.entity.alive)).toHaveLength(1)
  })
})
