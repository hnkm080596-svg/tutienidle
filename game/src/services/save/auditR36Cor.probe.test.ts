// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/battle/turn/TurnBattleConstants'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { defineEnemy } from '../../core/enemy/Enemy'
import type { Stage } from '../../core/stage/Stage'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { OnlineSessionController } from '../session/OnlineSessionController'
import { buildGameSave, restoreGameSession } from './SaveSystem'
import type { GameSave } from './SaveSystem'
import { primeMortalCreationPick } from './GameSave.fixture'
import { usePlayerStore } from '../../stores/player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r36 COR wave. Blind correctness audit of the r35
// adjudication at bb7bc574. Sections:
//
//   (A) App.vue onResume arm enumeration through the REAL controller +
//       REAL restoreGameSession + REAL lifecycle: exactly the
//       'replaced'&&save&&ok arm pays discardStaleBattle, strictly after
//       the restore lands and strictly before resumeSimulation unlatches
//       'authority-pause'. The rejected arm keeps the frozen zombie
//       (markFailed + bootFlow.fail, no unlatch). 'same' never rebinds,
//       so it pays nothing.
//   (B) discardInFlightBattle symmetric clear vs the beginBattleCycle
//       minted set: the three newly-cleared per-battle fields
//       (turnRuntime / battleBuffRegistry / combatScheduler) are
//       undefined post-discard while the documented session-lifetime
//       pair (turnBattleSystem engine, combatRng stream) stays mounted.
//   (C) awaitStep fallback gate: the dead-battle check is evaluated at
//       FIRE time (three drop conditions pinned), the re-mint race is
//       impossible (every teardown path wipes pendingStepDone +
//       pendingStepTimers wholesale), and the administrative-latch gate
//       re-arms without growing deferredMs - at the cost of +1 dead
//       handle in pendingStepTimers per re-fire (r36-COR-1 evidence).
//   (D) beginBattleCycle step-7 latch-preserving restart: snapshotted
//       administrative reasons survive stop()+start(); 'not-revealed'
//       is re-derived from live session state (a stale snapshot value
//       is corrected); 'user-pause' also survives - the r36-COR-3
//       owner-desync pin.
//   (E) Adjacent seam: setCombatClockSource still runs the pre-r35
//       stop()+start() reason wipe on a frozen clock (r36-COR-2 pin).
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
      capability: 'local-only' as const,
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

function buildSaveFor(playerName: string) {
  const writer = registeredManager()
  const player = { ...createDefaultPlayer(), name: playerName }
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer)))
}

// startAStage binds its own PlayerData; this variant binds the Pinia
// store's $state - the object restoreGameSession mutates in place.
function startStoreStage(manager: GameManager, store: ReturnType<typeof usePlayerStore>) {
  const stage: Stage = {
    id: 'fixture_stage',
    name: 'fixture_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'fixture_stage_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
  const enemy = defineEnemy({
    id: 'fixture_stage_dummy',
    name: 'Fixture Dummy',
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
  manager.catalogOps.registerEnemyTemplates([enemy])
  manager.catalogOps.registerStages([stage])
  manager.setActivePlayer(store.$state)
  if (!manager.turnBattleOps.startStage(store.$state, stage, true)) {
    throw new Error('startStoreStage failed to start fixture_stage')
  }
}

/** Reaches a parked interactive step: attach+release then advance the
 *  combat clock until a turn claims the token and parks on a playback
 *  token (the r35 AUT wave's interactive-ghost recipe). */
function parkInteractiveStep(manager: GameManager, clock: ManualClockSource): void {
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  const port = manager.getPresentationPort()
  const attachHold = port.hold(port.getCurrentSession()!)!
  port.attach(attachHold)
  port.release(attachHold)
  clock.advance(COMBAT_STEP_SECONDS * 260)
  expect(manager.getPendingPlaybackToken()).not.toBeNull()
}

const opsInternals = (manager: GameManager) =>
  manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<ReturnType<typeof setTimeout>>
    turnRuntime: unknown
    battleBuffRegistry: unknown
    combatScheduler: unknown
    turnBattleSystem: unknown
    combatRng: unknown
    combatClock: { stop(): void; getState(): string }
    turnBattle: { state: string } | null
    presentationOps: { session: { isBlocking(): boolean } }
    restartTurnBattleCycle(): void
    settleStep(signal: 'ready' | 'impact' | 'complete'): void
    awaitStep(signal: 'ready' | 'impact' | 'complete', done: () => void): void
  }

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) onResume arm enumeration: only 'replaced'&&save&&ok pays the discard,
//     strictly between the restore landing and the resumeSimulation unlatch.
// ----------------------------------------------------------------------------

describe('r36 COR - A: onResume arm enumeration', () => {
  it("A1 'replaced'&&save&&ok: restore lands first, discard second, unlatch last - aftermath is battleless 'stopped' []", async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    const store = usePlayerStore()
    startStoreStage(manager, store)
    manager.resumeCombat('not-revealed')
    expect(manager.getCombatClockState()).toBe('running')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    lifecycle.pauseSimulation()
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('authority-pause')

    // Semantic order pin, stronger than call order: if the discard ran
    // BEFORE the restore it would observe the OLD character name; if
    // resumeCombat ran BEFORE the discard the clock would still be
    // frozen (resume() deletes the reason, the clock then runs).
    const ownerAtDiscard: string[] = []
    const clockAtResume: string[] = []
    const discardSpy = vi.spyOn(manager, 'discardStaleBattle').mockImplementation(() => {
      ownerAtDiscard.push(store.$state.name)
      return Object.getPrototypeOf(manager).discardStaleBattle.call(manager)
    })
    const resumeCombatSpy = vi
      .spyOn(manager, 'resumeCombat')
      .mockImplementation((reason: Parameters<GameManager['resumeCombat']>[0]) => {
        clockAtResume.push(manager.getCombatClockState())
        return Object.getPrototypeOf(manager).resumeCombat.call(manager, reason)
      })

    const replacementSave = buildSaveFor('Ke Tiec Quyen') as GameSave
    const intervals: Array<() => void> = []
    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' as const }),
      monotonicNow: () => 0,
      scheduleInterval: (cb) => (intervals.push(cb), intervals.length),
      clearHandle: vi.fn(),
      reconnect: async () => ({
        status: 'resumed' as const,
        lineage: 'replaced' as const,
        save: replacementSave,
        serverAuthority: { serverNowMs: currentMs },
      }),
      onPause: () => lifecycle.pauseSimulation(),
      // Verbatim App.vue:704 onResume arm post-r35: restore in place,
      // discardStaleBattle(), then resumeSimulation().
      onResume: (lineage, save, serverAuthority) => {
        if (lineage === 'replaced' && save) {
          const restored = restoreGameSession(store as never, manager, save, {
            kind: 'live-replacement',
            nowMs: serverAuthority?.serverNowMs ?? Date.now(),
          })
          if (restored.status === 'rejected') {
            controller.markFailed('recovery')
            stubs.saveIssue.report('corrupted', JSON.stringify(save))
            stubs.boot.fail()
            return
          }
          manager.discardStaleBattle()
        }
        lifecycle.resumeSimulation()
      },
    })

    controller.beginChecking()
    controller.markReady()
    controller.pause('heartbeat-timeout')
    await vi.waitFor(() => expect(controller.authorityState).toBe('ready'))

    // The restore landed BEFORE the discard: the discard observed the
    // replacement character as the $state owner, not the ghost's.
    expect(ownerAtDiscard).toEqual(['Ke Tiec Quyen'])
    expect(discardSpy).toHaveBeenCalledTimes(1)
    // The unlatch ran AFTER the discard: the clock was already stopped
    // when resumeCombat('authority-pause') arrived (resume() no-ops on a
    // stopped clock), and the call ordering is strictly discard < resume.
    expect(resumeCombatSpy).toHaveBeenCalled()
    expect(clockAtResume).toEqual(['stopped'])
    expect(discardSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      resumeCombatSpy.mock.invocationCallOrder[0]!,
    )
    // Aftermath coherence: battle gone AND clock stopped AND reasons
    // cleared - the r34 contract on the sibling seam.
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.turnBattleOps.getStageProgress()).toBeNull()
    const stepsBefore = manager.getElapsedCombatSteps()
    combatSource.advance(6)
    expect(manager.getElapsedCombatSteps()).toBe(stepsBefore)
    lifecycle.stopAll()
  })

  it("A2 'replaced'&&save&&REJECTED: markFailed+fail+return - no discard, no unlatch, frozen zombie kept", async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    const store = usePlayerStore()
    startStoreStage(manager, store)
    manager.resumeCombat('not-revealed')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    lifecycle.pauseSimulation()
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    const resumeSpy = vi.spyOn(lifecycle, 'resumeSimulation')

    // Genuine rejection: the preflight's registry check throws on a
    // material id no registered catalog knows - the REAL
    // restoreGameSession returns status 'rejected'.
    const poisoned = buildSaveFor('Poisoned') as GameSave
    poisoned.materials = [
      ...(poisoned.materials ?? []),
      { materialId: 'r36_bogus_material', amount: 1, acquiredAtMs: currentMs } as never,
    ]

    const intervals: Array<() => void> = []
    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' as const }),
      monotonicNow: () => 0,
      scheduleInterval: (cb) => (intervals.push(cb), intervals.length),
      clearHandle: vi.fn(),
      reconnect: async () => ({
        status: 'resumed' as const,
        lineage: 'replaced' as const,
        save: poisoned,
        serverAuthority: { serverNowMs: currentMs },
      }),
      onPause: () => lifecycle.pauseSimulation(),
      onResume: (lineage, save, serverAuthority) => {
        if (lineage === 'replaced' && save) {
          const restored = restoreGameSession(store as never, manager, save, {
            kind: 'live-replacement',
            nowMs: serverAuthority?.serverNowMs ?? Date.now(),
          })
          if (restored.status === 'rejected') {
            controller.markFailed('recovery')
            stubs.saveIssue.report('corrupted', JSON.stringify(save))
            stubs.boot.fail()
            return
          }
          manager.discardStaleBattle()
        }
        lifecycle.resumeSimulation()
      },
    })
    const discardSpy = vi.spyOn(manager, 'discardStaleBattle')

    controller.beginChecking()
    controller.markReady()
    controller.pause('heartbeat-timeout')
    await vi.waitFor(() => expect(controller.authorityState).toBe('recovery'))

    expect(discardSpy).not.toHaveBeenCalled()
    expect(resumeSpy).not.toHaveBeenCalled()
    expect(stubs.saveIssue.report).toHaveBeenCalledTimes(1)
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    // Frozen zombie kept, exactly like the boot-path fail contract: the
    // battle survives latched until a future successful admission pays
    // the discard.
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    lifecycle.stopAll()
  })

  it("A3 'same' lineage: no restore, no discard - the unlatch resumes the legitimately owned battle", async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    const store = usePlayerStore()
    startStoreStage(manager, store)
    manager.resumeCombat('not-revealed')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'game'
    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    lifecycle.pauseSimulation()

    const discardSpy = vi.spyOn(manager, 'discardStaleBattle')
    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' as const }),
      monotonicNow: () => 0,
      scheduleInterval: vi.fn(() => 1),
      clearHandle: vi.fn(),
      reconnect: async () => ({ status: 'resumed' as const, lineage: 'same' as const }),
      onPause: () => lifecycle.pauseSimulation(),
      onResume: (lineage, save, serverAuthority) => {
        if (lineage === 'replaced' && save) {
          const restored = restoreGameSession(store as never, manager, save, {
            kind: 'live-replacement',
            nowMs: serverAuthority?.serverNowMs ?? Date.now(),
          })
          if (restored.status === 'rejected') {
            controller.markFailed('recovery')
            stubs.boot.fail()
            return
          }
          manager.discardStaleBattle()
        }
        lifecycle.resumeSimulation()
      },
    })

    controller.beginChecking()
    controller.markReady()
    controller.pause('heartbeat-timeout')
    await vi.waitFor(() => expect(controller.authorityState).toBe('ready'))

    expect(discardSpy).not.toHaveBeenCalled()
    expect(manager.getTurnBattle()).not.toBeNull()
    expect(manager.getCombatClockState()).toBe('running')
    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (B) symmetric clear: minted set vs cleared set, field by field.
// ----------------------------------------------------------------------------

describe('r36 COR - B: discardInFlightBattle clears the per-battle minted set', () => {
  it('the r35-INT-2 trio is undefined post-discard; the engine pair stays by design; readers answer idle', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    const ops = opsInternals(manager)

    // Minted set present pre-discard.
    expect(ops.turnRuntime).not.toBeUndefined()
    expect(ops.battleBuffRegistry).not.toBeUndefined()
    expect(ops.combatScheduler).not.toBeUndefined()
    expect(ops.turnBattleSystem).not.toBeUndefined()

    manager.discardStaleBattle()

    // Cleared set (r35-INT-2 fix).
    expect(ops.turnRuntime).toBeUndefined()
    expect(ops.battleBuffRegistry).toBeUndefined()
    expect(ops.combatScheduler).toBeUndefined()
    // Documented session-lifetime survivors (engine-owned + session rng).
    expect(ops.turnBattleSystem).not.toBeUndefined()
    expect(ops.combatRng).not.toBeUndefined()
    // Observable surface: battle gone, clock stopped, reasons empty,
    // parked steps wiped wholesale (the re-mint race cannot exist).
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(ops.pendingStepDone).toEqual({})
    expect(ops.pendingStepTimers).toEqual([])
    // Guarded readers answer idle, not dead-entity data.
    expect(manager.getBattleBuffs('any-entity-id')).toEqual([])
    expect(manager.turnBattleOps.getStageProgress()).toBeNull()
  })
})

// ----------------------------------------------------------------------------
// (C) awaitStep fallback gate: fire-time drop + administrative park.
// ----------------------------------------------------------------------------

describe('r36 COR - C: awaitStep fallback gate', () => {
  it('C1 administrative latch parks the step: no done, pendingStepDone stays armed, live-handle-only re-arm (fixed)', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    parkInteractiveStep(manager, clock)
    const ops = opsInternals(manager)
    const armedKeys = Object.keys(ops.pendingStepDone).filter(
      (key) => ops.pendingStepDone[key] !== undefined,
    )
    expect(armedKeys.length).toBeGreaterThan(0)
    const timersAtArm = ops.pendingStepTimers.length
    const tokenBefore = manager.getTurnTokenState()

    manager.freezeCombat('authority-pause')
    // Three fallback fires under the latch: the step never completes,
    // the pendingStepDone settle stays armed (an ACK can still land),
    // and each re-arm SWAPS its dead handle for the new one - r36-COR-1
    // fix: the array holds live timers only, flat across the latch's
    // lifetime, still drained wholesale at clearPendingSteps.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(manager.getTurnTokenState()).toBe(tokenBefore)
    expect(
      Object.keys(ops.pendingStepDone).filter((key) => ops.pendingStepDone[key] !== undefined)
        .length,
    ).toBe(armedKeys.length)
    expect(ops.pendingStepTimers.length).toBe(timersAtArm)
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(0)

    // Release: the next fire proceeds through driveStepWork and the turn
    // resolves - the latch parked, it did not kill the step. A full turn
    // is three sequential parked steps (ready -> impact -> complete),
    // each needing its own fallback fire.
    manager.resumeCombat('authority-pause')
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 12)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)
  })

  it('C2 dead-battle drop fires at FIRE time: terminal state wipes the parked settle, no done, no re-arm', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    parkInteractiveStep(manager, clock)
    const ops = opsInternals(manager)
    const armedKeys = Object.keys(ops.pendingStepDone).filter(
      (key) => ops.pendingStepDone[key] !== undefined,
    ) as Array<'ready' | 'impact' | 'complete'>
    expect(armedKeys.length).toBeGreaterThan(0)
    const timersAtArm = ops.pendingStepTimers.length

    // The battle turns terminal while a step is still parked (combat-over
    // stops the clock but does NOT clear pending steps) - the fallback
    // must drop the parked settle instead of driving dead-entity work.
    ops.turnBattle!.state = 'victory'
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS + 100)

    for (const key of armedKeys) {
      expect(ops.pendingStepDone[key]).toBeUndefined()
    }
    // No re-arm: the timer array did not grow from the drop.
    expect(ops.pendingStepTimers.length).toBe(timersAtArm)
  })

  it("C3 dead-battle drop also fires on a 'stopped' clock with a live battle reference", () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    parkInteractiveStep(manager, clock)
    const ops = opsInternals(manager)
    const armedKeys = Object.keys(ops.pendingStepDone).filter(
      (key) => ops.pendingStepDone[key] !== undefined,
    )
    expect(armedKeys.length).toBeGreaterThan(0)

    // Live 'fighting' battle + stopped clock: the third drop condition.
    ops.combatClock.stop()
    expect(ops.combatClock.getState()).toBe('stopped')
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS + 100)
    for (const key of armedKeys) {
      expect(ops.pendingStepDone[key as 'ready' | 'impact' | 'complete']).toBeUndefined()
    }
  })

  it('C4 re-mint race cannot exist: discard wipes every armed timer + every parked settle; the new cycle parks a fresh entry', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    parkInteractiveStep(manager, clock)
    const ops = opsInternals(manager)
    const staleSettles = { ...ops.pendingStepDone }
    const staleKeys = Object.keys(staleSettles).filter((key) => staleSettles[key] !== undefined)
    expect(staleKeys.length).toBeGreaterThan(0)
    expect(ops.pendingStepTimers.length).toBeGreaterThan(0)

    manager.discardStaleBattle()
    // The wholesale wipe is what makes the race impossible: no stale
    // timer survives to fire into the minted cycle, and no stale
    // per-signal key survives to alias a fresh settle.
    expect(ops.pendingStepDone).toEqual({})
    expect(ops.pendingStepTimers).toEqual([])

    startAStage(manager, { stageId: 'fixture_stage_b' })
    expect(manager.getTurnBattle()).not.toBeNull()
    // A fresh park on the new cycle registers a NEW settle closure -
    // identity-distinct from every stale one.
    ops.awaitStep('ready', () => {})
    const newSettle = ops.pendingStepDone['ready']
    expect(newSettle).not.toBeUndefined()
    expect(newSettle).not.toBe(staleSettles['ready'])
  })

  it('C5 a renderer ACK still settles the parked step during an administrative latch', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    parkInteractiveStep(manager, clock)
    const ops = opsInternals(manager)
    const armedKeys = Object.keys(ops.pendingStepDone).filter(
      (key) => ops.pendingStepDone[key] !== undefined,
    ) as Array<'ready' | 'impact' | 'complete'>
    expect(armedKeys.length).toBeGreaterThan(0)

    manager.freezeCombat('authority-pause')
    // The latch gate leaves pendingStepDone armed: an ACK-channel settle
    // completes the step without touching the wall-clock fallback.
    ops.settleStep(armedKeys[0]!)
    expect(ops.pendingStepDone[armedKeys[0]!]).toBeUndefined()
  })
})

// ----------------------------------------------------------------------------
// (D) step-7 latch-preserving restart.
// ----------------------------------------------------------------------------

describe('r36 COR - D: beginBattleCycle latch-preserving restart', () => {
  it("D1 'authority-pause' in the snapshot is re-frozen after stop()+start() - a latched ghost cannot self-unlatch", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager, { repeatContinuously: true })
    manager.resumeCombat('not-revealed')
    const ops = opsInternals(manager)

    manager.freezeCombat('authority-pause')
    const oldBattle = manager.getTurnBattle()!
    oldBattle.state = 'victory'

    ops.restartTurnBattleCycle()

    expect(manager.getTurnBattle()).not.toBe(oldBattle)
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    // And the frozen restart really is frozen: no steps land.
    const steps = manager.getElapsedCombatSteps()
    clock.advance(5)
    expect(manager.getElapsedCombatSteps()).toBe(steps)
    manager.discardStaleBattle()
  })

  it('D2 unlatched restart is behavior-identical to before: empty snapshot -> running', () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager, { repeatContinuously: true })
    manager.resumeCombat('not-revealed')
    const ops = opsInternals(manager)

    const oldBattle = manager.getTurnBattle()!
    oldBattle.state = 'victory'
    ops.restartTurnBattleCycle()

    expect(manager.getTurnBattle()).not.toBe(oldBattle)
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getFreezeReasons()).toEqual([])
    clock.advance(COMBAT_STEP_SECONDS * 10)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    manager.discardStaleBattle()
  })

  it("D3 'not-revealed' is re-derived, not blindly restored: a stale snapshot value is corrected by the live session read", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager, { repeatContinuously: true })
    manager.resumeCombat('not-revealed')
    const ops = opsInternals(manager)

    // Stale 'not-revealed' in the snapshot (the session released without
    // a sync point) must NOT survive the restart: syncOffScreenFreeze
    // re-derives it from isBlocking() and resumes it.
    manager.freezeCombat('not-revealed')
    manager.freezeCombat('authority-pause')
    const blockingSpy = vi
      .spyOn(ops.presentationOps.session, 'isBlocking')
      .mockReturnValue(false)

    const oldBattle = manager.getTurnBattle()!
    oldBattle.state = 'victory'
    ops.restartTurnBattleCycle()

    expect(manager.getFreezeReasons()).not.toContain('not-revealed')
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    blockingSpy.mockRestore()

    // Held-session arm: isBlocking() true -> 'not-revealed' stays.
    vi.spyOn(ops.presentationOps.session, 'isBlocking').mockReturnValue(true)
    const battle2 = manager.getTurnBattle()!
    battle2.state = 'victory'
    manager.resumeCombat('not-revealed')
    manager.freezeCombat('not-revealed')
    ops.restartTurnBattleCycle()
    expect(manager.getFreezeReasons()).toContain('not-revealed')
    manager.discardStaleBattle()
  })

  it("D4 'user-pause' dies with the battle it was taken on - the owner-lifetime scoping fix (r36-COR-3/INT-1)", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager, { repeatContinuously: true })
    manager.resumeCombat('not-revealed')
    const ops = opsInternals(manager)

    // Post-fix: 'user-pause' is excluded from the step-7 carry - its
    // owner flag (CombatTopBar.userPaused) resets on battle identity
    // change without resuming, so a carried latch would strand the new
    // battle frozen behind a button claiming unpaused. The latch dies
    // with the battle it was taken on - identical to the pre-carry
    // semantics the UI already assumed.
    manager.freezeCombat('user-pause')
    const oldBattle = manager.getTurnBattle()!
    oldBattle.state = 'victory'
    ops.restartTurnBattleCycle()

    expect(manager.getTurnBattle()).not.toBe(oldBattle)
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getFreezeReasons()).toEqual([])
    clock.advance(5)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) Adjacent seam: setCombatClockSource still wipes reasons (r36-COR-2).
// ----------------------------------------------------------------------------

describe('r36 COR - E: setCombatClockSource reason preservation (fixed)', () => {
  it("a 'frozen' clock keeps every latch verbatim across a source swap - same battle, same owners", () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.resumeCombat('not-revealed')

    manager.freezeCombat('user-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    // r36-COR-2/INT-4 fix: the swap is a stop()+start() on a NEW instance,
    // so the reasons the SAME battle lives under are snapshotted and
    // re-frozen - 'frozen' stays frozen and 'user-pause' survives with
    // its living owner (CombatTopBar still holds the flag; no battle
    // boundary is crossed).
    manager.setCombatClockSource(new ManualClockSource())

    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toEqual(['user-pause'])
    manager.resumeCombat('user-pause')
    expect(manager.getCombatClockState()).toBe('running')
    manager.discardStaleBattle()
  })
})
