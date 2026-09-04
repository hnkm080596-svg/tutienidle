import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

function debugEntity(): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0, attack: 100 }
  return {
    id: 'dbg_player', name: 'Dbg', type: 'player', baseStats: stats, stats,
    currentHp: 100, maxHp: 100, currentMp: 0,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
  } as CombatEntity
}

describe('debug turn battle rewards', () => {
  it('kill enemy manually -> grantTurnBattleRewards fires', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])
    const enemy = defineEnemy({
      id: 'dbg_enemy',
      name: 'Dbg Enemy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 5, spiritStone: 2 },
    })

    gameManager.startBattleWithPlayer(player, stats, enemy)
    gameManager.update(0.1)

    const tb = gameManager.getTurnBattle()
    console.log('turnBattle null?', tb === null, 'enemies=', tb?.enemies.length, 'state=', tb?.state)
    console.log('enemySystem has?', gameManager.enemySystem.get(tb?.enemies[0]?.entity.id ?? 'x') !== undefined)
    console.log('receiver/player session — battleLoot summary trước kill:', JSON.stringify(gameManager.getBattleRewardSummary()))
    if (tb && tb.enemies[0]) {
      tb.enemies[0].entity.currentHp = 0
      tb.enemies[0].entity.alive = false
    }

    gameManager.update(0.1)

    const tb2 = gameManager.getTurnBattle()
    console.log('after update state=', tb2?.state, 'player.skillInsight=', player.skillInsight)
    console.log('summary=', JSON.stringify(gameManager.getBattleRewardSummary()))

    expect(player.skillInsight).toBeGreaterThan(0)
  })
})
