import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Action Playback Task 6 — GameManager presentation orchestration:
// presentationActive=false (default) → hành vi cũ nguyên vẹn; true →
// 5-phase state machine với 3 acknowledge methods.

const ENEMY_STATS = {
  maxHp: 1_000_000,
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
    id: 'playback_dummy', name: 'Playback Dummy', level: 1, realmId: 'mortal', lane: 'ground',
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

  // Countdown 30 ticks.
  for (let i = 0; i < 30; i++) {
    gameManager.update(0.1)
  }

  gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

  return gameManager
}

describe('GameManager — presentation orchestration (presentationActive=false default)', () => {
  it('default false → fixed-step tick resolve turn ngay như cũ (zero behavior change)', () => {
    const gameManager = battleReady()

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    // Speed 100 → ~10 ticks = 1 turn. Sau 20 ticks ≥ 1 turn đã resolve.
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBeGreaterThan(0)
  })
})

describe('GameManager — presentation orchestration (presentationActive=true)', () => {
  it('tick có actor ready → emit turn_ready + PAUSE (chưa declare/impact/complete)', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('turn_ready', () => events.push('turn_ready'))
    gameManager.eventBus.on('attack', () => events.push('attack'))

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    expect(events).toContain('turn_ready')
    expect(events).not.toContain('attack')
    expect(gameManager.getTurnBattle()?.state).toBe('fighting')
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)
  })

  it('acknowledgeTurnReady → declare + emit attack (chưa damage)', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('attack', () => events.push('attack'))

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    const enemyBefore = gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp

    gameManager.acknowledgeTurnReady()

    expect(events).toContain('attack')
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBe(enemyBefore)
  })

  it('acknowledgeActionImpact → damage applied + action_impact emitted', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('action_impact', () => events.push('action_impact'))

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    gameManager.acknowledgeTurnReady()

    const enemyBefore = gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp

    gameManager.acknowledgeActionImpact()

    expect(events).toContain('action_impact')
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBeLessThan(enemyBefore)
  })

  it('acknowledgeActionComplete → cleanup + turn_standby_complete + next tick peek mới', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('turn_standby_complete', () => events.push('turn_standby_complete'))

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    gameManager.acknowledgeTurnReady()
    gameManager.acknowledgeActionImpact()
    gameManager.acknowledgeActionComplete()

    expect(events).toContain('turn_standby_complete')
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed).toBe(1)
  })

  it('submitTurnChoice khi presentationActive → declare thay vì resolve ngay', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    // 5-phase machine: tick emit turn_ready (pendingReadyActor); Phaser ack
    // → manual player actor rơi vào awaitedManualActor pause (Slice 7 flow).
    gameManager.acknowledgeTurnReady()

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    gameManager.submitTurnChoice('basic')

    // Chưa complete — pendingDeclaredAction đang chờ acknowledgeActionImpact.
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
  })
})
