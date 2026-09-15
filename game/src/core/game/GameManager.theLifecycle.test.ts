import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer, resetBattleScopedResources, playerToCombatEntity } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

// Phap Tu Reimagined Task 8 (INV-14) — BREAKING LIFECYCLE CHANGE:
// currentThe is strictly battle-instance scoped. It resets to 0 on
// every fresh participant construction AND on every auto-repeat
// restartTurnBattleCycle (which reuses previous.players wholesale —
// "HP/resources carry over" does NOT include the The pool anymore).
// The reset is path-blind: Bat Kiem or any path sharing currentThe
// follows the identical contract. No PlayerData persistence, no
// cross-cycle carry.

function combatEntity(currentThe: number): CombatEntity {
  const stats = createBaseStats({})

  return {
    id: 'entity',
    name: 'entity',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentThe,
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

describe('resetBattleScopedResources (Task 8)', () => {
  it('zeroes currentThe on a carried-over entity', () => {
    const entity = combatEntity(80)

    resetBattleScopedResources(entity)

    expect(entity.currentThe).toBe(0)
  })

  it('playerToCombatEntity always builds a zeroed The pool', () => {
    const player = createDefaultPlayer()
    const entity = playerToCombatEntity(player, createBaseStats({}))

    expect(entity.currentThe).toBe(0)
  })
})

describe('auto-repeat cycle resets currentThe (INV-14)', () => {
  it('a player entity carrying 80 The into restartTurnBattleCycle starts the new cycle at 0', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const bossTemplate = defineEnemy({
      id: 'the_reset_boss', name: 'Reset Boss', level: 1, realmId: 'mortal', lane: 'ground', isBoss: true,
      statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    const stage: Stage = {
      id: 'the_reset_stage', name: 'Reset Stage', description: '',
      floor: 10, bossEnemyId: 'the_reset_boss',
      enemyPool: [{ enemyId: 'the_reset_boss', weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }

    gameManager.catalogOps.registerEnemyTemplates([bossTemplate])
    gameManager.catalogOps.registerStages([stage])

    const player = createDefaultPlayer()
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    // Simulate a finished pool: the entity object is carried wholesale
    // into the next cycle, so without the reset this 80 would leak.
    const carriedEntity = gameManager.getTurnBattle()!.players[0]!.entity
    carriedEntity.currentThe = 80

    // Drive the real update loop until the boss dies and the repeat
    // cycle rebuilds the battle (second spawn = cycle 2).
    const seenEnemyIds: string[] = []
    for (let i = 0; i < 1000 && seenEnemyIds.length < 2; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      for (const enemy of gameManager.getTurnBattle()?.enemies ?? []) {
        if (!seenEnemyIds.includes(enemy.entity.id)) {
          seenEnemyIds.push(enemy.entity.id)
        }
      }
    }

    expect(seenEnemyIds.length).toBeGreaterThanOrEqual(2)

    // Same entity object, new battle-instance scope — The is gone.
    expect(gameManager.getTurnBattle()!.players[0]!.entity).toBe(carriedEntity)
    expect(carriedEntity.currentThe).toBe(0)
  })
})
