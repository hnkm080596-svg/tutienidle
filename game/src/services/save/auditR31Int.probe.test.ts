// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// BETA SCOPE LOCK v2 - same seam as the r20-r30 probes: exercise the
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
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { materials } from '../../data/materials/materials'
import { TribulationDirector } from '../../core/tribulation/TribulationDirector'
import { EventBus } from '../../core/events/EventBus'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { makeInstance as makeEquipmentInstance } from '../../core/equipment/EquipmentInstance.fixture'
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'

// ============================================================================
// QA probe - fixpoint r31 INT wave. Audits the r30 adjudication batch at
// e90f46a2 for INTEGRATION COHERENCE - whether the r30-corrected layers
// still agree with every real consumer and seam:
//
//   (S) simPaused flag lifecycle vs the new refuse-arm freeze: the r30
//       fix routes the coded-refuse arm through lifecycle.pauseSimulation(),
//       whose early return is guarded on `simPaused`. The flag is latched
//       by authority pauses and cleared ONLY by resumeSimulation() - the
//       acknowledgeAuthority -> re-auth -> bootGame re-entry path never
//       touches it, so a flag latched by a previous terminal pause survives
//       into a fresh 'game' stage and silently disarms every later
//       pauseSimulation (heartbeat pause, update admission, refuse arm).
//   (W) window-input asymmetry: r30-AUT-1 tightened
//       DecomposeSystem.settleOffline to offlineSinceMs in [0, 2^52), but
//       the sibling production window input advanceWorkerLanes
//       .emptyLaneStartMs still admits the full |x| < 2^52 domain - a
//       crafted-negative window start (reachable: validator admits
//       lastSavedAt = -1e12) zero-settles decompose while minting the
//       deep-past backlog through worker lanes. No new ceiling vs the
//       admitted 0-seed class (probed), so Low not Medium.
//   (H) headroom guard boundary: the new
//       !(nowMs + max(0, cycleMs) < 2^52) deny exists so minted dues fit
//       the persisted stamp domain - pin the exact boundary.
//   (T) flag-typing parity: locked/favorite optional-boolean gate vs the
//       EquipmentBag consumer pool (dissolve filter, setProtected union,
//       protectedCount) - boolean-or-undefined now guaranteed at restore.
//   (V) verbatim parity spot-pin: TribulationDirector.restoreRuntime
//       verbatim arm under a negative restore clock parks a crafted
//       cooldown (deny) where the OLD |x|<2^53 domain would have clamped
//       it deep-past (free retry). Tighten direction is deny-lean.
// ============================================================================

let currentMs = 1_725_160_000_000
const REALM = 'mortal'

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

function startedDecomposeSystem(): { system: DecomposeSystem; bag: MaterialBag } {
  const bag = new MaterialBag()
  const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
  system.updateCapacity(1)
  system.restore(
    {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: 0,
      started: true,
    },
    currentMs,
  )
  const ore = materials.find((material) => material.id.includes('_ore_'))!
  bag.add(ore, 100_000)
  return { system, bag }
}

// ----------------------------------------------------------------------------
// (S) simPaused flag lifecycle - the refuse-arm freeze is only as strong as
// the flag it inherits. Repro of the terminal -> acknowledge -> re-auth ->
// re-enter chain at lifecycle level: a second bootGame keeps simPaused
// latched, and the next pauseSimulation is a silent no-op (freezeCombat
// never fires) while the tick loop happily re-arms.
// ----------------------------------------------------------------------------

function lifecycleHarness() {
  const entryStage = ref('auth')
  let nextHandle = 1
  const liveIntervals = new Set<number>()
  const wire = validWireSave()
  const gameManager = registeredManager()
  const playerState = createDefaultPlayer()
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
      load: vi.fn(async () => ({ status: 'ok' as const, save: wire, raw: '{}', revision: 1 })),
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
  return { lifecycle, entryStage, liveIntervals, gameManager, deps, boot }
}

describe('auditR31 INT probe - simPaused flag lifecycle vs the r30 refuse-arm freeze (S)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('S1 a latched simPaused survives acknowledge -> re-boot and disarms the next pauseSimulation - freezeCombat never fires', async () => {
    const { lifecycle, gameManager, liveIntervals, boot } = lifecycleHarness()
    const freezeSpy = vi.spyOn(gameManager, 'freezeCombat')
    const resumeSpy = vi.spyOn(gameManager, 'resumeCombat')

    // Boot 1 -> game, then an authority pause latches the flag (the
    // remote cascade's onPause('terminal') path).
    const first = await lifecycle.bootGame({ createNewCharacter: false })
    expect(first.status).toBe('entered')
    lifecycle.startAutosave()
    lifecycle.pauseSimulation()
    expect(lifecycle.isSimPaused()).toBe(true)
    expect(freezeSpy).toHaveBeenCalledWith('authority-pause')
    expect(lifecycle.getTickHandle()).toBeUndefined()
    expect(lifecycle.getAutosaveHandle()).toBeUndefined()

    // The acknowledge -> re-auth -> re-boot chain (App.vue
    // acknowledgeAuthority = onlineAuthority.acknowledge() +
    // bootFlow.showAuth()): it only flips the stage; bootGame re-arms
    // clock/tick/autosave and re-enters 'game' - NOTHING clears
    // simPaused (no resumeSimulation call site exists on this path).
    boot.showAuth()
    const second = await lifecycle.bootGame({ createNewCharacter: false })
    expect(second.status).toBe('entered')
    lifecycle.startAutosave()

    // Sim is live again - tick and autosave intervals re-armed - but the
    // flag stayed latched from the previous pause.
    expect(lifecycle.isSimPaused()).toBe(true)
    expect(lifecycle.getTickHandle()).toBeDefined()
    expect(lifecycle.getAutosaveHandle()).toBeDefined()
    expect(liveIntervals.size).toBeGreaterThanOrEqual(2)

    // The next pause (heartbeat-failed, update admission, or the r30
    // refuse arm) is a silent no-op: no freezeCombat, intervals keep
    // running - the r30-INT-1 defect re-arms through the stale flag.
    lifecycle.pauseSimulation()
    expect(freezeSpy).toHaveBeenCalledTimes(1)
    expect(lifecycle.getTickHandle()).toBeDefined()
    expect(lifecycle.getAutosaveHandle()).toBeDefined()

    // The only recovery is a resume - terminal/refuse paths never emit
    // one, so the disarm lasts the whole re-entered session.
    lifecycle.resumeSimulation()
    expect(lifecycle.isSimPaused()).toBe(false)
    expect(resumeSpy).toHaveBeenCalledWith('authority-pause')
  })

  it('S2 control: a fresh lifecycle pause fires the freeze chain normally', async () => {
    const { lifecycle, gameManager } = lifecycleHarness()
    const freezeSpy = vi.spyOn(gameManager, 'freezeCombat')

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })
    expect(outcome.status).toBe('entered')
    expect(lifecycle.isSimPaused()).toBe(false)

    lifecycle.pauseSimulation()
    expect(lifecycle.isSimPaused()).toBe(true)
    expect(freezeSpy).toHaveBeenCalledWith('authority-pause')
    expect(lifecycle.getTickHandle()).toBeUndefined()
  })

  it('S3 ordering pin: the refuse arm still calls pauseSimulation before bootFlow.fail() (r30-INT-2)', () => {
    const appSource = readFileSync(
      fileURLToPath(new URL('../../App.vue', import.meta.url)),
      'utf-8',
    )
    const armStart = appSource.indexOf('DATA_REFUSE_CODES.has(result.code)')
    const armEnd = appSource.indexOf('return result', armStart)
    const arm = appSource.slice(armStart, armEnd)
    const pauseIndex = arm.indexOf('lifecycle.pauseSimulation()')
    const failIndex = arm.indexOf('bootFlow.fail()')
    expect(pauseIndex).toBeGreaterThanOrEqual(0)
    expect(failIndex).toBeGreaterThanOrEqual(0)
    expect(pauseIndex).toBeLessThan(failIndex)
  })
})

// ----------------------------------------------------------------------------
// (W) window-input asymmetry: decompose's settleOffline now requires
// offlineSinceMs in [0, 2^52) while the production sibling's
// emptyLaneStartMs still admits |x| < 2^52. Same crafted-negative window,
// opposite verdicts. Deny-shape of advanceWorkerLanes: completed [],
// forfeited 0, consumedBudgetMs 0, seededPending [], pending untouched.
// ----------------------------------------------------------------------------

describe('auditR31 INT probe - offline window asymmetry between siblings (W)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const CYCLE_MS = 3_600_000 // 1h cycles, deterministic budget arithmetic

  function lanesFor(
    emptyLaneStartMs: number,
    overrides: Partial<Parameters<typeof advanceWorkerLanes>[0]> = {},
  ) {
    return advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 3600,
      cycleMs: CYCLE_MS,
      pending: [],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs,
      advanceMode: 'deadline',
      budgetMs: CYCLE_MS * 10,
      ...overrides,
    })
  }

  it('W1 a negative emptyLaneStartMs mints ~budget completions through production while decompose zero-settles the identical window', () => {
    const NEG = -1_000_000_000_000

    // Decompose sibling: r30-AUT-1 guard denies the negative window.
    const { system } = startedDecomposeSystem()
    expect(system.settleOffline(currentMs, NEG)).toBe(0)
    expect(system.getSaveState().nextCycleAt).toBe(0)

    // Production sibling: the same value is an admitted lane seed -
    // deep-past backlog mints at the 10-cycle budget; the O(1) jump arm
    // forfeits the rest.
    const lanes = lanesFor(NEG)
    expect(lanes.completed.length).toBe(10)
    expect(lanes.consumedBudgetMs).toBe(CYCLE_MS * 10)
    expect(lanes.seededPending.length).toBe(1)

    // Control: emptyLaneStartMs = 0 is ADMITTED by both channels and
    // mints the identical budget - the negative arm grants nothing the
    // 0-seed does not already grant. Asymmetry is real but the mint
    // ceiling is unchanged vs the accepted deep-past class.
    const zeroSeed = lanesFor(0)
    expect(zeroSeed.completed.length).toBe(10)
    const { system: decomposeZero } = startedDecomposeSystem()
    expect(decomposeZero.settleOffline(currentMs, 0)).toBeGreaterThan(0)
  })

  it('W1b a future window start agrees across siblings - production seeds but pays 0, decompose confiscates', () => {
    const FUTURE = currentMs + 60_000
    const lanes = lanesFor(FUTURE)
    // Admit + park: the seeded lane exists but is not due yet.
    expect(lanes.completed.length).toBe(0)
    expect(lanes.pending.length).toBe(1)
    expect(lanes.seededPending.length).toBe(1)
    const { system } = startedDecomposeSystem()
    expect(system.settleOffline(currentMs, FUTURE)).toBe(0)
  })

  it('W2 headroom boundary: nowMs + cycleMs must stay < 2^52 or the seam denies outright', () => {
    // Just inside: a minted due lands at 2^52 - 1, inside the persisted
    // stamp domain - the lane seeds and parks (not due yet), no deny.
    const edgeOk = lanesFor(2 ** 52 - CYCLE_MS - 1, {
      nowMs: 2 ** 52 - CYCLE_MS - 1,
      budgetMs: CYCLE_MS * 3,
    })
    expect(edgeOk.seededPending.length).toBe(1)
    expect(edgeOk.pending[0]!.completesAtMs).toBeLessThan(2 ** 52)

    // Exactly at the boundary: a minted due would land on 2^52, outside
    // the persisted |x| < 2^52 domain - the seam denies (zero-advance
    // shape: no seeds, no completions, no consumed budget).
    const edgeDeny = lanesFor(0, {
      nowMs: 2 ** 52 - CYCLE_MS,
      budgetMs: CYCLE_MS * 3,
    })
    expect(edgeDeny.completed).toHaveLength(0)
    expect(edgeDeny.forfeited).toBe(0)
    expect(edgeDeny.consumedBudgetMs).toBe(0)
    expect(edgeDeny.seededPending).toHaveLength(0)
    expect(edgeDeny.pending).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// (T) flag-typing parity: validator typing vs the EquipmentBag consumer
// pool (dissolve filter !locked && !favorite, setProtected union,
// protectedCount === true || === true).
// ----------------------------------------------------------------------------

describe('auditR31 INT probe - locked/favorite typing vs flag consumers (T)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function wireWithEntry(entry: Partial<EquipmentInstance>): GameSave {
    const wire = validWireSave()
    const base = makeEquipmentInstance({ instanceId: 'r31_flagged' })
    wire.equipment = [{ ...base, ...entry }] as never
    return wire
  }

  it('T1 truthy non-boolean locked/favorite refuse at the gate; falsy non-boolean and explicit false admit differently vs absent', () => {
    const yesLocked = validateGameSaveShape(wireWithEntry({ locked: 'yes' as never }))
    expect(yesLocked.ok).toBe(false)
    expect(yesLocked.issues.some((i) => i.path.endsWith('.locked'))).toBe(true)

    const yesFavorite = validateGameSaveShape(wireWithEntry({ favorite: 1 as never }))
    expect(yesFavorite.ok).toBe(false)
    expect(yesFavorite.issues.some((i) => i.path.endsWith('.favorite'))).toBe(true)

    // Falsy non-boolean (0 / null) also refuse - the gate is
    // `!== undefined`, and only boolean-or-absent is producible.
    for (const bad of [0, null] as never[]) {
      const result = validateGameSaveShape(wireWithEntry({ locked: bad }))
      expect(result.ok).toBe(false)
    }

    // Explicit false and absent both admit and read unprotected to every
    // consumer (=== true counters and the truthy union agree).
    const falseLocked = validateGameSaveShape(wireWithEntry({ locked: false }))
    expect(falseLocked.ok).toBe(true)
    const absent = validateGameSaveShape(wireWithEntry({}))
    expect(absent.ok).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (V) verbatim parity spot-pin: TribulationDirector.restoreRuntime verbatim
// arm under a negative restore clock now PARKS a crafted cooldown (deny);
// under the old |x| < 2^53 domain the same call clamped the stamp to
// (-1e12 + 300s) -> getCooldownSeconds() = 0 -> free retry. The tighten
// closed that leg in the deny direction.
// ----------------------------------------------------------------------------

describe('auditR31 INT probe - restoreRuntime verbatim parity under tightened domain (V)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('V1 a crafted-future cooldownUntil under a negative restore clock parks verbatim - cooldown still reads active (deny), never a free retry', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime(
      { cooldownUntil: 1_000_000_000_000_000 },
      -1_000_000_000_000,
    )
    // Verbatim parked: remaining seconds stay positive - the retry leg
    // stays closed.
    expect(director.getCooldownSeconds(currentMs)).toBeGreaterThan(0)
  })

  it('V1b control: under a sane clock the same crafted stamp clamps at the authored bound', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime(
      { cooldownUntil: 1_000_000_000_000_000 },
      currentMs,
    )
    const remaining = director.getCooldownSeconds(currentMs)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(300 + 1)
  })
})
