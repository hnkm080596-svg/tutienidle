import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import { createDefaultPlayer } from '../player/Player'
import { toTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'

// Slice 7 (Completion Task 10) — manual mode: khi bật, engine PAUSE khi
// tới lượt player và chờ submitTurnChoice() trước khi resolve; enemy và
// auto mode KHÔNG BAO GIỜ pause (auto = cùng engine chạy nhanh hơn).

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })

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
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

// Combat runs on its own CombatClock now; these tests step it directly.
function startManualBattle(): { gameManager: GameManager; combatSource: ManualClockSource } {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createPlayer()

  gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
  gameManager.catalogOps.registerProgressionNodes([{
    id: 'core_basic_test',
    name: 'Core: Basic',
    type: 'minor',
    insightCost: 0,
    maxLevel: 10,
    levelsSkillId: 'basic_test',
    effect: {},
  }])
  gameManager.progressionOps.learnSkill('basic_test', createDefaultPlayer())
  const basicSkill = gameManager.skillManager.get('basic_test')!
  gameManager.setPathRuntimeResolver(() => ({
    resolveBasic: () =>
      toTurnSkillDefinition(basicSkill, gameManager.skillSystem.getEffectiveSkill(basicSkill)),
    resolveSpecialUltimate: () => undefined,
    resolveMaxThe: () => 0,
    resolveStatDomains: () => undefined,
  }))

  gameManager.startBattle(player, createDummyEnemy())

  for (let i = 0; i < 30; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }

  gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2
  gameManager.getTurnBattle()!.players[0]!.entity.x = 0

  return { gameManager, combatSource }
}

describe('GameManager — manual mode pause-on-player-turn (Slice 7)', () => {
  it('bật manual mode → khi gauge player đầy, engine pause chờ choice (không tự resolve tiếp các lượt sau)', () => {
    const { gameManager, combatSource } = startManualBattle()

    gameManager.setBattleManualMode(true)

    const turnsBefore = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0

    // Turn token (2026-09-10): the step that fills the gauge CLAIMS the
    // token into AWAITING_INPUT and resolves nothing - tickPacing no longer
    // resolves a turn in any mode. The player's turn is genuinely still
    // pending, so totalTurnsElapsed has not moved, and the clock is frozen so
    // the rest of the batch is dropped rather than spent.
    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsBefore)
    expect(gameManager.getCombatClockState()).toBe('frozen')
  })

  it('submitTurnChoice basic → engine resume, dùng skill được chọn, sau đó tới lượt enemy tự chạy', () => {
    const { gameManager, combatSource } = startManualBattle()

    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
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
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBeGreaterThanOrEqual(turnsAfterSubmit)
  })

  it('auto mode (mặc định) KHÔNG pause bao giờ', () => {
    const { gameManager, combatSource } = startManualBattle()

    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(false)
    expect((gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0)).toBeGreaterThan(0)
  })

  it('submit khi KHÔNG pause → false (no-op an toàn)', () => {
    const { gameManager } = startManualBattle()

    expect(gameManager.submitTurnChoice('basic')).toBe(false)
  })
})

describe('manual mode — committed queued executions auto-resolve (Mission C contract)', () => {
  // A repeatCasts/multicast execution is the remainder of an ALREADY
  // COMMITTED cast: manual mode must not park it awaiting input, and it
  // must resolve before any new gauge turn. A genuinely new player turn
  // still pauses.
  it('queued repeat execution resolves without pausing; the next real player turn still pauses', () => {
    const { gameManager, combatSource } = startManualBattle()

    // Give the player's basic a committed follow-up execution.
    const participant = gameManager.getTurnBattle()!.players[0]!
    participant.basic!.repeatCasts = 1

    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50 && !gameManager.isAwaitingManualTurnChoice(); i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    const turnsAtSubmit = gameManager.getTurnBattle()!.totalTurnsElapsed ?? 0
    expect(gameManager.submitTurnChoice('basic')).toBe(true)
    // Original cast resolves immediately.
    expect(gameManager.getTurnBattle()!.totalTurnsElapsed ?? 0).toBe(turnsAtSubmit + 1)

    // The queued repeat execution must drain on a later step WITHOUT the
    // engine parking on AWAITING_INPUT in between — the first elapsed
    // increment after submit is that committed execution.
    let sawAwaiting = false
    let queuedResolved = false
    for (let i = 0; i < 60 && !queuedResolved; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      if (gameManager.isAwaitingManualTurnChoice()) sawAwaiting = true
      queuedResolved = (gameManager.getTurnBattle()!.totalTurnsElapsed ?? 0) > turnsAtSubmit + 1
    }
    expect(queuedResolved).toBe(true)
    expect(sawAwaiting).toBe(false)

    // Once the queue is empty, a genuinely new player turn still pauses.
    let pausedAgain = false
    for (let i = 0; i < 200 && !pausedAgain; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      pausedAgain = gameManager.isAwaitingManualTurnChoice()
    }
    expect(pausedAgain).toBe(true)
  })
})
