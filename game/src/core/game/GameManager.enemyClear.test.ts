import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import type { EnemyDefinition } from '../enemy/Enemy'
import { createBaseStats, asBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { createDefaultPlayer } from '../player/Player'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'

// Audit 2026-08-31 (M1) - EnemyManager.add() chi push, remove duy nhat
// qua despawn (quai CHET trong processDefeatedEnemies). Tran bi BO
// (abandonBattle) khong bao gio di qua victory flow -> living enemies +
// pending spawns (telegraph) bi bo lai orphan VINH VIEN trong
// EnemyManager - moi lan bo tran leak tron mot handful enemy object day
// du (stats, rewards, phases). EnemyManager.clear() co san nhung 0
// caller truoc fix nay.
//
// NGUYEN TAC: KHONG clear trong victory path - StageWave auto-repeat
// spawn quai MOI qua enemySystem.spawn NGAY sau victory (battle van giu
// nguyen khi restartCycle); clear sai cho se xoa quai cua tran ke.

const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 0 })

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

function createEnemyDefinition(): EnemyDefinition {
  return {
    id: 'abandon_dummy',
    name: 'Bao Cát Bỏ Trận',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: MINIMAL_STATS_INPUT,
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  }
}

describe('abandonBattle — EnemyManager cleanup (audit 2026-08-31, M1)', () => {
  it('abandon giữa trận KHÔNG để enemy sót trong EnemyManager (chống leak mỗi trận bỏ)', () => {
    const gameManager = new GameManager()
    const player = createPlayer()
    const enemy = defineEnemy(createEnemyDefinition())

    gameManager.startBattle(player, enemy)

    // Quai dau spawn NGAY trong startBattle (enemySystem.spawn truoc khi
    // queue telegraph) - da nam trong EnemyManager voi alive=true.
    expect(gameManager.enemySystem.getAliveEnemies().length).toBeGreaterThan(0)

    expect(gameManager.abandonBattle()).toBe(true)

    // Sau fix: living enemies + pending spawns cua tran bi bo KHONG con
    // sot lai orphan trong EnemyManager.
    expect(gameManager.enemySystem.getAliveEnemies()).toHaveLength(0)
    expect(gameManager.enemyManager.getAll()).toHaveLength(0)
  })

  it('victory KHÔNG clear đột ngột — enemy chết dần qua despawn flow bình thường, không sót', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    // Pattern GameManager.repeatStage.test.ts - Linh Thach credit vao
    // MaterialBag can registry; skill Tram chiem slot 0 de player danh.
    gameManager.catalogOps.registerMaterials([SPIRIT_STONE_MATERIAL])
    const enemy = defineEnemy({
      id: 'victory_dummy',
      name: 'Repeat Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 1 },
    })
    const stage: Stage = {
      id: 'victory_stage',
      name: 'Victory Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    expect(gameManager.progressionOps.learnSkill('linh_bao', player)).toBe(true)
    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'linh_bao')).toBe(true)

    // KHONG auto-repeat - muc tieu la state 'victory' cuoi cung.
    expect(gameManager.turnBattleOps.startStage(player, stage)).toBe(true)
    // Turn-Based Wave Redesign (2026-09-06) - bootstrap enemy bi discard
    // (spawn dong loat qua telegraph): ngay sau startStage CHUA co enemy
    // song - pending telegraph materialize o cac tick ke tiep.
    expect(gameManager.enemySystem.getAliveEnemies().length).toBe(0)

    // Dap quai toi victory (pattern update loop cua repeatStage test).
    let reachedVictory = false

    for (let index = 0; index < 300; index++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      if (gameManager.getTurnBattle()?.state === 'victory') {
        reachedVictory = true

        break
      }
    }

    expect(reachedVictory).toBe(true)

    // Enemy TU NHIEN trong qua despawn flow (processDefeatedEnemies cap
    // thuong roi despawn TUNG quai chet) - victory path khong can va
    // khong duoc clear dot ngot (auto-repeat spawn tran moi ngay sau).
    expect(gameManager.enemySystem.getAliveEnemies()).toHaveLength(0)
    expect(gameManager.enemyManager.getAll()).toHaveLength(0)
  })
})
