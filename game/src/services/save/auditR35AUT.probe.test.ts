// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/game/GameManagerTurnBattleOps'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { buildGameSave } from './SaveSystem'
import { primeMortalCreationPick } from './GameSave.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r35 AUT wave. Blind adversarial audit of the r34
// adjudication at b1ffef6c: discardStaleBattle() immediately before
// authority.markReady() in useAppLifecycle.bootGame, the tail try/catch
// re-latch, and authority.beginChecking() inside the outer try.
//
//   (A) Discard teardown, attacked field-by-field: every cleared surface
//       observed after discardStaleBattle() on a live mid-turn interactive
//       battle; pending real-time step timers must be dead; a second
//       discard and a null-battle discard must be clean no-ops; the
//       catch-arm freezeCombat must no-op on the stopped clock.
//   (B) The ghost does not need the unlatch: awaitStep parks real-time
//       setTimeout fallbacks (ANIMATION_FALLBACK_MS) that drive the turn
//       pipeline while the CombatClock is frozen or stopped. A
//       released/interactive session is not isBlocking(), so the fallback
//       drives mechanically. Executed: a parked turn resolves to a
//       terminal victory - completedStageIds mint lands on the bound
//       player object - while the clock never advances. Reachability
//       bound: the post-rebind awaits inside bootGame (the remote
//       post-accrual commit leg and the grant-path firstSave) are the
//       only windows between $state rebind and the :740 discard.
//   (C) Shipped contract + sibling seams: 'entered' boots are battleless
//       with no terminal emitted; a second bootGame mid-flight returns
//       'skipped'; stopAll mid-commit skips with the zombie latched.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

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

function lifecycleStubs() {
  const intervals: Array<() => void> = []
  return {
    intervals,
    clock: { start: vi.fn(), stop: vi.fn(), nowSeconds: () => 0 },
    scheduleInterval: (cb: () => void) => (intervals.push(cb), intervals.length),
    clearHandle: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot: {
      startSaveLoad: vi.fn(),
      startInitializing: vi.fn(),
      enterGame: vi.fn(),
      fail: vi.fn(),
      requireCharacter: vi.fn(),
      showAuth: vi.fn(),
    },
    coordinator: {
      load: vi.fn(async () => ({ status: 'empty' as const, revision: 0 as const })) as {
        (data?: unknown): Promise<Record<string, unknown>>
      },
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      reset: vi.fn(),
      capability: 'local-only' as 'local-only' | 'remote-authoritative',
    },
    player: { save: vi.fn(), restoreFromSave: vi.fn(), $state: {} },
    authority: {
      canMutate: vi.fn(() => true),
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
    },
    tick: vi.fn(),
    gameManager: {
      eventBus: { on: vi.fn(), off: vi.fn() },
    } as unknown as GameManagerType,
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn() },
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({ status: 'ok' })),
    persistPlayer: vi.fn(async () => ({ status: 'ok', revision: 1 })),
    onError: vi.fn(),
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
  }
}

/** A boot-loadable save wired through the same shape the boot arm admits. */
function loadableSave() {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer)))
}

/**
 * A battle parked mid-turn under an interactive presentation whose session
 * hold was released (the leave-combat-route production path runs
 * port.release on the hold token). Released + interactive => isBlocking()
 * false, so every awaitStep fallback drives its step mechanically on real
 * time. The parked 'ready' step freezes the clock via 'turn-in-flight';
 * combatClock is left running-but-frozen exactly like a latched zombie.
 */
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
  expect(manager.getPendingPlaybackToken()).not.toBeNull()
  return { player, battle: battle! }
}

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  // combatRng is FunctionCombatRng(() => Math.random()) - built to be
  // intercepted here. Pin it to 0: every positive-probability roll
  // succeeds (hits land) and every zero-probability one fails (no dodge),
  // so kill assertions are deterministic instead of RNG-flaky.
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) discardInFlightBattle attacked field-by-field.
// ----------------------------------------------------------------------------

describe('r35 AUT - A: discardStaleBattle teardown under a live mid-turn ghost', () => {
  it('clears every per-battle surface: battle, session, token, pending playback, clock, freeze reasons', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)

    manager.discardStaleBattle()

    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCurrentPresentationSession()).toBeNull()
    expect(manager.getPendingPlaybackToken()).toBeNull()
    expect(manager.preparePresentationResume()).toBeNull()
    expect(manager.abandonBattle()).toBe(false)
  })

  it('kills the parked real-time step timers: no mechanical drain, no replay after discard', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    manager.discardStaleBattle()
    // 40s of real time = the whole parked pipeline's fallback budget
    // (3 steps x up to 8 deferrals each). Nothing may fire.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 10)

    expect(warn).not.toHaveBeenCalled()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getPendingPlaybackToken()).toBeNull()
    warn.mockRestore()
  })

  it('a stale renderer ACK after discard is a no-op: no step work, no token drift', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    const staleToken = manager.getPendingPlaybackToken()!

    manager.discardStaleBattle()

    expect(() => manager.acknowledgeTurnReady(staleToken)).not.toThrow()
    expect(() => manager.acknowledgeActionImpact(staleToken)).not.toThrow()
    expect(() => manager.acknowledgeActionComplete(staleToken)).not.toThrow()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()).toBeNull()
  })

  it('is idempotent and a true no-op on an empty manager', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const empty = new GameManager()
    empty.setCombatClockSource(new ManualClockSource())

    expect(() => manager.discardStaleBattle()).not.toThrow()
    expect(() => manager.discardStaleBattle()).not.toThrow()
    expect(() => empty.discardStaleBattle()).not.toThrow()
    expect(empty.getTurnBattle()).toBeNull()
    expect(empty.getCombatClockState()).toBe('stopped')
  })

  it('the tail catch arm is deny-direction: freezeCombat/resumeCombat no-op on the stopped clock', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)

    manager.discardStaleBattle()
    // The r34 catch arm: freezeCombat('authority-pause') after a tail
    // throw. Post-discard the clock is 'stopped', so freeze() is a
    // documented no-op - the re-latch cannot resurrect a reason set that
    // stop() already cleared.
    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    manager.resumeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// (B) The ghost drives on real time - the unlatch was never required.
// ----------------------------------------------------------------------------

describe('r35 AUT - B: parked pipeline resolves on real-time fallbacks under a frozen clock', () => {
  it('a released-session ghost completes its parked turn while the combat clock stays frozen', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkInteractiveGhost(manager)
    const turnsBefore = battle.totalTurnsElapsed ?? 0

    // The r34 comment frames the danger as 'the unlatch below would
    // resume the ghost' - but the pendingStep timers never consulted the
    // combat clock. Latch it like a boot pause does; the clock contributes
    // zero frames from here on.
    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    // Three parked steps (ready -> impact -> complete), each settled by
    // one 4s fallback tick on wall-clock time. No clock.advance() calls.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)

    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(battle.totalTurnsElapsed).toBe(turnsBefore + 1)
  })

  it('a terminal ghost drain mints into the bound player object while the clock is frozen', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player, battle } = parkInteractiveGhost(manager)
    const ends: string[] = []
    manager.eventBus.on('battle_end', (e: { state: string }) => ends.push(e.state))

    // One hit kills: the parked turn's impact step is the terminal one.
    battle.enemies[0]!.entity.currentHp = 1
    expect(player.completedStageIds).toEqual([])

    manager.freezeCombat('authority-pause')

    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)

    // The dead battle resolved to victory on real time and banked the
    // stage completion into playerDataForTurnBattle - the same object a
    // restore rebinds in place. This write lands on whichever character
    // owns that object at drain time.
    expect(battle.state).toBe('victory')
    expect(ends).toEqual(['victory'])
    expect(player.completedStageIds).toContain('fixture_stage')
    // Terminal resolve marks the token COMBAT_OVER (never IDLE again) -
    // and settleCombatOutcome's own combatClock.stop() both stops the
    // clock AND clears the 'authority-pause' latch entirely. The ghost
    // terminal erased the freeze the boot pause relied on.
    expect(manager.getTurnTokenState()).toBe('COMBAT_OVER')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
  })

  it('a repeat-continuously ghost self-unlatches: victory restarts a live running battle', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager, { repeatContinuously: true })
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)

    const oldBattle = manager.getTurnBattle()!
    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    // The terminal drain runs on real time; settleCombatOutcome sees
    // victory + repeatContinuously + live stage lease ->
    // restartTurnBattleCycle -> beginBattleCycle -> combatClock.stop()
    // (clears EVERY reason incl. 'authority-pause') + start().
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)

    const newBattle = manager.getTurnBattle()
    expect(newBattle).not.toBeNull()
    expect(newBattle).not.toBe(oldBattle)
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(oldBattle.state).toBe('victory')
    expect(player.completedStageIds).toContain('fixture_stage')

    // The replacement ghost is fully live: it claims turns and parks its
    // own pipeline, which the same real-time fallback keeps driving.
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getPendingPlaybackToken()).not.toBeNull()
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(newBattle!.totalTurnsElapsed).toBeGreaterThan(0)

    manager.discardStaleBattle()
  })

  it('the mint survives the in-place $state rebind: the write lands after Object.assign', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player, battle } = parkInteractiveGhost(manager)
    battle.enemies[0]!.entity.currentHp = 1

    // Model restoreFromSave: player.$state is rebound IN PLACE (Object.assign
    // + stale-key sweep), so playerDataForTurnBattle - this same object -
    // now belongs to the loaded character.
    const reboundFields = JSON.parse(JSON.stringify(createDefaultPlayer()))
    Object.assign(player, reboundFields)
    expect(player.completedStageIds).toEqual([])

    manager.freezeCombat('authority-pause')
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)

    // The 'new character' records a stage clear it never fought.
    expect(battle.state).toBe('victory')
    expect(player.completedStageIds).toContain('fixture_stage')
  })

  it('a held session only delays the ghost: the deferral cap drains the turn anyway', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    startAStage(manager)
    const port = manager.getPresentationPort()
    // An interactive pipeline mints playback work only once a session has
    // attached (the receipt-test recipe), so hold+attach+release first -
    // then a fresh hold() puts the session back into blocking state.
    const attachHold = port.hold(port.getCurrentSession()!)!
    port.attach(attachHold)
    port.release(attachHold)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getPendingPlaybackToken()).not.toBeNull()

    // Re-hold the session: isBlocking() true => each fallback invocation
    // re-arms instead of driving, up to the 8x deferral cap - then drains
    // mechanically. 'frozen' never blocks the timer path.
    const hold = port.hold(port.getCurrentSession()!)!
    manager.freezeCombat('authority-pause')
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Held blocking: each 4s tick defers (re-arms) rather than driving -
    // at the 8x cap the step drains mechanically instead, then the NEXT
    // step parks and re-defers from zero. Assert the token stayed claimed
    // through the first cap, then let every remaining step's deferral
    // budget elapse - the held turn still completes on real time.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 16)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)

    port.attach(hold)
    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) The shipped contract + sibling seams under the real bootGame.
// ----------------------------------------------------------------------------

describe('r35 AUT - C: bootGame contract and sibling seams', () => {
  it("'entered' boot discards the latched ghost silently - no terminal, no banking, clean clock", async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkInteractiveGhost(manager)
    const ends: string[] = []
    manager.eventBus.on('battle_end', (e: { state: string }) => ends.push(e.state))
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    stubs.boot.enterGame = vi.fn(() => {
      stubs.entryStage.value = 'game'
    })

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('entered')
    expect(stubs.authority.markReady).toHaveBeenCalledTimes(1)
    // The discard ran: no battle, no session, no pending steps.
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCurrentPresentationSession()).toBeNull()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    // Silent teardown: the ghost earned no battle_end and banked nothing.
    expect(ends).toEqual([])
    expect(manager.getTurnBattle()).not.toBe(battle)
    // Post-discard contract: the combat clock stays 'stopped' (the r34
    // pin - clock.start() on the tail is the lifecycle GameClock, not
    // combat; a battleless entered boot carries a stopped combat clock
    // and an empty reason set; the next beginBattleCycle starts it).
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    lifecycle.stopAll()
  })

  it('the ghost cannot mint during the local-mode load arm - no real-time await exists pre-discard', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkInteractiveGhost(manager)
    battle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.capability = 'local-only'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    // capability 'local-only' skips the remote commit leg: no real-time
    // window exists between rebind and discard, so the ghost stays parked
    // at its claim and dies with 0 turns resolved.
    expect(outcome.status).toBe('entered')
    expect(battle.state).not.toBe('victory')
    expect(manager.getTurnBattle()).toBeNull()

    lifecycle.stopAll()
  })

  it('remote commit leg is a live window: the ghost drains inside the player.save await', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player, battle } = parkInteractiveGhost(manager)
    battle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.capability = 'remote-authoritative'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    // Model the restoreGameSession in-place rebind: the ghost's bound
    // player object becomes the loaded character's live $state.
    stubs.restoreGameSession = vi.fn(() => {
      Object.assign(player, JSON.parse(JSON.stringify(createDefaultPlayer())))
      return { status: 'ok' as const }
    })
    // The commit leg: player.save parks on the wire. Hold it open.
    let resolveSave: ((v: { status: 'ok'; revision: number }) => void) | undefined
    stubs.player.save = vi.fn(
      () => new Promise<{ status: 'ok'; revision: number }>((resolve) => {
        resolveSave = resolve
      }),
    )

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const pending = lifecycle.bootGame({ createNewCharacter: false })

    // Advance microtasks until boot is parked on the commit await.
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(stubs.player.save).toHaveBeenCalledTimes(1)

    // Real time passes inside the commit window: the released-session
    // fallback drains the ghost's parked pipeline against the clock that
    // never advanced - the terminal settle mints the stage clear onto the
    // REBOUND player object before the discard at :740 runs.
    await vi.advanceTimersByTimeAsync(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(battle.state).toBe('victory')
    expect(player.completedStageIds).toContain('fixture_stage')

    resolveSave!({ status: 'ok', revision: 1 })
    const outcome = await pending

    // The window then closes exactly as designed: discard runs, boot
    // enters battleless, and the mint is already persisted-authoritative.
    expect(outcome.status).toBe('entered')
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(player.completedStageIds).toContain('fixture_stage')

    lifecycle.stopAll()
  })

  it('a second bootGame mid-flight is skipped - no concurrent discard interleave', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.capability = 'remote-authoritative'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    let resolveSave: ((v: { status: 'ok'; revision: number }) => void) | undefined
    stubs.player.save = vi.fn(
      () => new Promise<{ status: 'ok'; revision: number }>((resolve) => {
        resolveSave = resolve
      }),
    )

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const pending = lifecycle.bootGame({ createNewCharacter: false })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(stubs.player.save).toHaveBeenCalledTimes(1)

    const second = await lifecycle.bootGame({ createNewCharacter: false })
    expect(second.status).toBe('skipped')

    resolveSave!({ status: 'ok', revision: 1 })
    expect((await pending).status).toBe('entered')

    lifecycle.stopAll()
  })

  it('stopAll during the commit await skips the boot and keeps the latched zombie (fail-safe)', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.capability = 'remote-authoritative'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    let resolveSave: ((v: { status: 'ok'; revision: number }) => void) | undefined
    stubs.player.save = vi.fn(
      () => new Promise<{ status: 'ok'; revision: number }>((resolve) => {
        resolveSave = resolve
      }),
    )

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const pending = lifecycle.bootGame({ createNewCharacter: false })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(stubs.player.save).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
    resolveSave!({ status: 'ok', revision: 1 })
    const outcome = await pending

    // Generation fence: the discard and markReady never ran; the zombie
    // stays latched (deny direction, same as the firstSave-arm pin).
    expect(outcome.status).toBe('skipped')
    expect(stubs.authority.markReady).not.toHaveBeenCalled()
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')
  })

  it('FAILED boot + repeat ghost: the kept zombie is RUNNING, not frozen - and keeps farming', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager, { repeatContinuously: true })
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    const oldBattle = manager.getTurnBattle()!
    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.capability = 'remote-authoritative'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    stubs.restoreGameSession = vi.fn(() => {
      Object.assign(player, JSON.parse(JSON.stringify(createDefaultPlayer())))
      return { status: 'ok' as const }
    })
    let resolveSave: ((v: { status: 'unavailable'; message: string; retryable: boolean }) => void) | undefined
    stubs.player.save = vi.fn(
      () => new Promise<{ status: 'unavailable'; message: string; retryable: boolean }>((resolve) => {
        resolveSave = resolve
      }),
    )

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const pending = lifecycle.bootGame({ createNewCharacter: false })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(stubs.player.save).toHaveBeenCalledTimes(1)

    // The ghost's terminal drain fires INSIDE the commit await: victory
    // on a repeatContinuously stage restarts a fresh cycle -
    // beginBattleCycle's own stop()+start() clears 'authority-pause' and
    // leaves the combat clock RUNNING.
    await vi.advanceTimersByTimeAsync(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getTurnBattle()).not.toBe(oldBattle)

    // The commit refuses (retryable unavailable): boot.fail() -> 'failed'
    // -> the r33 zombie doctrine keeps the battle untouched. What is kept
    // is NOT the frozen zombie the doctrine assumes: it is a live running
    // cycle behind the error surface, where pauseSimulation() can never
    // re-latch (entryStage is 'error', not 'game').
    resolveSave!({ status: 'unavailable', message: 'refused', retryable: true })
    const outcome = await pending
    expect(outcome.status).toBe('failed')
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(player.completedStageIds).toContain('fixture_stage')

    // And it keeps progressing on clock frames (RAF in prod) + real-time
    // fallbacks - the error surface is a live auto-farm: the kept battle
    // resolves to yet another victory and a THIRD cycle spins up.
    const farm = manager.getTurnBattle()!
    clock.advance(COMBAT_STEP_SECONDS * 260)
    farm.enemies[0]!.entity.currentHp = 1
    await vi.advanceTimersByTimeAsync(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(farm.state).toBe('victory')
    expect(manager.getTurnBattle()).not.toBe(farm)

    lifecycle.stopAll()
  })
})
