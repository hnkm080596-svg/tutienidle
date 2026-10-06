// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// BETA SCOPE LOCK v2 - same seam as the r20-r33 probes: exercise the
// enabled implementation paths, not the dormant scope-hidden shells.
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import type { ProductionCycle, ProductionSiteState } from '../../core/production/ProductionTypes'
import {
  computeCycleSeconds,
  CYCLE_BASE_SECONDS_BY_REALM,
} from '../../core/production/ProductionBalance'
import { ManualClockSource } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import { createBaseStats } from '../../core/stats/StatBlock'
import { CENTER_LANE_INDEX } from '../../core/battle/BattleLane'
import type { CombatEntity } from '../../core/combat/CombatEntity'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { THANH_VAN_PRODUCTION_SITES, TERRITORY_THANH_VAN } from '../../core/production/ProductionCatalog'
import { ProductionSystem } from '../../core/production/ProductionSystem'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r34 INT wave. Audits the r33 adjudication batch at
// db694183 for INTEGRATION COHERENCE - whether the r33-corrected pieces
// still agree with each other and every real consumer:
//
//   (R) r33-INT-1 - resumeCombat('authority-pause') moved to the boot
//       success tail (:731-736, after authority.markReady() :729, before
//       clock.start()/startTickLoop/enterGame). Consumers in the window:
//       - the CombatClock itself - a resumed clock steps only inside
//         onFrame callbacks; the markReady->enterGame tail contains no
//         await, so no RAF/MainProcess frame can land inside it.
//       - persistProgress/autosave - gated on entryStage==='game'
//         (:318), still false inside the window even with canMutate()
//         true (the boot code itself relies on this conjunct at :655).
//       - every fail arm above the tail - 'authority-pause' must stay
//         latched on the clock behind the terminal surface.
//   (D) r33-COR-F1/AUT-2 - restoreStates .map -> .flatMap drops
//       completesAtMs <= startedAtMs. Consumers read workerCycles.length
//       / activeWorkerSlots independently; nothing indexes cycles
//       positionally against assignedWorkers; flatMap preserves survivor
//       order; hiddenChannelCycles clone unchanged. Out-of-domain stamps
//       still park verbatim (pending.some deny + write-refuse residual).
//   (P) flipped r32/r33 pin coherence - auditR32Aut now asserts the
//       restore-time drop AND the mechanism-level ordering deny for a
//       direct (restore-bypassing) feed; both directions must hold at
//       once.
// ============================================================================

let currentMs = 1_725_160_000_000
const REALM = 'mortal'
const BOUND = 2 ** 52
const FOREST_SITE_ID = TERRITORY_THANH_VAN.productionSiteIds.forest

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function validWireSave(): GameSave {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

// Minimal live battle - raw-entity test policy, same shape as
// GameManager.laneAssignment.test.ts (no catalogs needed).
function barePlayer(): CombatEntity {
  const stats = createBaseStats({ might: 0 })

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
    row: CENTER_LANE_INDEX,
    alive: true,
  }
}

function dummyEnemy() {
  return defineEnemy({
    id: 'r34_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 100_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

function cycleAt(overrides: Partial<ProductionCycle>): ProductionCycle {
  return {
    cycleId: 'cycle_probe',
    siteId: FOREST_SITE_ID,
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 7,
    startedAtMs: currentMs - 50_000,
    completesAtMs: currentMs - 40_000,
    ...overrides,
  }
}

function productionSystem(): ProductionSystem {
  return new ProductionSystem({
    territory: TERRITORY_THANH_VAN,
    sites: THANH_VAN_PRODUCTION_SITES,
    forestRewards: [],
    mineRewards: [],
    grottoHerbs: [],
  })
}

// ----------------------------------------------------------------------------
// (R) The lifecycle harness mirrors App.vue wiring - extended from the
// r33 version with a deferred-load gate, a throwing load, and the extra
// fail-arm statuses this wave exercises.
// ----------------------------------------------------------------------------

function lifecycleHarness(sharedGameManager?: GameManager) {
  const entryStage = ref('auth')
  let nextHandle = 1
  const liveIntervals = new Set<number>()
  const wire = validWireSave()
  const gameManager = sharedGameManager ?? registeredManager()
  const manualSource = new ManualClockSource()
  // The latch lives on the CombatClock - a second lifecycle instance
  // must NOT swap the source (setCombatClockSource stops the clock and
  // clears every reason, the R33-INT-2 exception), so only the first
  // harness binds one.
  if (!sharedGameManager) {
    gameManager.setCombatClockSource(manualSource)
  }
  const playerState = createDefaultPlayer()
  const clockStateDuringLoad: string[] = []
  const loadControl = {
    status: 'ok' as 'ok' | 'unavailable' | 'corrupted' | 'empty' | 'deleted',
    duringLoad: undefined as undefined | (() => void),
    deferred: undefined as undefined | { promise: Promise<void> },
    throwError: undefined as undefined | Error,
  }
  const boot = {
    startInitializing: vi.fn(),
    startSaveLoad: vi.fn(),
    requireCharacter: vi.fn(() => {
      entryStage.value = 'character'
    }),
    enterGame: vi.fn(() => {
      entryStage.value = 'game'
    }),
    showAuth: vi.fn(() => {
      entryStage.value = 'auth'
    }),
    fail: vi.fn(() => {
      entryStage.value = 'error'
    }),
  }
  const deps = {
    clock: { start: vi.fn(), stop: vi.fn(), update: vi.fn() },
    scheduleInterval: (_fn: () => void, _ms: number) => {
      const handle = nextHandle
      nextHandle += 1
      liveIntervals.add(handle)
      return handle
    },
    clearHandle: (handle: number) => {
      liveIntervals.delete(handle)
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot,
    coordinator: {
      capability: 'local',
      load: vi.fn(async () => {
        clockStateDuringLoad.push(gameManager.getCombatClockState())
        loadControl.duringLoad?.()
        // Deterministic park: the boot stays in-flight until the test
        // resolves this promise - no timing to fuzz.
        if (loadControl.deferred) await loadControl.deferred.promise
        if (loadControl.throwError) throw loadControl.throwError
        if (loadControl.status === 'unavailable') {
          return {
            status: 'unavailable' as const,
            code: 'SERVER_ERROR' as const,
            message: 'load failed',
            retryable: true,
          }
        }
        if (loadControl.status === 'corrupted') {
          return { status: 'corrupted' as const, raw: '{}', message: 'corrupt' }
        }
        if (loadControl.status === 'empty') {
          return { status: 'empty' as const, revision: 0 }
        }
        if (loadControl.status === 'deleted') {
          return { status: 'deleted' as const }
        }
        return { status: 'ok' as const, save: wire, raw: '{}', revision: 1 }
      }),
      save: vi.fn(),
      reset: vi.fn(async () => undefined),
    },
    authority: {
      canMutate: () => true,
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
    },
    player: {
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      $state: playerState,
    },
    gameManager,
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn(), clear: vi.fn() },
    entryStage,
    restoreGameSession: vi.fn(() => ({ status: 'ok' })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' })),
    onError: vi.fn(),
    hardReset: vi.fn(),
  }
  const lifecycle = useAppLifecycle(deps as never)
  return {
    lifecycle,
    entryStage,
    liveIntervals,
    gameManager,
    deps,
    boot,
    playerState,
    manualSource,
    clockStateDuringLoad,
    loadControl,
  }
}

// Latch a live battle under 'authority-pause' the way the terminal
// authority pause does: entered -> battle running -> pauseSimulation.
async function latchedHarness(sharedGameManager?: GameManager) {
  const h = lifecycleHarness(sharedGameManager)
  expect((await h.lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
  h.gameManager.startBattle(barePlayer(), dummyEnemy())
  expect(h.gameManager.getCombatClockState()).toBe('running')
  h.lifecycle.pauseSimulation()
  expect(h.gameManager.getCombatClockState()).toBe('frozen')
  expect(h.gameManager.getFreezeReasons()).toEqual(['authority-pause'])
  return h
}

describe('auditR34 INT probe - post-admission unlatch ordering (R)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R1 persistProgress refuses INSIDE the markReady->enterGame window - the entryStage conjunct is load-bearing', async () => {
    const { lifecycle, deps } = lifecycleHarness()

    // markReady runs inside the synchronous success tail: at that point
    // canMutate() is already true but entryStage is still the interim
    // surface ('auth' in this harness, 'initializing' in the app).
    // Invoking persistProgress from inside the callback lands in the
    // exact window the audit asks about.
    vi.mocked(deps.authority.markReady).mockImplementation(() => {
      void lifecycle.persistProgress()
    })

    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')

    // The in-window call evaluated the gate with entryStage !== 'game'
    // - the write refused even though admission was already proven.
    expect(deps.persistPlayer).not.toHaveBeenCalled()

    // Post-enterGame the same call admits (control).
    await lifecycle.persistProgress()
    expect(deps.persistPlayer).toHaveBeenCalledTimes(1)
  })

  it('R2 a concurrent bootGame resolves skipped and leaves the latch untouched', async () => {
    const { lifecycle, gameManager, loadControl } = await latchedHarness()

    // Park the retry's load so the first boot stays in-flight while the
    // second is issued - 'skipped' is answered before the first await,
    // deterministically.
    let openLoad!: () => void
    loadControl.deferred = {
      promise: new Promise<void>((resolve) => {
        openLoad = resolve
      }),
    }

    const first = lifecycle.bootGame({ createNewCharacter: false })
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('skipped')

    // The skipped boot ran no side effects - the reason is still latched.
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toEqual(['authority-pause'])

    openLoad()
    expect((await first).status).toBe('entered')
    // r34-COR-F1: the success path DISCARDS the stale battle - the
    // combat clock stops outright instead of resuming the previous
    // owner's battle.
    expect(gameManager.getCombatClockState()).toBe('stopped')
    expect(gameManager.getFreezeReasons()).toEqual([])
    expect(gameManager.getTurnBattle()).toBeNull()
  })

  it('R3 the require-character arm keeps the latch; the createNewCharacter boot clears it', async () => {
    const { lifecycle, gameManager, boot, loadControl } = await latchedHarness()

    loadControl.status = 'empty'
    boot.showAuth()
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe(
      'require-character',
    )
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toEqual(['authority-pause'])

    // Re-entry through character creation walks the same success tail.
    expect(
      (
        await lifecycle.bootGame({
          createNewCharacter: true,
          onNewCharacter: vi.fn(async () => undefined),
        })
      ).status,
    ).toBe('entered')
    // r34-COR-F1: admission discards the stale battle - the create boot
    // enters battleless (stopped clock, no ghost resolution).
    expect(gameManager.getCombatClockState()).toBe('stopped')
    expect(gameManager.getTurnBattle()).toBeNull()
  })

  it('R4 the corrupted and restore-rejected arms keep the latch (fail-arm class beyond unavailable)', async () => {
    // Arm 1: corrupted load -> markFailed('recovery') + saveIssue + fail.
    {
      const { lifecycle, gameManager, boot, loadControl } = await latchedHarness()
      loadControl.status = 'corrupted'
      boot.showAuth()
      expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
      expect(boot.fail).toHaveBeenCalled()
      expect(gameManager.getCombatClockState()).toBe('frozen')
      expect(gameManager.getFreezeReasons()).toEqual(['authority-pause'])
    }

    // Arm 2: restore preflight rejection -> same recovery surface.
    {
      const { lifecycle, gameManager, boot, deps } = await latchedHarness()
      vi.mocked(deps.restoreGameSession).mockImplementation(() => ({
        status: 'rejected',
        message: 'preflight refuse',
      }))
      boot.showAuth()
      expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('failed')
      expect(boot.fail).toHaveBeenCalled()
      expect(gameManager.getCombatClockState()).toBe('frozen')
      expect(gameManager.getFreezeReasons()).toEqual(['authority-pause'])
    }
  })

  it('R5 the latch lives on the CombatClock - a fresh lifecycle instance clears it on its own success tail', async () => {
    const first = await latchedHarness()

    // A second composable instance over the SAME gameManager - the
    // freeze reason is clock state, not composable state (the mount
    // swap a real terminal -> reload cycle performs).
    const second = lifecycleHarness(first.gameManager)
    expect(second.gameManager).toBe(first.gameManager)
    expect(first.gameManager.getCombatClockState()).toBe('frozen')

    expect((await second.lifecycle.bootGame({ createNewCharacter: false })).status).toBe(
      'entered',
    )
    // r34-COR-F1: the second lifecycle's success tail discards the stale
    // battle - the clock stops and nothing steps.
    expect(first.gameManager.getCombatClockState()).toBe('stopped')
    expect(first.gameManager.getFreezeReasons()).toEqual([])
    expect(first.gameManager.getTurnBattle()).toBeNull()

    const stepsBefore = first.gameManager.getElapsedCombatSteps()
    first.manualSource.advance(1)
    expect(first.gameManager.getElapsedCombatSteps()).toBe(stepsBefore)
  })

  it('R6 a throwing coordinator.load rejects bootGame with the latch held - and the retry still clears it', async () => {
    const { lifecycle, gameManager, boot, loadControl } = await latchedHarness()

    boot.showAuth()
    loadControl.throwError = new Error('network down')
    await expect(lifecycle.bootGame({ createNewCharacter: false })).rejects.toThrow(
      'network down',
    )

    // Uncaught-path deny direction matches every gated arm: frozen,
    // never running (pre-existing wedge - the app sits on the loading
    // surface with combat latched, not free-running).
    expect(gameManager.getCombatClockState()).toBe('frozen')
    expect(gameManager.getFreezeReasons()).toEqual(['authority-pause'])

    // finally resets bootInFlight - the retry reaches the success tail.
    loadControl.throwError = undefined
    expect((await lifecycle.bootGame({ createNewCharacter: false })).status).toBe('entered')
    // r34-COR-F1: the retry's admission discards the stale battle.
    expect(gameManager.getCombatClockState()).toBe('stopped')
    expect(gameManager.getTurnBattle()).toBeNull()
  })

  it('R7 source pin - the success tail is synchronous: no await between markReady and enterGame', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../composables/useAppLifecycle.ts', import.meta.url)),
      'utf-8',
    )
    const bootStart = source.indexOf('async function bootGame')
    const readyAt = source.lastIndexOf(
      'authority.markReady()',
      source.indexOf('boot.enterGame()', bootStart),
    )
    const resumeAt = source.indexOf("resumeCombat('authority-pause')", readyAt)
    const clockStartAt = source.indexOf('clock.start()', resumeAt)
    const enterAt = source.indexOf('boot.enterGame()', clockStartAt)

    expect(readyAt).toBeGreaterThan(-1)
    expect(resumeAt).toBeGreaterThan(readyAt)
    expect(clockStartAt).toBeGreaterThan(resumeAt)
    expect(enterAt).toBeGreaterThan(clockStartAt)

    // The whole tail is synchronous - no RAF/MainProcess frame can land
    // between the unlatch and enterGame, so a resumed CombatClock cannot
    // step before the tick loop exists.
    expect(source.slice(readyAt, enterAt).includes('await')).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// (D) flatMap drop coherence: survivors keep input order at the restore
// boundary; the mechanism re-sorts by due on advance (its own contract);
// a dropped lane's slot refills through the real tickWorkers path;
// sibling fields pass through untouched; the boundary map around the
// drop condition is exact.
// ----------------------------------------------------------------------------

describe('auditR34 INT probe - flatMap drop parity consumers (D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1 a sandwiched inverted pair drops while survivor order is preserved', () => {
    const system = productionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 3,
          assignedWorkers: 3,
          workerCycles: [
            cycleAt({ cycleId: 'cyc_a' }),
            cycleAt({
              cycleId: 'cyc_inv',
              startedAtMs: currentMs,
              completesAtMs: currentMs - 1,
            }),
            cycleAt({ cycleId: 'cyc_b', completesAtMs: currentMs - 30_000 }),
          ],
        },
      ],
      currentMs,
    )

    const cycles = system.getState(FOREST_SITE_ID)!.workerCycles!
    expect(cycles.map((cycle) => cycle.cycleId)).toEqual(['cyc_a', 'cyc_b'])
  })

  it('D2 a NaN pair does NOT drop - the comparison is false, it parks verbatim and the deny chain still holds', () => {
    const gameManager = registeredManager()
    const nanPair = cycleAt({ cycleId: 'cyc_nan', startedAtMs: Number.NaN })
    gameManager.productionSystem.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          assignedWorkers: 1,
          workerCycles: [nanPair],
        },
      ],
      currentMs,
    )

    // completesAtMs <= NaN is false -> falls past the drop arm, past the
    // shift arm (NaN > restoreNowMs false), parked verbatim.
    const parked = gameManager.productionSystem.getState(FOREST_SITE_ID)!.workerCycles!
    expect(parked).toHaveLength(1)
    expect(Number.isNaN(parked[0]!.startedAtMs)).toBe(true)

    // Parked pair -> pending.some deny -> zero-advance, verbatim kept.
    const advanced = advanceWorkerLanes({
      siteId: FOREST_SITE_ID,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: computeCycleSeconds(100, 1) * 1000,
      pending: parked,
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: currentMs,
      advanceMode: 'observe',
    })
    expect(advanced.completed).toHaveLength(0)
    expect(advanced.pending).toHaveLength(1)
    expect(Number.isNaN(advanced.pending[0]!.startedAtMs)).toBe(true)

    // JSON.stringify writes NaN as null -> the next save write refuses
    // on the startedAtMs type pin (documented deny residual,
    // unreachable for honest saves: buildProductionCycle only mints
    // finite stamps). autoWorkerCapacity=3 keeps the lane ceiling out
    // of the assertion so the TYPE pin is what must fire.
    const player = createDefaultPlayer()
    player.autoWorkerCapacity = 3
    const save = buildGameSave(player, gameManager)
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some(
        (issue) =>
          issue.path.includes('workerCycles[0]') &&
          issue.message.includes('sai shape'),
      ),
    ).toBe(true)
  })

  it('D3 the drop touches only workerCycles entries - hiddenChannelCycles and worker counters pass through verbatim', () => {
    const system = productionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 2,
          autoRestart: true,
          activeWorkerSlots: 2,
          assignedWorkers: 2,
          workerCycles: [
            cycleAt({
              cycleId: 'cyc_inv',
              startedAtMs: currentMs,
              completesAtMs: currentMs - 1,
            }),
          ],
          hiddenChannelCycles: { chan_x: 3 },
        },
      ],
      currentMs,
    )

    const state = system.getState(FOREST_SITE_ID)!
    expect(state.workerCycles).toHaveLength(0)
    expect(state.hiddenChannelCycles).toEqual({ chan_x: 3 })
    expect(state.assignedWorkers).toBe(2)
    // Restore-verbatim: tickWorkers reallocates this on the next tick.
    expect(state.activeWorkerSlots).toBe(2)
  })

  it('D4 boundary map: {Inf,Inf} drops (Inf<=Inf is true); {-Inf, t} parks verbatim (ordered but out-of-domain)', () => {
    const system = productionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: false,
          activeWorkerSlots: 0,
          workerCycles: [
            cycleAt({
              cycleId: 'cyc_inf',
              startedAtMs: Infinity,
              completesAtMs: Infinity,
            }),
            cycleAt({
              cycleId: 'cyc_neginf',
              startedAtMs: -Infinity,
              completesAtMs: currentMs + 1_000,
            }),
          ],
        },
      ],
      currentMs,
    )

    const cycles = system.getState(FOREST_SITE_ID)!.workerCycles!
    expect(cycles.map((cycle) => cycle.cycleId)).toEqual(['cyc_neginf'])
    expect(cycles[0]!.startedAtMs).toBe(-Infinity)
  })

  it('D5 the freed slot refills through the real tickWorkers path (dropped lane + autoRestart)', () => {
    const system = productionSystem()
    system.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          assignedWorkers: 1,
          workerCycles: [
            cycleAt({
              cycleId: 'cyc_inv',
              startedAtMs: currentMs,
              completesAtMs: currentMs - 1,
            }),
          ],
        },
      ],
      currentMs,
    )
    expect(system.getState(FOREST_SITE_ID)!.workerCycles).toHaveLength(0)

    const authoredSpanMs = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000
    system.tickWorkers(
      currentMs,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      1,
      new Map([[FOREST_SITE_ID, 1]]),
      () => 0.5,
    )

    const state = system.getState(FOREST_SITE_ID)!
    expect(state.workerCycles).toHaveLength(1)
    const seeded = state.workerCycles![0]!
    expect(seeded.startedAtMs).toBe(currentMs)
    expect(seeded.completesAtMs).toBe(currentMs + authoredSpanMs)
    // The seeded lane itself is ordering-clean - the write it will sit
    // in passes the persisted pins.
    expect(seeded.completesAtMs).toBeGreaterThan(seeded.startedAtMs)
  })

  it('D6 a shifted survivor stays validator-admissible on the next write', () => {
    const gameManager = registeredManager()
    const authoredSpanMs = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000

    // Post-dated pair with the AUTHORED span - the restore re-anchors it
    // at the restore clock by a uniform delta.
    gameManager.productionSystem.restoreStates(
      [
        {
          siteId: FOREST_SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          assignedWorkers: 1,
          workerCycles: [
            cycleAt({
              cycleId: 'cyc_shift',
              startedAtMs: currentMs + 60_000,
              completesAtMs: currentMs + 60_000 + authoredSpanMs,
            }),
          ],
        },
      ],
      currentMs,
    )

    const cycle = gameManager.productionSystem.getState(FOREST_SITE_ID)!.workerCycles![0]!
    expect(cycle.startedAtMs).toBe(currentMs)
    expect(cycle.completesAtMs).toBe(currentMs + authoredSpanMs)

    // autoWorkerCapacity=3 - the authored lane ceiling admits the lane.
    const player = createDefaultPlayer()
    player.autoWorkerCapacity = 3
    const save = buildGameSave(player, gameManager)
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(
      shape.issues.some((issue) => issue.path.includes('workerCycles')),
    ).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// (P) flipped-pin coherence: the restore boundary self-heals, but a feed
// that BYPASSES restoreStates must still hit the mechanism-level ordering
// deny - settleProductionOffline over a directly-crafted states map is
// that feed (the r32Aut pin asserts it for advanceWorkerLanes alone).
// ----------------------------------------------------------------------------

describe('auditR34 INT probe - mechanism deny vs bypass feeds (P)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('P1 a restore-bypassing feed still ordering-denies: settleProductionOffline over a crafted states map', () => {
    const gameManager = registeredManager()
    const inverted = cycleAt({
      cycleId: 'cyc_inv_direct',
      startedAtMs: currentMs - 1_000,
      completesAtMs: currentMs - 2_000,
    })
    const state: ProductionSiteState = {
      siteId: FOREST_SITE_ID,
      level: 1,
      autoRestart: true,
      activeWorkerSlots: 1,
      assignedWorkers: 1,
      workerCycles: [inverted],
    }
    const states = new Map([[state.siteId, state]])
    const deps = {
      states,
      getSiteDefinition: (siteId: string) =>
        gameManager.productionSystem.getSiteDefinition(siteId),
      grantCycleRewards: vi.fn(),
    }

    settleProductionOffline(deps, new MaterialBag(), new MaterialRegistry(), REALM, currentMs, {
      workerCapacity: 1,
      offlineSinceMs: currentMs - 5_000,
      workerAssignments: new Map([[FOREST_SITE_ID, 1]]),
      rng: () => 0.5,
    })

    // The inverted pair reached advanceWorkerLanes un-dropped (no
    // restoreStates on this feed): pending.some deny -> no completions,
    // no grants, pending preserved verbatim (deny doctrine).
    expect(deps.grantCycleRewards).not.toHaveBeenCalled()
    expect(state.workerCycles).toEqual([inverted])
  })
})
