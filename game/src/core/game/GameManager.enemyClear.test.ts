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
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    // Pattern GameManager.repeatStage.test.ts — Linh Thạch credit vào
    // MaterialBag cần registry; skill Trảm chiếm slot 0 để player đánh.
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
    expect(gameManager.progressionOps.learnSkill('tram', player)).toBe(true)
    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'tram')).toBe(true)

    // KHÔNG auto-repeat — mục tiêu là state 'victory' cuối cùng.
    expect(gameManager.turnBattleOps.startStage(player, stage)).toBe(true)
    // Turn-Based Wave Redesign (2026-09-06) — bootstrap enemy bị discard
    // (spawn đồng loạt qua telegraph): ngay sau startStage CHƯA có enemy
    // sống — pending telegraph materialize ở các tick kế tiếp.
    expect(gameManager.enemySystem.getAliveEnemies().length).toBe(0)

    // Đập quái tới victory (pattern update loop của repeatStage test).
    let reachedVictory = false

    for (let index = 0; index < 300; index++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      if (gameManager.getTurnBattle()?.state === 'victory') {
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

// F-BX-94 (soak beta-release-exhaustive-2026-09-29): a battle ending in
// 'defeat' never ran a roster teardown - only abandonBattle and the
// live-battle replacement paths did - so each defeat permanently leaked
// its surviving enemies (~3.1/battle over the soak). The clear now lives
// in clearCycleEntryState, which every entry path funnels through BEFORE
// new spawns: terminal coverage comes for free at the next cycle while
// victory's auto-repeat chain keeps its already-spawned enemies.
describe('cycle-entry roster teardown (F-BX-94)', () => {
  function fightUntil(combatSource: ManualClockSource, predicate: () => boolean, label: string) {
    for (let i = 0; i < 3000; i++) {
      if (predicate()) return
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    throw new Error(`${label}: predicate not reached within 3000 combat steps`)
  }

  function bossTemplate(id: string): EnemyDefinition {
    return {
      id,
      name: id,
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1_000_000,
        might: 9_999,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    }
  }

  // A raw entity that dies in one hit - drives a REAL natural defeat
  // (the engine decides), not the ops-forced abandon path.
  function weakPlayer(): CombatEntity {
    const stats = createBaseStats({ maxHp: 5, might: 0, speed: 1, criticalRate: 0 })
    return { ...createPlayer(), baseStats: stats, stats, currentHp: 5, maxHp: 5 }
  }

  it('back-to-back natural defeats leave EnemyManager.getAll() bounded to the current battle', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const survivorIds: string[] = []

    for (let battleIndex = 0; battleIndex < 3; battleIndex++) {
      gameManager.startBattle(weakPlayer(), defineEnemy(bossTemplate(`soak_boss_${battleIndex}`)))
      const battle = gameManager.getTurnBattle()!
      fightUntil(combatSource, () => battle.state === 'defeat', `defeat ${battleIndex}`)

      // The only legitimate residue is THIS battle's own surviving
      // enemies - pre-fix each defeat's survivors stayed in the roster
      // forever, so the count grew monotonically.
      const roster = gameManager.enemyManager.getAll()
      const liveIds = new Set(battle.enemies.map((enemy) => enemy.entity.id))
      expect(roster.every((enemy) => liveIds.has(enemy.id))).toBe(true)
      expect(roster).toHaveLength(
        battle.enemies.filter((enemy) => enemy.entity.alive).length,
      )
      for (const staleId of survivorIds) {
        expect(liveIds.has(staleId)).toBe(false)
      }
      survivorIds.push(...roster.map((enemy) => enemy.id))
    }
  })

  it('mid-fight replacement clears the outgoing roster at cycle entry', () => {
    const gameManager = new GameManager()

    gameManager.startBattle(createPlayer(), defineEnemy(bossTemplate('outgoing_boss')))
    const outgoingIds = gameManager.enemyManager.getAll().map((enemy) => enemy.id)
    expect(outgoingIds.length).toBeGreaterThan(0)

    // Replacing a live battle terminalizes the outgoing one, then the
    // shared cycle-entry teardown runs before the new spawn.
    gameManager.startBattle(createPlayer(), defineEnemy(bossTemplate('incoming_boss')))

    const battle = gameManager.getTurnBattle()!
    const liveIds = new Set(battle.enemies.map((enemy) => enemy.entity.id))
    const roster = gameManager.enemyManager.getAll()
    expect(roster.every((enemy) => liveIds.has(enemy.id))).toBe(true)
    expect(outgoingIds.some((id) => liveIds.has(id))).toBe(false)
  })
})
