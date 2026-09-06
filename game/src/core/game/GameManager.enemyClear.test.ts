import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import type { EnemyDefinition } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import type { Stage } from '../stage/Stage'
import { SKILLS } from '../../data/skill/Skills'
import { SPIRIT_STONE_MATERIAL } from '../material/SpiritStoneMaterial'

// Audit 2026-08-31 (M1) — EnemyManager.add() chỉ push, remove duy nhất
// qua despawn (quái CHẾT trong processDefeatedEnemies). Trận bị BỎ
// (abandonBattle) không bao giờ đi qua victory flow → living enemies +
// pending spawns (telegraph) bị bỏ lại orphan VỊNH VIỄN trong
// EnemyManager — mỗi lần bỏ trận leak trọn một handful enemy object đầy
// đủ (stats, rewards, phases). EnemyManager.clear() có sẵn nhưng 0
// caller trước fix này.
//
// NGUYÊN TẮC: KHÔNG clear trong victory path — StageWave auto-repeat
// spawn quái MỚI qua enemySystem.spawn NGAY sau victory (battle vẫn giữ
// nguyên khi restartCycle); clear sai chỗ sẽ xóa quái của trận kế.

const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
  attackRangeRanks: 999999,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0 }

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
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
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }
}

describe('abandonBattle — EnemyManager cleanup (audit 2026-08-31, M1)', () => {
  it('abandon giữa trận KHÔNG để enemy sót trong EnemyManager (chống leak mỗi trận bỏ)', () => {
    const gameManager = new GameManager()
    const player = createPlayer()
    const enemy = defineEnemy(createEnemyDefinition())

    gameManager.startBattle(player, enemy)

    // Quái đầu spawn NGAY trong startBattle (enemySystem.spawn trước khi
    // queue telegraph) — đã nằm trong EnemyManager với alive=true.
    expect(gameManager.enemySystem.getAliveEnemies().length).toBeGreaterThan(0)

    expect(gameManager.abandonBattle()).toBe(true)

    // Sau fix: living enemies + pending spawns của trận bị bỏ KHÔNG còn
    // sót lại orphan trong EnemyManager.
    expect(gameManager.enemySystem.getAliveEnemies()).toHaveLength(0)
    expect(gameManager.enemyManager.getAll()).toHaveLength(0)
  })

  it('victory KHÔNG clear đột ngột — enemy chết dần qua despawn flow bình thường, không sót', () => {
    const gameManager = new GameManager()

    // Pattern GameManager.repeatStage.test.ts — Linh Thạch credit vào
    // MaterialBag cần registry; skill Trảm chiếm slot 0 để player đánh.
    gameManager.registerMaterials([SPIRIT_STONE_MATERIAL])
    const enemy = defineEnemy({
      id: 'victory_dummy',
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
      id: 'victory_stage',
      name: 'Victory Stage',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.registerSkillTemplates(SKILLS)
    expect(gameManager.skillSystem.learn(SKILLS[0]!)).toBe(true)
    expect(gameManager.skillSystem.equipToSlot('tram', 0)).toBe(true)

    // KHÔNG auto-repeat — mục tiêu là state 'victory' cuối cùng.
    expect(gameManager.startStage(player, stats, stage)).toBe(true)
    expect(gameManager.enemySystem.getAliveEnemies().length).toBeGreaterThan(0)

    // Đập quái tới victory (pattern update loop của repeatStage test).
    let reachedVictory = false

    for (let index = 0; index < 300; index++) {
      gameManager.update(0.05)

      if (gameManager.getBattle()?.state === 'victory') {
        reachedVictory = true

        break
      }
    }

    expect(reachedVictory).toBe(true)

    // Enemy TỰ NHIÊN trống qua despawn flow (processDefeatedEnemies cấp
    // thưởng rồi despawn TỪNG quái chết) — victory path không cần và
    // không được clear đột ngột (auto-repeat spawn trận mới ngay sau).
    expect(gameManager.enemySystem.getAliveEnemies()).toHaveLength(0)
    expect(gameManager.enemyManager.getAll()).toHaveLength(0)
  })
})
