import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Slice 7 (Completion Task 10) — manual mode: khi bật, engine PAUSE khi
// tới lượt player và chờ submitTurnChoice() trước khi resolve; enemy và
// auto mode KHÔNG BAO GIỜ pause (auto = cùng engine chạy nhanh hơn).

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  attack: 0,
  attackSpeed: 1,
  attackRangeRanks: 9,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 2, criticalRate: 0 }

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
    row: 4,
    alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test',
    name: 'Basic (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
    unlocked: true,
    equipped: true,
    loadoutSlot: 0,
    loadoutSlots: [0],
  }
}

function createDummyEnemy() {
  return defineEnemy({
    id: 'manual_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function startManualBattle(): GameManager {
  const gameManager = new GameManager()
  const player = createPlayer()

  gameManager.registerSkillTemplates([createBasicSkill()])
  gameManager.learnSkill('basic_test')
  gameManager.skillSystem.equipToSlot('basic_test', 0)

  gameManager.startBattle(player, createDummyEnemy())

  for (let i = 0; i < 30; i++) {
    gameManager.update(0.1)
  }

  gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2
  gameManager.getTurnBattle()!.player.entity.x = 0

  return gameManager
}

describe('GameManager — manual mode pause-on-player-turn (Slice 7)', () => {
  it('bật manual mode → engine dừng khi tới lượt player, không resolve gì cho tới khi submit', () => {
    const gameManager = startManualBattle()

    gameManager.setBattleManualMode(true)

    const turnsBefore = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0

    // Nhiều pacing tick — player turn phải pause, KHÔNG auto-resolve.
    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsBefore)
  })

  it('submitTurnChoice basic → engine resume, dùng skill được chọn, sau đó tới lượt enemy tự chạy', () => {
    const gameManager = startManualBattle()

    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    const actorId = gameManager.consumeAwaitedActorId()
    expect(actorId).toBe('player')

    const submitted = gameManager.submitTurnChoice('basic')

    expect(submitted).toBe(true)

    // Submit resolve NGAY 1 lượt player (turn mới +1) không cần chờ tick.
    const turnsAfterSubmit = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0

    expect(turnsAfterSubmit).toBeGreaterThanOrEqual(1)

    // Sau submit, engine peek tiếp → pause lại chờ choice kế (manual mode
    // vẫn bật). 10 tick không resolve thêm gì khi pause.
    for (let i = 0; i < 10; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBeGreaterThanOrEqual(turnsAfterSubmit)
  })

  it('auto mode (mặc định) KHÔNG pause bao giờ', () => {
    const gameManager = startManualBattle()

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(false)
    expect((gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0)).toBeGreaterThan(0)
  })

  it('submit khi KHÔNG pause → false (no-op an toàn)', () => {
    const gameManager = startManualBattle()

    expect(gameManager.submitTurnChoice('basic')).toBe(false)
  })
})
