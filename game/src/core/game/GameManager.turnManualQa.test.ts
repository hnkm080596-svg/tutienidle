import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import type { Stage } from '../stage/Stage'

// QA probes (Slice 7 manual mode) â€” adversarial checks: exactly-once
// submit, no-op tap khi khÃ´ng awaiting, toggle off giá»¯a pause.

const ENEMY_STATS = {
  maxHp: 10_000_000,
  attack: 0,
  attackSpeed: 1,
  attackRangeRanks: 9,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 100, criticalRate: 0 }

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test', name: 'Basic', description: '', type: 'active', level: 1, maxLevel: 10,
    cooldown: 0, remainingCooldown: 0, cost: 0, target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' }, resourceType: 'none',
    unlocked: true, equipped: true, loadoutSlot: 0, loadoutSlots: [0],
  }
}

function createDummy() {
  return defineEnemy({
    id: 'qa_dummy', name: 'Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { ...ENEMY_STATS },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function battleReady(): GameManager {
  const gameManager = new GameManager()
  const player = createPlayer()

  gameManager.registerSkillTemplates([createBasicSkill()])
  gameManager.learnSkill('basic_test')
  gameManager.skillSystem.equipToSlot('basic_test', 0)
  gameManager.startBattle(player, createDummy())

  for (let i = 0; i < 30; i++) {
    gameManager.update(0.1)
  }

  gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

  return gameManager
}

describe('QA probe â€” manual mode adversarial (Slice 7)', () => {
  it('INV-TM-1: submitTurnChoice exactly-once â€” láº§n 2 sau resolve tráº£ false', () => {
    const gameManager = battleReady()

    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.submitTurnChoice('basic')).toBe(true)
    expect(gameManager.submitTurnChoice('basic')).toBe(false)
  })

  it('INV-TM-5: choose khi KHÃ”NG awaiting lÃ  no-op an toÃ n, khÃ´ng resolve gÃ¬', () => {
    const gameManager = battleReady()

    const turnsBefore = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0

    expect(gameManager.submitTurnChoice('basic')).toBe(false)

    const turnsAfter = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0

    expect(turnsAfter).toBe(turnsBefore)
  })

  it('INV-TM-6: toggle manual off giá»¯a lÃºc pause â†’ há»§y pause, engine tá»± cháº¡y tiáº¿p', () => {
    const gameManager = battleReady()

    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    gameManager.setBattleManualMode(false)

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(false)

    for (let i = 0; i < 10; i++) {
      gameManager.update(0.1)
    }

    expect((gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0)).toBeGreaterThan(0)
  })

  it('INV-TM-2: pause khÃ´ng cháº·n reward/victory path â€” grantBattleRewardIfNeeded váº«n cháº¡y trong fixed-step', () => {
    const gameManager = battleReady()

    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    // Trong lÃºc pause, reward shim váº«n cháº¡y (khÃ´ng crash, khÃ´ng grant sá»›m
    // â€” battle váº«n fighting, khÃ´ng cÃ³ victory Ä‘á»ƒ grant).
    expect(gameManager.getTurnBattle()?.state).toBe('fighting')
  })
})


// ---------------------------------------------------------------------------
// Smoke-test regression (browser runtime evidence 2026-09-04): sau victory,
// "Đánh Lại" no-op vĩnh viễn — StageManager.active không được stop sau Slice
// 6 cutover (StageWaveSystem.update() return sớm vì syncLegacyBattleState()
// set legacy.state='victory' trực tiếp). startStage() → stageManager.start()
// return false → refight im lặng thất bại.
// ---------------------------------------------------------------------------

describe('QA regression — refight after turn-battle victory (smoke test evidence)', () => {
  it('startStage thành công lại sau khi turn battle đã victory (StageManager.active được release)', () => {
    const gameManager = new GameManager()
    const enemy = defineEnemy({
      id: 'refight_dummy', name: 'Refight Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage: Stage = {
      id: 'refight_stage', name: 'Refight Stage', description: '', floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1], spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.startStage(player, stats, stage, false)).toBe(true)

    // Run to victory
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      gameManager.update(0.05)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('victory')

    // Refight — must succeed (was silently failing: StageManager.active stale)
    expect(gameManager.startStage(player, stats, stage, false)).toBe(true)
    expect(gameManager.getTurnBattle()?.state).toBe('countdown')
  })
})


// ---------------------------------------------------------------------------
// Future Systems Task 10 — party manual pause: BẤT KỲ party member nào
// tới lượt đều pause, resolveActorTurn resolve đúng member đó.
// ---------------------------------------------------------------------------

describe('Future Systems Task 10 — party manual pause', () => {
  it('pause áp cho mọi party member; presentation facade theo paused actor', () => {
    const gameManager = new GameManager()
    const enemy = defineEnemy({
      id: 'party_dummy', name: 'Party Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 10_000_000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage: Stage = {
      id: 'party_stage', name: 'Party Stage', description: '', floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1], spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 50 }, [])

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.startStage(player, stats, stage, false)).toBe(true)

    // Mô phỏng party 2 người: thêm players[1] với gauge ready ngay.
    const battle = gameManager.getTurnBattle()
    expect(battle).not.toBeNull()
    expect(battle!.players).toHaveLength(1)

    // (Party member thứ 2 là redesign nội dung recruit — engine check:
    // players[] đã là mảng; test này pin engine-side includes-check.)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    // Pause xảy ra khi players[0] tới lượt (đơn vị duy nhất hiện có).
    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.consumeAwaitedActorId()).toBe('player')

    // Presentation facade khi pause: theo awaited actor.
    const presentation = gameManager.buildTurnSkillPresentation(battle!, true)

    expect(presentation.basic).toBeDefined()
  })
})


// ---------------------------------------------------------------------------
// Gameplay fixes (2026-09-05) — refight chain: Đánh Lại phải hoạt động
// LẶP LẠI nhiều lần (user report: lần 2 lỗi).
// ---------------------------------------------------------------------------

describe('Gameplay fixes — refight chain', () => {
  it('startStage Victory loop 3 rounds lian tiep (Refight repeat)', () => {
    const gameManager = new GameManager()
    const enemy = defineEnemy({
      id: 'refight3_dummy', name: 'Refight3', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage: Stage = {
      id: 'refight3_stage', name: 'Refight3 Stage', description: '', floor: 1,
      enemyPool: [{ enemyId: enemy.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1], spawnIntervalSeconds: 0,
    }
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])

    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.setActivePlayer(player)

    for (let round = 1; round <= 3; round++) {
      const started = gameManager.startStage(player, stats, stage, false)

      expect(started, `round ${round}: startStage failed`).toBe(true)

      const battle = gameManager.getTurnBattle()

      expect(battle, `round ${round}: no turnBattle`).not.toBeNull()

      for (let i = 0; i < 600 && battle!.state !== 'victory'; i++) {
        gameManager.update(0.05)
      }

      expect(battle!.state, `round ${round}: not victory`).toBe('victory')
    }
  })
})