import { describe, expect, it } from 'vitest'
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
  attack: 0,
  attackSpeed: 1,
  attackRangeRanks: 9,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
  // Determinism fix (fix round 1) — see root-cause note in battleReady()
  // below. Guarantees the player's attack always hits this dummy.
  evasionRate: 0,
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

  // Intro 20 ticks (2026-09-07 plan Task 4) + countdown 30 ticks.
  for (let i = 0; i < INTRO_TOTAL_TICKS + 30; i++) {
    gameManager.update(0.1)
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


// --- Remediation Task 1: tokenized playback + idempotent teardown ---

describe('Remediation Task 1 — playback token + idempotent teardown', () => {
  it('teardown ở ready-phase: setPresentationActive(false) drain xong isActionPlaybackWaiting = false', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
    gameManager.setPresentationActive(false)
    expect(gameManager.isActionPlaybackWaiting()).toBe(false)
  })

  it('teardown idempotent: gọi false 2 lần không gây thêm damage/turn/event', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }
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
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }
    const oldToken = gameManager.getPendingPlaybackToken()
    gameManager.setPresentationActive(false)

    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }
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
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    const impactEvents: unknown[] = []
    gameManager.eventBus.on('action_impact', (event) => impactEvents.push(event))

    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }
    gameManager.acknowledgeTurnReady()

    const enemy = gameManager.getTurnBattle()!.enemies[0]!.entity
    const hpBefore = enemy.currentHp

    gameManager.acknowledgeActionImpact()

    expect(impactEvents).toHaveLength(1)
    expect(enemy.currentHp).toBeLessThan(hpBefore)

    const hpAfterFirst = enemy.currentHp
    const eventsAfterFirst = impactEvents.length

    // Duplicate — pendingDeclaredAction đã null → no-op.
    gameManager.acknowledgeActionImpact()
    gameManager.acknowledgeActionImpact()

    expect(impactEvents).toHaveLength(eventsAfterFirst)
    expect(enemy.currentHp).toBe(hpAfterFirst)
  })

  it('duplicate acknowledgeActionComplete → turn count/reward chỉ tính 1 lần', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    const standbyEvents: unknown[] = []
    gameManager.eventBus.on('turn_standby_complete', (event) => standbyEvents.push(event))

    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }
    gameManager.acknowledgeTurnReady()
    gameManager.acknowledgeActionImpact()

    gameManager.acknowledgeActionComplete()

    const turnsAfterFirst = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0
    const eventsAfterFirst = standbyEvents.length

    expect(turnsAfterFirst).toBe(1)

    // Duplicate — pendingImpact đã null → no-op.
    gameManager.acknowledgeActionComplete()
    gameManager.acknowledgeActionComplete()

    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsAfterFirst)
    expect(standbyEvents).toHaveLength(eventsAfterFirst)
  })

  it('out-of-order: acknowledgeActionImpact trước acknowledgeTurnReady → no-op (phase chưa declare)', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }

    const enemy = gameManager.getTurnBattle()!.enemies[0]!.entity
    const hpBefore = enemy.currentHp

    // Chưa ack ready → không có pendingDeclaredAction → impact no-op.
    gameManager.acknowledgeActionImpact()

    expect(enemy.currentHp).toBe(hpBefore)
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
  })

  it('ack với token ĐÚNG sau token null → vẫn hoạt động (backwards compat: không token = accept)', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    for (let i = 0; i < 20; i++) { gameManager.update(0.1) }

    // Không truyền token — backwards-compatible path (CombatScene cũ).
    gameManager.acknowledgeTurnReady()

    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
  })
})

// --- Fix round 1 (Task 4 review) — turn_battle_entity_snapshot must fire on
// EVERY updateBattleFixedStep() 'fighting' tick, regardless of which of the
// 3 inner sub-branches ran that tick (normal pacing / awaitedManualActor
// pause / presentationActive pending-acknowledgement wait). A regression
// that moves emitTurnBattleEntitySnapshot() inside the pacing `else` branch
// would freeze combat art only while paused on manual input or a Phaser
// acknowledgement — exactly the bug this task exists to prevent, just
// subtler. These tests drive each of the 3 states through the real public
// surface (update()/acknowledgeTurnReady()/acknowledgeActionImpact()) —
// see GameManager.actionPlayback.test.ts header for the battleReady()
// determinism note (evasionRate: 0).

describe('GameManager — turn_battle_entity_snapshot fires every fixed-step tick (all 3 sub-branches)', () => {
  it('sub-branch 1: normal pacing (no manual actor, no pending ack) — snapshot fires', () => {
    const gameManager = battleReady()

    expect(gameManager.getTurnBattle()?.state).toBe('fighting')

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    gameManager.update(0.1)

    expect(snapshots).toHaveLength(1)
  })

  it('sub-branch 2: awaitedManualActor set (paused waiting for submitTurnChoice) — snapshot still fires', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)
    gameManager.setBattleManualMode(true)

    for (let i = 0; i < 50; i++) {
      gameManager.update(0.1)
    }

    // Declares the manual player's ready phase into awaitedManualActor —
    // same flow as the existing 'submitTurnChoice khi presentationActive'
    // test above.
    gameManager.acknowledgeTurnReady()

    expect(gameManager.isAwaitingManualTurnChoice()).toBe(true)

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    // This tick takes the `if (this.awaitedManualActor)` branch (still
    // paused — no submitTurnChoice yet), NOT the tick that just set it.
    gameManager.update(0.1)

    expect(snapshots).toHaveLength(1)
  })

  it('sub-branch 3a: presentationActive + pendingReadyActor outstanding — snapshot still fires', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    // pendingReadyActor is now set (turn_ready emitted, PAUSE per the
    // existing 'tick có actor ready' test above) and stays set until
    // acknowledgeTurnReady() is called.
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    // This tick takes the presentationActive-pending `else if` branch
    // (no-op — waiting on Phaser's ready-flourish acknowledgement).
    gameManager.update(0.1)

    expect(snapshots).toHaveLength(1)
  })

  it('sub-branch 3b: presentationActive + pendingDeclaredAction outstanding — snapshot still fires', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    gameManager.acknowledgeTurnReady()

    // pendingDeclaredAction is now set ('attack' emitted); waiting on
    // acknowledgeActionImpact().
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    gameManager.update(0.1)

    expect(snapshots).toHaveLength(1)
  })

  it('sub-branch 3c: presentationActive + pendingImpact outstanding — snapshot still fires', () => {
    const gameManager = battleReady()
    gameManager.setPresentationActive(true)

    for (let i = 0; i < 20; i++) {
      gameManager.update(0.1)
    }

    gameManager.acknowledgeTurnReady()
    gameManager.acknowledgeActionImpact()

    // pendingImpact is now set ('action_impact' emitted); waiting on
    // acknowledgeActionComplete().
    expect(gameManager.isActionPlaybackWaiting()).toBe(true)

    const snapshots: unknown[] = []
    gameManager.eventBus.on('turn_battle_entity_snapshot', (event) => snapshots.push(event))

    gameManager.update(0.1)

    expect(snapshots).toHaveLength(1)
  })
})