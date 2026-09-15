import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats, createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

function _debugEntity(): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, criticalRate: 0, blockChance: 0, might: 100 })
  return {
    id: 'dbg_player', name: 'Dbg', type: 'player', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 0,
    currentSwordIntent: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
  } as CombatEntity
}

// Combat left the world tick (2026-09-10 combat-turn-mechanism spec): the
// battle runs on its own CombatClock, so the calls that used to drive it
// through update() step a ManualClockSource instead. update() still owns
// cultivation, production and auto-farm and keeps its own cadence.
describe('debug turn battle rewards', () => {
  it('kill enemy manually -> grantTurnBattleRewards fires', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })
    const enemy = defineEnemy({
      id: 'dbg_enemy',
      name: 'Dbg Enemy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 5, spiritStone: 2 },
    })

    gameManager.startBattleWithPlayer(player, enemy)
    combatSource.advance(COMBAT_STEP_SECONDS)

    const tb = gameManager.getTurnBattle()
    console.log('turnBattle null?', tb === null, 'enemies=', tb?.enemies.length, 'state=', tb?.state)
    console.log('enemySystem has?', gameManager.enemySystem.get(tb?.enemies[0]?.entity.id ?? 'x') !== undefined)
    console.log('receiver/player session — battleLoot summary trước kill:', JSON.stringify(gameManager.getBattleRewardSummary()))
    if (tb && tb.enemies[0]) {
      tb.enemies[0].entity.currentHp = 0
      tb.enemies[0].entity.alive = false
    }

    combatSource.advance(COMBAT_STEP_SECONDS)

    const tb2 = gameManager.getTurnBattle()
    console.log('after update state=', tb2?.state, 'player.skillInsight=', player.skillInsight)
    console.log('summary=', JSON.stringify(gameManager.getBattleRewardSummary()))

    expect(player.skillInsight).toBeGreaterThan(0)
  })
})
