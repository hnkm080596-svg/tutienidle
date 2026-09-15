import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { asBaseStats, createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { Stage } from '../stage/Stage'
import { createDefaultPlayer } from '../player/Player'

// Readiness has exactly ONE authority: the per-session PresentationSession
// hold. The old sticky PresentationGate (wall-clock 15s fallback that mutated
// itself ready on a query) is retired - it could block a released session for
// the first 15s of app life and healed only by timeout, never by evidence.

describe('GameManager — presentation readiness authority', () => {
  it('does NOT gate combat ticking for headless instances (tests/tools)', () => {
    const gameManager = new GameManager()

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('interactive mode alone does not gate: a hold requires a real session', () => {
    const gameManager = new GameManager()

    gameManager.setPresentationMode('interactive')

    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })

  it('no wall-clock fallback: an unrevealed interactive session stays held past any timeout', () => {
    vi.useFakeTimers()

    try {
      const gameManager = new GameManager()
      gameManager.setPresentationMode('interactive')
      startGatedStage(gameManager)

      expect(gameManager.isAwaitingPresentationLayer()).toBe(true)

      vi.advanceTimersByTime(60_000)

      expect(gameManager.isAwaitingPresentationLayer()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('releases only through attach + release on the current hold token', () => {
    const gameManager = new GameManager()
    gameManager.setPresentationMode('interactive')
    startGatedStage(gameManager)

    const port = gameManager.getPresentationPort()
    const session = gameManager.getCurrentPresentationSession()!
    const token = port.hold(session)!

    expect(port.release(token)).toBe(false)
    expect(gameManager.isAwaitingPresentationLayer()).toBe(true)

    expect(port.attach(token)).toBe(true)
    expect(gameManager.isAwaitingPresentationLayer()).toBe(true)

    expect(port.release(token)).toBe(true)
    expect(gameManager.isAwaitingPresentationLayer()).toBe(false)
  })
})

/** Registers a minimal stage and starts it, leaving the session in its begin state. */
function startGatedStage(gameManager: GameManager): void {
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100  })
  const enemy = defineEnemy({
    id: 'gate_dummy', name: 'Gate Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
  const stage = stageFixture('gate_stage')
  stage.enemyPool = [{ enemyId: enemy.id, weight: 1 }]

  gameManager.catalogOps.registerEnemyTemplates([enemy])
  gameManager.catalogOps.registerStages([stage])
  gameManager.setActivePlayer(player)

  if (!gameManager.turnBattleOps.startStage(player, stage, false)) {
    throw new Error('startGatedStage fixture failed to start its stage')
  }
}


// --- Defect Task 4: setPresentationActive(false) respects manual choice ---

const ENEMY_STATS = {
  maxHp: 1_000_000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0,
}

function createPlaybackPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })
  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,

    currentSwordIntent: 0,

    currentMomentum: 0,

    tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test', name: 'Basic', description: '', type: 'active', level: 1, maxLevel: 10,
    cooldown: 0, cost: 0, target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' }, resourceType: 'none',
    unlocked: true, equipped: true, loadoutSlot: 0, loadoutSlots: [0],
  }
}

// Combat runs on its own CombatClock; the world tick no longer drives it.
function battleReady(): { gameManager: GameManager; combatSource: ManualClockSource } {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createPlaybackPlayer()
  gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
  gameManager.progressionOps.learnSkill('basic_test')
  gameManager.skillSystem.equipToSlot('basic_test', 0)
  gameManager.startBattle(player, defineEnemy({
    id: 'playback_dummy', name: 'Playback Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { ...ENEMY_STATS },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }))

  // Intro 20 ticks (2026-09-07 plan Task 4) + countdown 30 ticks.
  for (let i = 0; i < INTRO_TOTAL_TICKS + 30; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }

  gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

  return { gameManager, combatSource }
}

describe('GameManager — setPresentationActive(false) respects manual choice (Defect Task 4)', () => {
  it('does not silently auto-resolve a manual player pending ready-phase turn on scene teardown', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Under the turn token a player-team claim in manual mode goes STRAIGHT
    // to AWAITING_INPUT (spec section 3.2): it never enters the renderer's
    // ready phase, so there is no playback ack outstanding to observe. What
    // this test guards - scene teardown must not silently auto-resolve that
    // turn - is asserted below and unchanged.
    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    gameManager.setPresentationActive(false)

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)
  })
})

// --- Defect Task 6: stale pending-phase reset on stage restart ---

function stageFixture(id: string): Stage {
  return {
    id, name: id, description: '', floor: 1,
    enemyPool: [{ enemyId: id + '_enemy', weight: 1 }],
    totalEnemyCount: 1, waves: [1],
    spawnIntervalSeconds: 0,
  }
}

describe('GameManager — presentation session lifecycle (Task 2)', () => {
  function createStartedManager(mode: 'interactive' | 'headless' = 'interactive') {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100  })
    const enemy = defineEnemy({
      id: 'session_dummy', name: 'Session Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage = stageFixture('session_stage')
    stage.enemyPool = [{ enemyId: enemy.id, weight: 1 }]
    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.setPresentationMode(mode)

    return { gameManager, player, stage, enemy, combatSource }
  }

  it('successful startStage in interactive mode begins held, allocates session, and emits presentation_session_started', () => {
    const { gameManager, player, stage, combatSource } = createStartedManager('interactive')
    const events: unknown[] = []
    gameManager.eventBus.on('presentation_session_started', (e) => events.push(e))

    const started = gameManager.turnBattleOps.startStage(player, stage, false)
    expect(started).toBe(true)

    const session = gameManager.getCurrentPresentationSession()!
    expect(session).toBeDefined()
    expect(session.kind).toBe('combat')
    expect(session.sessionId).toBeGreaterThan(0)

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(session)

    // Interactive session begins held
    const port = gameManager.getPresentationPort()
    expect(port.getCurrentSession()).toEqual(session)

    // A held session is not on screen, so the combat clock is frozen for
    // 'not-revealed': advancing its source banks nothing.
    const introBefore = gameManager.getTurnBattle()?.introTurnsRemaining
    combatSource.advance(0.5)
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(introBefore)

    // Attach and release the hold
    const hold = port.hold(session)!
    expect(hold).toBeDefined()
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)

    // Now the clock is running again and one step advances intro
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe((introBefore ?? 0) - 1)
  })

  it('headless startStage allocates session without being held', () => {
    const { gameManager, player, stage, combatSource } = createStartedManager('headless')
    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    const session = gameManager.getCurrentPresentationSession()!
    expect(session).toBeDefined()
    expect(session.kind).toBe('combat')

    // Ticking advances immediately
    const introBefore = gameManager.getTurnBattle()?.introTurnsRemaining
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe((introBefore ?? 0) - 1)
  })

  it('failed startStage creates no session and emits no event', () => {
    const { gameManager, player, stage } = createStartedManager('interactive')
    const events: unknown[] = []
    gameManager.eventBus.on('presentation_session_started', (e) => events.push(e))

    // Registered stage with level requirement above player level fails
    const lockedStage: Stage = { ...stage, id: 'locked_stage', requiredRealmId: 'mortal', requiredRealmLevel: 99 }
    gameManager.catalogOps.registerStages([lockedStage])

    const started = gameManager.turnBattleOps.startStage(player, lockedStage, false)
    expect(started).toBe(false)

    expect(gameManager.getCurrentPresentationSession()).toBeNull()
    expect(events).toHaveLength(0)
  })

  it('fresh startStage increments session ID and invalidates old hold tokens', () => {
    const { gameManager, player, stage } = createStartedManager('interactive')
    gameManager.turnBattleOps.startStage(player, stage, false)
    const session1 = gameManager.getCurrentPresentationSession()!
    const port = gameManager.getPresentationPort()
    const hold1 = port.hold(session1)!

    // Abandon first battle so stageManager releases slot for fresh start
    expect(gameManager.abandonBattle()).toBe(true)

    // Fresh start on same manager
    gameManager.turnBattleOps.startStage(player, stage, false)
    const session2 = gameManager.getCurrentPresentationSession()!

    expect(session2.sessionId).toBeGreaterThan(session1.sessionId)
    expect(port.attach(hold1)).toBe(false)
    expect(port.release(hold1)).toBe(false)
  })

  it('abandonBattle invalidates the current session', () => {
    const { gameManager, player, stage } = createStartedManager('interactive')
    gameManager.turnBattleOps.startStage(player, stage, false)
    const session = gameManager.getCurrentPresentationSession()!
    expect(session).toBeDefined()

    expect(gameManager.abandonBattle()).toBe(true)
    expect(gameManager.getCurrentPresentationSession()).toBeNull()
  })

  it('direct startBattle publishes single session and nested startStage does not double-publish', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100  })
    const enemy = defineEnemy({
      id: 'session_dummy2', name: 'Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: { maxHp: 500, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage = stageFixture('session_stage_nested')
    stage.enemyPool = [{ enemyId: enemy.id, weight: 1 }]
    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    const events: unknown[] = []
    gameManager.eventBus.on('presentation_session_started', (e) => events.push(e))

    // Direct startBattle
    gameManager.startBattle(createPlaybackPlayer(), enemy)
    expect(events).toHaveLength(1)
    events.length = 0

    // startStage has nested startBattle call, but must publish exactly ONE session
    gameManager.turnBattleOps.startStage(player, stage, false)
    expect(events).toHaveLength(1)
  })
})
