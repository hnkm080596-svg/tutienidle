import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Defect Task 3 — PresentationGate boot-race fix: real app (App.vue) calls
// expectPresentationLayer() once at boot; CombatScene calls
// setPresentationActive(true) when mounted. Headless test instances never
// call expect → never gated.

describe('GameManager — PresentationGate (boot-race fix)', () => {
  it('does NOT gate combat ticking by default (headless/test instances never call expectPresentationLayer)', () => {
    const gameManager = new GameManager()

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('gates after expectPresentationLayer(), releases after setPresentationActive(true)', () => {
    const gameManager = new GameManager()

    gameManager.expectPresentationLayer()
    expect(gameManager.isAwaitingPresentationLayer()).toBe(true)

    gameManager.setPresentationActive(true)
    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('markReady sticky — setPresentationActive(false) sau đó không re-block', () => {
    const gameManager = new GameManager()

    gameManager.expectPresentationLayer()
    gameManager.setPresentationActive(true)
    gameManager.setPresentationActive(false)

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })
})


// --- Defect Task 4: setPresentationActive(false) respects manual choice ---

const ENEMY_STATS = {
  maxHp: 1_000_000, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0,
}

function createPlaybackPlayer(): CombatEntity {
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

function battleReady(): GameManager {
  const gameManager = new GameManager()
  const player = createPlaybackPlayer()
  gameManager.registerSkillTemplates([createBasicSkill()])
  gameManager.learnSkill('basic_test')
  gameManager.skillSystem.equipToSlot('basic_test', 0)
  gameManager.startBattle(player, defineEnemy({
    id: 'playback_dummy', name: 'Playback Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { ...ENEMY_STATS },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }))

  for (let i = 0; i < 30; i++) {
    gameManager.update(0.1)
  }

  gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

  return gameManager
}

describe('GameManager — setPresentationActive(false) respects manual choice (Defect Task 4)', () => {
  it('does not silently auto-resolve a manual player pending ready-phase turn on scene teardown', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    gameManager.setPresentationActive(false)

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)
  })
})