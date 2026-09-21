import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Action Playback Task 6 — GameManager presentation orchestration:
// presentationActive=false (default) → hành vi cũ nguyên vẹn; true →
// 5-phase state machine với 3 acknowledge methods.

const ENEMY_STATS = {
  maxHp: 1_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
  // Determinism fix (fix round 1) — see root-cause note in battleReady()
  // below. Guarantees the player's attack always hits this dummy.
  evasionRate: 0,
}

function createPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
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

function createDummy() {
  return defineEnemy({
    id: 'playback_dummy', name: 'Playback Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { ...ENEMY_STATS },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

// Combat runs on its own CombatClock (2026-09-10 turn-mechanism spec), so
// every call below that used to drive the battle through update() now steps
// a ManualClockSource. While a turn is in flight that clock is FROZEN, which
// is why advancing it during a pending acknowledgement changes nothing.
function battleReady(): { gameManager: GameManager; combatSource: ManualClockSource } {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createPlayer()

  gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
  gameManager.progressionOps.learnSkill('basic_test')
  gameManager.skillSystem.equipToSlot('basic_test', 0)

  gameManager.startBattle(player, createDummy())

  // Intro 20 ticks (2026-09-07 plan Task 4) + countdown 30 ticks.
  for (let i = 0; i < INTRO_TOTAL_TICKS + 30; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }

  // True root cause of the ~4/15 flake (fix round 1 — the previously
  // reported diagnosis, "enemy spawn row randomized out of the player's
  // targeting row," does NOT hold: selectTarget() in TurnBattleSystem.ts
  // falls back to the nearest living opponent on ANY row when nobody
  // shares the actor's row (`pool = sameRow.length > 0 ? sameRow : living`),
  // so a target is always found regardless of spawn row).
  //
  // The actual cause is CombatSystem.rollHit(): every resolveActionHit()
  // call rolls `Math.random() < getHitChance(accuracy, evasion)` (see
  // combat/CombatSystem.ts, combat/Accuracy.ts). EnemyStatInput's default
  // evasionRate is 25 (EnemyStatInput.ts) against the player's default
  // accuracyRating of 100 → hitChance = 100/125 = 0.80, i.e. a genuine ~20%
  // chance any single acknowledged attack MISSES and leaves currentHp
  // unchanged — exactly the "expected 1000000 to be less than 1000000"
  // failure observed. ENEMY_STATS.evasionRate is now pinned to 0 above so
  // hitChance = 100/100 = 1.0 (always hits), making every single-attack
  // damage assertion in this file deterministic without touching Math.random
  // or weakening any assertion.
  const enemyEntity = gameManager.getTurnBattle()!.enemies[0]!.entity
  enemyEntity.x = 2

  return { gameManager, combatSource }
}

describe('GameManager — presentation orchestration (presentationActive=false default)', () => {
  it('default false → fixed-step tick resolve turn ngay như cũ (zero behavior change)', () => {
    const { gameManager, combatSource } = battleReady()

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Speed 100 → ~10 ticks = 1 turn. Sau 20 ticks ≥ 1 turn đã resolve.
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBeGreaterThan(0)
  })
})

describe('GameManager — presentation orchestration (presentationActive=true)', () => {
  it('tick có actor ready → emit turn_ready + PAUSE (chưa declare/impact/complete)', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('turn_ready', () => events.push('turn_ready'))
    gameManager.eventBus.on('attack', () => events.push('attack'))

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(events).toContain('turn_ready')
    expect(events).not.toContain('attack')
    expect(gameManager.getTurnBattle()?.state).toBe('fighting')
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(0)
  })

  it('acknowledgeTurnReady → declare + emit turn_cast_start (chưa damage)', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('turn_cast_start', () => events.push('turn_cast_start'))

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const enemyBefore = gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp

    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)

    expect(events).toContain('turn_cast_start')
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBe(enemyBefore)
  })

  it('acknowledgeActionImpact → damage applied + action_impact emitted', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('action_impact', () => events.push('action_impact'))

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)

    const enemyBefore = gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp

    gameManager.acknowledgeActionImpact(token)

    expect(events).toContain('action_impact')
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBeLessThan(enemyBefore)
  })

  it('acknowledgeActionComplete → cleanup + turn_standby_complete + next tick peek mới', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    const events: string[] = []
    gameManager.eventBus.on('turn_standby_complete', () => events.push('turn_standby_complete'))

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)
    gameManager.acknowledgeActionImpact(token)
    gameManager.acknowledgeActionComplete(token)

    expect(events).toContain('turn_standby_complete')
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed).toBe(1)
  })

  it('submitTurnChoice khi presentationActive → declare thay vì resolve ngay', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // 5-phase machine: tick emit turn_ready (pendingReadyActor); Phaser ack
    // → manual player actor rơi vào awaitedManualActor pause (Slice 7 flow).
    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    gameManager.submitTurnChoice('basic')

    // Chưa complete — pendingDeclaredAction đang chờ acknowledgeActionImpact.
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
  })
})


// --- Remediation Task 1: tokenized playback + idempotent teardown ---

describe('Remediation Task 1 — playback token + idempotent teardown', () => {
  it('teardown ở ready-phase: setPresentationActive(false) drain xong isActionPlaybackWaiting = false', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
    gameManager.setPresentationActive(false)
    expect(gameManager.isActionPlaybackWaiting()).toBe(false)
  })

  it('teardown idempotent: gọi false 2 lần không gây thêm damage/turn/event', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }
    gameManager.setPresentationActive(false)
    const turnsAfterFirst = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0
    const logAfterFirst = gameManager.getTurnBattle()?.log?.length ?? 0
    const enemyHpAfterFirst = gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp
    gameManager.setPresentationActive(false)
    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsAfterFirst)
    expect(gameManager.getTurnBattle()?.log?.length ?? 0).toBe(logAfterFirst)
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBe(enemyHpAfterFirst)
  })

  it('stale ack: token cũ không đụng action mới (generation-based invalidation)', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }
    const oldToken = gameManager.getPendingPlaybackToken()
    gameManager.setPresentationActive(false)

    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }
    const newWaiting = gameManager.isActionPlaybackWaiting()
    const turnsBeforeStaleAck = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0
    const logBeforeStaleAck = gameManager.getTurnBattle()?.log?.length ?? 0

    gameManager.acknowledgeActionImpact(oldToken ?? undefined)
    gameManager.acknowledgeActionComplete(oldToken ?? undefined)
    gameManager.acknowledgeTurnReady(oldToken ?? undefined)

    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsBeforeStaleAck)
    expect(gameManager.getTurnBattle()?.log?.length ?? 0).toBe(logBeforeStaleAck)
    expect(gameManager.isActionPlaybackWaiting()).toBe(newWaiting)
  })
})

// --- Remediation Task 7: playback edge-case regression suite ---

describe('Remediation Task 7 — duplicate + out-of-order acknowledgements', () => {
  it('duplicate acknowledgeActionImpact → damage chỉ áp ĐÚNG 1 lần (no duplicate damage/event)', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    const impactEvents: unknown[] = []
    gameManager.eventBus.on('action_impact', (event) => impactEvents.push(event))

    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }
    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)

    const enemy = gameManager.getTurnBattle()!.enemies[0]!.entity
    const hpBefore = enemy.currentHp

    gameManager.acknowledgeActionImpact(token)

    expect(impactEvents).toHaveLength(1)
    expect(enemy.currentHp).toBeLessThan(hpBefore)

    const hpAfterFirst = enemy.currentHp
    const eventsAfterFirst = impactEvents.length

    // Duplicate — pendingDeclaredAction đã null → no-op.
    gameManager.acknowledgeActionImpact(token)
    gameManager.acknowledgeActionImpact(token)

    expect(impactEvents).toHaveLength(eventsAfterFirst)
    expect(enemy.currentHp).toBe(hpAfterFirst)
  })

  it('duplicate acknowledgeActionComplete → turn count/reward chỉ tính 1 lần', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    const standbyEvents: unknown[] = []
    gameManager.eventBus.on('turn_standby_complete', (event) => standbyEvents.push(event))

    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }
    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)
    gameManager.acknowledgeActionImpact(token)

    gameManager.acknowledgeActionComplete(token)

    const turnsAfterFirst = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0
    const eventsAfterFirst = standbyEvents.length

    expect(turnsAfterFirst).toBe(1)

    // Duplicate — pendingImpact đã null → no-op.
    gameManager.acknowledgeActionComplete(token)
    gameManager.acknowledgeActionComplete(token)

    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsAfterFirst)
    expect(standbyEvents).toHaveLength(eventsAfterFirst)
  })

  it('out-of-order: acknowledgeActionImpact trước acknowledgeTurnReady → no-op (phase chưa declare)', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }

    const enemy = gameManager.getTurnBattle()!.enemies[0]!.entity
    const hpBefore = enemy.currentHp

    // Chưa ack ready → không có pendingDeclaredAction → impact no-op.
    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeActionImpact(token)

    expect(enemy.currentHp).toBe(hpBefore)
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
  })

  it('rejects missing token and accepts valid token', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { combatSource.advance(COMBAT_STEP_SECONDS) }

    // Không truyền token — bị reject theo F5
    gameManager.acknowledgeTurnReady()
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    // Truyền token đúng — accept
    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
  })
})

// --- Fix round 1 (Task 4 review), revised for the turn clock -------------
//
// The original three "sub-branches" (normal pacing / awaitedManualActor pause
// / presentationActive pending-acknowledgement wait) were branches INSIDE one
// fixed step, and the guard was that a snapshot fires on every one of them.
// Those branches are gone: while a turn is in flight the combat clock is
// FROZEN, so no step arrives at all and there is nothing to emit. The guard
// that replaces them is the freeze itself - a running step must always emit a
// snapshot, and a step must not be spendable while a turn is in flight.
// See GameManager.actionPlayback.test.ts header for the battleReady()
// determinism note (evasionRate: 0).

describe('GameManager — turn_battle_entity_snapshot and the frozen clock', () => {
  it('a running combat step emits a snapshot', () => {
    const { gameManager, combatSource } = battleReady()

    expect(gameManager.getTurnBattle()?.state).toBe('fighting')
    expect(gameManager.getCombatClockState()).toBe('running')

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(snapshots).toHaveLength(1)
  })

  it('a manual wait freezes the clock, so no step and no snapshot happens', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toContain('turn-in-flight')

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    const stepsBefore = gameManager.getElapsedCombatSteps()
    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(gameManager.getElapsedCombatSteps()).toBe(stepsBefore)
    expect(snapshots).toHaveLength(0)
  })

  it('an outstanding renderer acknowledgement freezes the clock at every phase', () => {
    const { gameManager, combatSource } = battleReady()
    gameManager.setPresentationActive(true)

    for (let i = 0; i < 20; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Ready phase outstanding.
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
    expect(gameManager.getCombatClockState()).toBe('frozen')

    const token = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token)

    // Cast phase outstanding - the pipeline parked on the next step.
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
    expect(gameManager.getCombatClockState()).toBe('frozen')

    gameManager.acknowledgeActionImpact(token)

    // Impact phase outstanding.
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
    expect(gameManager.getCombatClockState()).toBe('frozen')

    const stepsBefore = gameManager.getElapsedCombatSteps()
    combatSource.advance(COMBAT_STEP_SECONDS * 10)
    expect(gameManager.getElapsedCombatSteps()).toBe(stepsBefore)

    // The last acknowledgement drains the pipeline and releases the clock.
    gameManager.acknowledgeActionComplete(token)

    expect(gameManager.isActionPlaybackWaiting()).toBe(false)
    expect(gameManager.getCombatClockState()).toBe('running')

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    combatSource.advance(COMBAT_STEP_SECONDS)

    expect(snapshots).toHaveLength(1)
  })
})
