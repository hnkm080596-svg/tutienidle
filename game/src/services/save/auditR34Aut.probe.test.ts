// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { OnlineSessionController } from '../session/OnlineSessionController'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { primeMortalCreationPick } from './GameSave.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type { ProductionCycle } from '../../core/production/ProductionTypes'

// ============================================================================
// QA probe - fixpoint r34 AUT wave. Blind adversarial audit of the r33
// adjudication at db694183. Sections:
//
//   (A) bootGame success tail: the resumeCombat unlatch sits post-markReady,
//       but enterGame is a one-shot fire-and-forget coordinator.request. A
//       'rejected' home transition (in-flight conflict) still yields
//       'entered': authority admitted, heartbeat armed, combat unlatched,
//       tick loop armed - while the mounted surface never becomes 'game'.
//       Probes pin the wedge shape AND its bounds (tick/save stay gated).
//   (B) bootGame tail throw path: try/finally, no catch. A markReady whose
//       onStateChange fan-out throws propagates out of bootGame: boot.fail
//       never runs, yet the real controller is already 'ready' with the
//       heartbeat armed - a zombie half-admission. Combat latch holds
//       (safe direction - the r33 move helps here).
//   (C) fail-arm latch coverage beyond the r33 unavailable-load pin:
//       rejected-restore arm and stale-generation fence inside the success
//       region (mid-firstSave stopAll) both keep 'authority-pause' latched.
//   (D) restoreStates post-drop attacks: equal-stamp pairs drop; a NaN pair
//       parks verbatim and DOES freeze the site + refuse the write, but the
//       identical bytes die at every admission gate (unreachable); sibling
//       restoreJobs drops the same NaN shape - doctrine asymmetry (Nit);
//       drop does not corrupt lane capacity (slots are capacity-derived);
//       duplicate siteId entries are deterministic last-wins.
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

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
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

const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId

function siteStateWith(cycles: ProductionCycle[]) {
  return {
    siteId: SITE_ID,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 1,
    workerCycles: cycles,
  }
}

function workerCycle(cycleId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  return {
    cycleId,
    siteId: SITE_ID,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs,
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

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) enterGame is one-shot: a rejected/aborted 'home' request still yields
// 'entered' - admitted sim on a stranded non-game surface.
// ----------------------------------------------------------------------------

describe('r34 AUT - A: bootGame reports entered even when the home request never lands', () => {
  it("boot.enterGame that does not reach 'game' (rejected request): outcome 'entered', sim admitted, combat unlatched - but tick/save stay stage-gated", async () => {
    const manager = registeredManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    // The wedge: request('home') returned 'rejected' (in-flight conflict) -
    // enterGame is fire-and-forget so nothing observes the refusal. The
    // stage stays 'auth'.
    stubs.boot.enterGame = vi.fn(() => {
      /* request rejected - surface never changes */
    })

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    // bootGame claims success although no game surface will ever mount on
    // its own. Admission + unlatch already ran.
    expect(outcome.status).toBe('entered')
    expect(stubs.authority.markReady).toHaveBeenCalledTimes(1)
    expect(manager.getFreezeReasons()).not.toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(stubs.entryStage.value).toBe('auth')

    // Bounds of the wedge: the armed tick interval is stage-gated (no sim
    // advance), and persistProgress refuses while the stage is not 'game'.
    expect(stubs.intervals).toHaveLength(1)
    stubs.intervals[0]!()
    expect(stubs.tick).not.toHaveBeenCalled()
    await lifecycle.persistProgress()
    expect(stubs.persistPlayer).not.toHaveBeenCalled()

    // The stranded surface self-heals: the user driving another boot gets
    // a fresh enterGame attempt (bootInFlight reset by the finally).
    stubs.boot.enterGame = vi.fn(() => {
      stubs.entryStage.value = 'game'
    })
    const retry = await lifecycle.bootGame({ createNewCharacter: false })
    expect(retry.status).toBe('entered')
    expect(stubs.entryStage.value).toBe('game')

    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (B) Tail throw propagation: no catch around markReady..enterGame.
// ----------------------------------------------------------------------------

describe('r34 AUT - B: a throw inside the success tail propagates uncaught (no fail arm)', () => {
  it('markReady throwing rejects bootGame: boot.fail never runs, the combat latch holds (safe direction)', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    stubs.authority.markReady = vi.fn(() => {
      throw new Error('listener boom')
    })

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)

    await expect(lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow('listener boom')

    // No fail surface mounted - the caller sees a rejection it does not
    // handle (void bootGame / event handler). The combat latch survived:
    // moving resumeCombat post-markReady makes this arm fail-safe.
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(stubs.clock.start).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)

    lifecycle.stopAll()
  })

  it("real OnlineSessionController: a throwing onStateChange leaves 'ready' + armed heartbeat behind the rejected boot", () => {
    const intervals: Array<() => void> = []
    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' as const }),
      monotonicNow: () => 0,
      scheduleInterval: (cb) => (intervals.push(cb), intervals.length),
      clearHandle: vi.fn(),
      onStateChange: (state) => {
        if (state === 'ready') {
          throw new Error('listener boom')
        }
      },
    })

    controller.beginChecking()
    expect(() => controller.markReady()).toThrow('listener boom')

    // The state assignment and the timers ran BEFORE the throwing fan-out:
    // the mutation gate is OPEN on a boot whose promise rejected.
    expect(controller.authorityState).toBe('ready')
    expect(controller.canMutate()).toBe(true)
    expect(intervals).toHaveLength(1)
  })
})

// ----------------------------------------------------------------------------
// (C) Latch coverage on fail arms the r33 probe did not pin.
// ----------------------------------------------------------------------------

describe('r34 AUT - C: authority-pause latch across the remaining fail/skip arms', () => {
  it('rejected-restore arm: restore rejection fails the boot with the latch still held', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'auth'
    stubs.coordinator.load = vi.fn(async () => ({
      status: 'ok' as const,
      save: loadableSave(),
      revision: 1,
    }))
    stubs.restoreGameSession = vi.fn(() => ({ status: 'rejected' as const, message: 'registry boom' }))
    stubs.boot.fail = vi.fn(() => {
      stubs.entryStage.value = 'error'
    })

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.authority.markReady).not.toHaveBeenCalled()
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    lifecycle.stopAll()
  })

  it('stale-generation fence inside the success region: stopAll mid-firstSave skips without unlatching', async () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.freezeCombat('authority-pause')

    const stubs = lifecycleStubs()
    stubs.entryStage.value = 'character'
    // The firstSave arm inside bootGame calls deps.player.save (NOT
    // persistPlayer - persistProgress's stage gate would eat the write).
    let resolveSave: ((value: { status: 'ok'; revision: number }) => void) | undefined
    stubs.player.save = vi.fn(
      () => new Promise<{ status: 'ok'; revision: number }>((resolve) => {
        resolveSave = resolve
      }),
    )

    const lifecycle = useAppLifecycle({ ...stubs, gameManager: manager } as never)
    const pending = lifecycle.bootGame({ createNewCharacter: true, onNewCharacter: vi.fn() })

    // The boot is parked on the firstSave await - teardown lands now.
    await vi.waitFor(() => {
      expect(stubs.player.save).toHaveBeenCalledTimes(1)
    })
    lifecycle.stopAll()
    resolveSave!({ status: 'ok', revision: 1 })
    const outcome = await pending

    expect(outcome.status).toBe('skipped')
    expect(stubs.authority.markReady).not.toHaveBeenCalled()
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// (D) restoreStates post-drop attacks + the restoreJobs asymmetry evidence.
// ----------------------------------------------------------------------------

describe('r34 AUT - D: restoreStates drop/park arms under crafted pairs', () => {
  it('an equal-stamp pair (started == completes) is dropped with the inverted class', () => {
    const manager = registeredManager()
    const equal = workerCycle('equal', currentMs - 10_000, currentMs - 10_000)

    manager.productionSystem.restoreStates([siteStateWith([equal])], currentMs)

    expect(manager.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(0)
  })

  it('a NaN pair parks verbatim, freezes the whole site via pending.some, and refuses the next write - but is unreachable through the admission gate', () => {
    const manager = registeredManager()
    const nanPair = workerCycle('nan', Number.NaN, Number.NaN)
    const due = workerCycle('due', currentMs - 120_000, currentMs - 10_000)

    manager.productionSystem.restoreStates([siteStateWith([nanPair, due])], currentMs)

    // Both cycles parked: NaN fails the inverted check (NaN <= x is false)
    // and the shift check (NaN > x is false), so it lands verbatim; the
    // deny-guard then freezes the whole site - the honest DUE lane never
    // advances.
    const bag = new MaterialBag()
    const registry = new MaterialRegistry()
    materials.forEach((m) => registry.register(m))
    manager.productionSystem.tickWorkers(currentMs + 10_000_000, bag, registry, 'mortal', 1)

    const parked = manager.productionSystem.getState(SITE_ID)!.workerCycles!
    expect(parked.map((c) => c.cycleId).sort()).toEqual(['due', 'nan'])

    // The poison persists onto the wire and trips the write gate: NaN
    // serializes to null, which fails isNonNegativeBoundedTimestamp.
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)
    const wire = JSON.parse(JSON.stringify(buildGameSave(player, manager)))
    const outgoing = validateGameSaveShape(wire)
    expect(outgoing.ok).toBe(false)

    // Reachability bound: a save carrying that wire shape dies at the
    // admission gate itself - the load/import/remote seams all run this
    // validation before restoreGameSession is ever called. The parked
    // verbatim arm is therefore defense-in-depth only (a caller bypassing
    // every gate owns the process anyway): reported as a Nit asymmetry
    // against restoreJobs' drop, not a reachable wedge.
    const craftedSave = {
      ...wire,
      productionSites: [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          assignedWorkers: 1,
          workerCycles: [
            {
              cycleId: 'nan',
              siteId: SITE_ID,
              collectionRealmId: 'mortal',
              siteLevelAtStart: 1,
              rewardTableVersion: 1,
              rollSeed: 1,
              startedAtMs: null,
              completesAtMs: null,
            },
          ],
        },
      ],
    }
    expect(validateGameSaveShape(craftedSave).ok).toBe(false)
  })

  it('sibling asymmetry: restoreJobs DROPS the NaN pair (self-heals) where restoreStates parks it', () => {
    const reader = registeredManager()
    const recipe = mortalRecipe()
    const nanJob = alchemyJobFixture(
      {
        jobId: 'r34_nan',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: Number.NaN,
        completesAtMs: Number.NaN,
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )

    reader.alchemySystem.restoreJobs([nanJob], currentMs)

    expect(reader.alchemySystem.getJobs()).toHaveLength(0)
  })

  it('dropping cycles does not corrupt lane accounting: capacity-derived slots re-seed on the next tick', () => {
    const manager = registeredManager()
    const inverted = workerCycle('bad', currentMs - 30_000, currentMs - 60_000)

    manager.productionSystem.restoreStates([siteStateWith([inverted])], currentMs)
    expect(manager.productionSystem.getState(SITE_ID)!.workerCycles!).toHaveLength(0)

    const bag = new MaterialBag()
    const registry = new MaterialRegistry()
    materials.forEach((m) => registry.register(m))
    manager.productionSystem.tickWorkers(currentMs, bag, registry, 'mortal', 1)

    // activeWorkerSlots is reallocated from capacity (not lane count); the
    // freed lane re-seeds a fresh in-domain pair - no extra capacity, no
    // permanent hole.
    const seeded = manager.productionSystem.getState(SITE_ID)!
    expect(seeded.activeWorkerSlots).toBe(1)
    expect(seeded.workerCycles).toHaveLength(1)
    const minted = seeded.workerCycles![0]!
    expect(Number.isFinite(minted.startedAtMs)).toBe(true)
    expect(minted.completesAtMs).toBeGreaterThan(minted.startedAtMs)
    expect(minted.completesAtMs).toBeLessThan(2 ** 52)
  })

  it('duplicate siteId entries are deterministic last-wins (no accumulation)', () => {
    const manager = registeredManager()
    const first = { ...siteStateWith([]), level: 2 }
    const second = { ...siteStateWith([]), level: 3 }

    manager.productionSystem.restoreStates([first, second], currentMs)

    const state = manager.productionSystem.getState(SITE_ID)!
    expect(state.level).toBe(3)
    expect(manager.productionSystem.getAllStates()).toHaveLength(1)
  })
})
