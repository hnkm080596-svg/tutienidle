// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/game/GameManagerTurnBattleOps'
import { defineEnemy } from '../../core/enemy/Enemy'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { EarlyGameSession } from '../../core/simulation/earlygame/EarlyGameSession'
import { usePlayerStore } from '../../stores/player'
import { buildGameSave } from './SaveSystem'
import { useCombatPause } from '../../composables/useCombatPause'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r37 AUT wave. Blind adversarial audit of the r36
// adjudication at 796df2ee. Each r36 fix is assumed exploitable until the
// mechanism is traced and either broken or pinned:
//
//   (A) Cycle-epoch guard - same-generation edge (r36-AUT-2 follow-up).
//       beginTurnPipeline calls clearPendingSteps at its head, so every new
//       pipeline bumps pendingStepGeneration: within one epoch a signal is
//       armed AT MOST once. The "consumed-step queued fallback fires into a
//       re-armed same-signal settle" hypothesis is unreachable by
//       construction - a same-signal re-arm requires a new pipeline = a new
//       epoch = the stale closure bails on the epoch check. What remains is
//       the consumed-step queued fallback itself: pinned as a clean no-op
//       that cannot touch the surviving other-signal entries.
//   (B) 'user-pause' step-7 filter - freeze-timing edge. The snapshot+filter
//       is the LAST act of the synchronous cycle; a 'user-pause' crafted
//       inside the restart (via the presentation_session_started emit that
//       precedes it) is still filtered. Post-cycle it is a legitimate new
//       latch.
//   (C) setCombatClockSource preserve - the latch carry must land on the NEW
//       instance and reconnect's resumeCombat must unlatch it there.
//   (D) r36-AUT-1 ACK-drain bounds: stale tokens die after a restart, a
//       second terminal settlement cannot mint through the live channel.
//   (E) Curtain arm gate: isCombatActive reads the clock state only - a
//       'frozen' clock with NO battle (the accepted zombie residual) arms
//       isPaused + 'tab-hidden' over whatever screen is up. FINDING
//       r37-AUT-2 (Low).
//   (F) Boundary-queue drop: setBattleManualMode queues a SESSION-scoped
//       flag write onto the battle-scoped boundaryQueue, which combat-over
//       clears (onTurnDrained COMBAT_OVER). The toggle silently dies; the
//       stale flag persists into the next battle. FINDING r37-AUT-1 (Low).
//   (G) Deferral-arm bookkeeping asymmetry: the isBlocking() re-arm pushes
//       a fresh handle without splicing the just-fired one (the admin-latch
//       arm right above it does splice). Dead handles accumulate, bounded
//       by AWAIT_STEP_DEFERRAL_CAP_MS. FINDING r37-AUT-3 (Nit).
//   (H) r36-AUT-3 sim restore seam: restoreCheckpoint discards a parked
//       battle like the boot/reconnect admissions do.
//
// ASCII only (P15).
// ============================================================================

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

/** Parked 'ready' step under a released interactive session (not blocking). */
function parkInteractiveGhost(manager: GameManager) {
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  const player = startAStage(manager)
  const port = manager.getPresentationPort()
  const hold = port.hold(port.getCurrentSession()!)!
  port.attach(hold)
  port.release(hold)
  clock.advance(COMBAT_STEP_SECONDS * 260)

  const battle = manager.getTurnBattle()
  expect(battle).not.toBeNull()
  expect(manager.getTurnTokenState()).not.toBe('IDLE')
  const token = manager.getPendingPlaybackToken()
  expect(token).not.toBeNull()
  expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
  return { player, battle: battle!, token: token!, clock }
}

/**
 * Parked 'ready' step under a session that is then re-HELD so isBlocking()
 * flips true: the claim itself needs a non-blocking session (a held one
 * freezes 'not-revealed' upstream of the clock), so park released first.
 */
function parkThenBlock(manager: GameManager) {
  const ghost = parkInteractiveGhost(manager)
  const port = manager.getPresentationPort()
  port.hold(port.getCurrentSession()!)
  return ghost
}

function releaseCurrentSessionHold(manager: GameManager) {
  const port = manager.getPresentationPort()
  const session = port.getCurrentSession()
  expect(session).not.toBeNull()
  const hold = port.hold(session!)!
  port.attach(hold)
  port.release(hold)
}

/**
 * Queue-capture setTimeout replacement: armed callbacks land in `queue` and
 * are never auto-invoked; the test fires them by index. clearTimeout removes
 * the handle but the captured callback stays invocable - the real
 * uncancellable queued-task edge.
 */
function stubTimersToQueue() {
  const queue: Array<{ id: number; cb: () => void; ms: number }> = []
  let seq = 0
  vi.stubGlobal(
    'setTimeout',
    ((cb: () => void, ms: number) => {
      const id = ++seq
      queue.push({ id, cb, ms })
      return id
    }) as unknown as typeof setTimeout,
  )
  vi.stubGlobal('clearTimeout', (() => undefined) as unknown as typeof clearTimeout)
  return queue
}

function stepInternals(manager: GameManager) {
  return manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<unknown>
    pendingStepGeneration: number
  }
}

function runtimeInternals(manager: GameManager) {
  return (
    manager.turnBattleOps as unknown as {
      presentationOps: {
        runtime: {
          pendingReadyActor: unknown
          pendingDeclaredAction: unknown
          pendingImpact: unknown
        }
      }
    }
  ).presentationOps.runtime
}

function secondEnemy() {
  return defineEnemy({
    id: 'fixture_enemy_2',
    name: 'Fixture Dummy 2',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) Epoch guard, same-generation edge. Within one epoch each signal is
//     armed once; a queued fallback whose step already settled via the ACK
//     channel must be a clean no-op against the surviving other-signal
//     entries - including on double dispatch.
// ----------------------------------------------------------------------------

describe('r37 AUT - A: consumed-step stale fallback is inert inside its own epoch', () => {
  it("a double-dispatched 'ready' fallback post-ACK cannot touch the armed 'impact' settle", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const timers = stubTimersToQueue()

    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')

    const internals = stepInternals(manager)
    const casts: string[] = []
    manager.eventBus.on('turn_cast_start', (e: { actorId: string }) => casts.push(e.actorId))

    const token = manager.getPendingPlaybackToken()!
    const staleReadyCb = timers[0]!.cb

    // Live channel settles 'ready': the pipeline drains to 'impact', which
    // arms a fresh settle + fallback under the SAME epoch.
    manager.acknowledgeTurnReady(token)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(typeof internals.pendingStepDone['impact']).toBe('function')
    expect(runtimeInternals(manager).pendingDeclaredAction).not.toBeNull()
    expect(casts).toHaveLength(1)

    // The consumed step's queued fallback fires now (uncancellable task
    // edge), inside its own epoch: it may only touch pendingStepDone['ready']
    // (already undefined), and its drive lands on a consumed pendingReadyActor.
    staleReadyCb()
    staleReadyCb() // a second dispatch of the same captured closure

    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(typeof internals.pendingStepDone['impact']).toBe('function')
    expect(runtimeInternals(manager).pendingDeclaredAction).not.toBeNull()
    expect(casts).toHaveLength(1) // no second declare minted
    // totalTurnsElapsed counts DECLARES (declareActorAction) - the live
    // ready-ack already counted 1; the stale fallback must not add another.
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')

    // The live 'impact' settle still completes the turn normally.
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    manager.abandonBattle()
  })

  it("a stale 'impact' fallback post-ACK cannot drive a second impact or wipe the 'complete' settle", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const timers = stubTimersToQueue()

    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)

    const internals = stepInternals(manager)
    const token = manager.getPendingPlaybackToken()!

    manager.acknowledgeTurnReady(token)
    const staleImpactCb = timers[1]!.cb
    manager.acknowledgeActionImpact(token)
    const hpAfterImpact = manager.getTurnBattle()!.enemies[0]!.entity.currentHp
    expect(typeof internals.pendingStepDone['complete']).toBe('function')
    expect(runtimeInternals(manager).pendingImpact).not.toBeNull()

    staleImpactCb()
    staleImpactCb()

    // No second impact minted, the armed 'complete' settle untouched.
    expect(manager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBe(hpAfterImpact)
    expect(typeof internals.pendingStepDone['complete']).toBe('function')
    expect(runtimeInternals(manager).pendingImpact).not.toBeNull()
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1) // declare only, still

    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)

    manager.abandonBattle()
  })

  it('epoch moves once per turn: a new pipeline is a new generation (same-signal re-arm is always cross-epoch)', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')

    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    const internals = stepInternals(manager)
    const genAtTurn1 = internals.pendingStepGeneration

    const token = manager.getPendingPlaybackToken()!
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(internals.pendingStepGeneration).toBeGreaterThan(genAtTurn1)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (B) 'user-pause' filter timing. The snapshot+filter is the last act of the
//     synchronous cycle: a pause crafted INSIDE the restart still dies, and a
//     post-cycle pause is a legitimate new latch.
// ----------------------------------------------------------------------------

describe('r37 AUT - B: user-pause cannot be crafted through the restart window', () => {
  it('a user-pause frozen inside the synchronous cycle (presentation_session_started) is still filtered', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')

    // Craft: freeze 'user-pause' AND 'authority-pause' from inside the
    // restart itself - presentation_session_started fires inside
    // beginBattleCycle's synchronous run, AFTER clearCycleEntryState
    // (token.reset clears 'turn-in-flight') and BEFORE the step-7 snapshot.
    manager.eventBus.on('presentation_session_started', () => {
      manager.freezeCombat('user-pause')
      manager.freezeCombat('authority-pause')
    })

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())

    // 'user-pause' died with the old battle's snapshot even though it was
    // frozen mid-cycle; the session-scoped 'authority-pause' carries.
    const reasons = manager.getFreezeReasons()
    expect(reasons).not.toContain('user-pause')
    expect(reasons).toContain('authority-pause')
    expect(reasons).not.toContain('turn-in-flight')

    manager.resumeCombat('authority-pause')
    manager.abandonBattle()
  })

  it('control: a user-pause frozen AFTER the cycle is a normal latch on the new clock', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    manager.freezeCombat('user-pause')
    expect(manager.getFreezeReasons()).toContain('user-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.resumeCombat('user-pause')
    expect(manager.getFreezeReasons()).not.toContain('user-pause')

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) setCombatClockSource preserve: latches land on the NEW instance, the
//     token listener resumes 'turn-in-flight' there, and a reconnect-time
//     resumeCombat('authority-pause') unlatches the new clock.
// ----------------------------------------------------------------------------

describe('r37 AUT - C: source-swap preserve unlatches on the new instance', () => {
  it('a mid-reconnect swap keeps the latch, the ACK drain resolves, and resume hits the new clock', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)
    const hpBefore = battle.enemies[0]!.entity.currentHp

    manager.freezeCombat('authority-pause')
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['authority-pause', 'turn-in-flight']),
    )

    // Swap mid-reconnect: the carried reasons must be re-frozen on the NEW
    // clock instance, not orphaned on the dead one.
    const newClock = new ManualClockSource()
    manager.setCombatClockSource(newClock)
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['authority-pause', 'turn-in-flight']),
    )
    expect(manager.getCombatClockState()).toBe('frozen')

    // The drain still resolves the in-flight turn; the rebound token
    // listener resumes 'turn-in-flight' on the NEW instance.
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)

    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(hpBefore)
    expect(battle.totalTurnsElapsed).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])

    // The reconnect tail unlatches the same reason on the new instance.
    manager.resumeCombat('authority-pause')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')

    manager.abandonBattle()
  })

  it('a swap on a stopped clock keeps it stopped with no reasons', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    manager.abandonBattle()
    expect(manager.getCombatClockState()).toBe('stopped')

    manager.setCombatClockSource(new ManualClockSource())
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// (D) r36-AUT-1 ACK-drain bounds: tokens are per-turn; a stale token cannot
//     mint into a restarted battle, and the terminal settlement cannot be
//     driven twice through the live channel.
// ----------------------------------------------------------------------------

describe('r37 AUT - D: ACK channel stays inside the claimed turn', () => {
  it('stale-token ACKs after a cycle swap are rejected - no mint lands on the new battle', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    const staleToken = manager.getPendingPlaybackToken()!

    // Cycle swap evaporates the pending lineage (resetPendingState rotates
    // playbackToken to ''), then the new cycle claims and mints its own.
    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    const liveToken = manager.getPendingPlaybackToken()!
    expect(liveToken).not.toBe(staleToken)

    const newBattle = manager.getTurnBattle()!
    const hpBefore = newBattle.enemies[0]!.entity.currentHp
    const casts: string[] = []
    manager.eventBus.on('turn_cast_start', (e: { actorId: string }) => casts.push(e.actorId))

    // Every stale-token ACK bounces off the current playbackToken.
    manager.acknowledgeTurnReady(staleToken)
    manager.acknowledgeActionImpact(staleToken)
    manager.acknowledgeActionComplete(staleToken)

    expect(newBattle.enemies[0]!.entity.currentHp).toBe(hpBefore)
    expect(runtimeInternals(manager).pendingDeclaredAction).toBeNull()
    expect(casts).toHaveLength(0)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')

    manager.acknowledgeTurnReady(liveToken)
    expect(runtimeInternals(manager).pendingDeclaredAction).not.toBeNull()
    expect(casts).toHaveLength(1)

    manager.abandonBattle()
  })

  it('the terminal settlement cannot be driven twice: post-resolution ACKs are consumed-field rejects', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player, battle, token } = parkInteractiveGhost(manager)
    const ends: string[] = []
    manager.eventBus.on('battle_end', (e: { state: string }) => ends.push(e.state))

    battle.enemies[0]!.entity.currentHp = 1
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)

    expect(battle.state).toBe('victory')
    expect(ends).toEqual(['victory'])
    expect(player.completedStageIds).toContain('fixture_stage')

    // playbackToken is still the just-resolved turn's token (nothing rotated
    // it), so the token gate passes - the consumed pendingImpact field is
    // what rejects a second settlement.
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    manager.acknowledgeTurnReady(token)

    expect(ends).toEqual(['victory'])
    expect(battle.totalTurnsElapsed).toBe(1)
    expect(manager.getCombatClockState()).toBe('stopped')

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) Curtain arm gate (r37-AUT-2, Low): isCombatActive reads the clock
//     state only - 'frozen' passes the gate even with NO battle (the
//     accepted zombie residual), so a hidden tab arms isPaused +
//     'tab-hidden' over whatever screen is up. CombatPauseOverlay's v-if is
//     unconditional on screen.
// ----------------------------------------------------------------------------

describe('r37 AUT - E: curtain arms on clock state, not battle presence', () => {
  function stubDocumentHidden() {
    const handlers = new Map<string, () => void>()
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
      removeEventListener: () => undefined,
    })
    return handlers
  }

  function stubOwner(state: 'stopped' | 'frozen' | 'running') {
    const owner = {
      clockState: state,
      freezes: [] as string[],
      resumes: [] as string[],
      freezeCombat(reason: string) {
        this.freezes.push(reason)
      },
      resumeCombat(reason: string) {
        this.resumes.push(reason)
      },
      getCombatClockState() {
        return this.clockState
      },
    }
    const pause = useCombatPause(owner as never, {
      isCombatActive: () => owner.getCombatClockState() !== 'stopped',
    })
    return { owner, pause }
  }

  it("a 'frozen' battle-less clock (zombie residual) arms the curtain on hide", () => {
    const handlers = stubDocumentHidden()
    const { owner, pause } = stubOwner('frozen')
    handlers.get('visibilitychange')!()
    expect(pause.isPaused.value).toBe(true)
    expect(owner.freezes).toEqual(['tab-hidden'])
    pause.dispose()
  })

  it('a stopped clock does not arm the curtain (the intended gate)', () => {
    const handlers = stubDocumentHidden()
    const { owner, pause } = stubOwner('stopped')
    handlers.get('visibilitychange')!()
    expect(pause.isPaused.value).toBe(false)
    expect(owner.freezes).toEqual([])
    pause.dispose()
  })
})

// ----------------------------------------------------------------------------
// (F) Boundary-queue drop (r37-AUT-1, Low): setBattleManualMode queues a
//     session-scoped flag write onto the battle-scoped queue; combat-over
//     clears the queue before the flip lands, and the stale flag persists
//     into the next battle.
// ----------------------------------------------------------------------------

describe('r37 AUT - F: queued manual-mode flips die at combat-over', () => {
  it('a mid-turn enable is dropped when the in-flight turn ends the battle', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)
    expect(manager.isBattleManualMode()).toBe(false)

    // Token is RESOLVING (a turn in flight) -> the flag write queues.
    manager.setBattleManualMode(true)

    // This turn ends the battle: onTurnDrained -> COMBAT_OVER clears
    // boundaryQueue before drainBoundaryQueueIfIdle can ever run.
    battle.enemies[0]!.entity.currentHp = 1
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(battle.state).toBe('victory')

    // The toggle silently died: the session-scoped flag kept its old value.
    expect(manager.isBattleManualMode()).toBe(false)
    manager.abandonBattle()
  })

  it('control: the same queued flip lands after a non-terminal boundary', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token, clock } = parkInteractiveGhost(manager)
    battle.enemies[0]!.entity.currentHp = 1_000_000

    manager.setBattleManualMode(true)
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(battle.state).toBe('fighting')
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // Next fighting step: drainBoundaryQueueIfIdle flushes the queued flip.
    clock.advance(COMBAT_STEP_SECONDS)
    expect(manager.isBattleManualMode()).toBe(true)
    manager.abandonBattle()
  })

  it('the flag is session-scoped: whatever value it holds persists across cycles', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)

    // Token is IDLE during intro: the flip runs immediately (not queued).
    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(true)

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    // resetPendingState does NOT clear battleManualMode - the next battle
    // inherits it verbatim (so a dropped flip keeps the STALE value).
    expect(manager.isBattleManualMode()).toBe(true)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (G) Deferral-arm dead handles (r37-AUT-3, Nit): the isBlocking() re-arm
//     path pushes a new handle without splicing the fired one - unlike the
//     admin-latch arm directly above it. Bounded by the deferral cap.
// ----------------------------------------------------------------------------

describe('r37 AUT - G: deferral re-arm leaves dead handles (bounded)', () => {
  it('each deferral fire appends a handle; the fired one is never spliced', () => {
    const manager = registeredManager()
    const timers = stubTimersToQueue()
    parkThenBlock(manager)

    const internals = stepInternals(manager)
    const baseline = internals.pendingStepTimers.length
    expect(baseline).toBe(1)

    // isBlocking() is true (held session) and no admin latch is set - the
    // fallback takes the deferral arm: push without splice. Three fires.
    const armedCb = timers[timers.length - 1]!.cb
    armedCb()
    armedCb()
    armedCb()

    expect(internals.pendingStepTimers.length).toBe(baseline + 3)
    expect(timers.length).toBeGreaterThanOrEqual(baseline + 3)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (H) r36-AUT-3 sim seam: restoreCheckpoint discards a parked battle exactly
//     like the boot/reconnect admissions.
// ----------------------------------------------------------------------------

describe('r37 AUT - H: EarlyGameSession.restoreCheckpoint sweeps a parked battle', () => {
  it('a mid-park restore discards battle, token, pending playback and stops the clock', () => {
    vi.useFakeTimers()
    const session = new EarlyGameSession({ seed: 7, profile: { name: 'probe', talentIds: ['hap_linh'] } })
    const gm = session.gameManager
    gm.setPresentationActive(true)
    gm.setPresentationMode('interactive')
    gm.turnBattleOps.startBattleWithPlayer(session.player, secondEnemy())
    const port = gm.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    session.clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(gm.getTurnTokenState()).toBe('RESOLVING')
    expect(gm.getPendingPlaybackToken()).not.toBeNull()

    const save = buildGameSave(session.player, gm)
    const owner = usePlayerStore()
    const result = session.restoreCheckpoint(save, owner)

    expect(result.status).toBe('ok')
    expect(gm.getTurnBattle()).toBeNull()
    expect(gm.getTurnTokenState()).toBe('IDLE')
    expect(gm.getPendingPlaybackToken()).toBeNull()
    expect(gm.getCombatClockState()).toBe('stopped')
    expect(session.player).toBe(owner.$state)
  })
})
