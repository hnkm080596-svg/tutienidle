// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { AlchemySystem, alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import type { Equipment } from '../../core/equipment/Equipment'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'

// BETA SCOPE - only the decompose engine is force-visible for this suite
// (it is scope-hidden in beta and audited as enabled, same convention as
// auditR30Aut.probe.test.ts). Every other scope keeps real visibility.
vi.mock('../../core/betaScope', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../core/betaScope')>()
  return {
    ...original,
    isScopeHidden: (feature: string) =>
      feature === 'equipmentOreDecompose' ? false : original.isScopeHidden(feature),
  }
})

// ============================================================================
// QA probe - fixpoint r31 AUT wave. Adversarial audit of the r30 batch at
// e90f46a2: the unified [0, 2^52) persisted clock domain on every ms seam,
// the locked/favorite optional-boolean typing, and the refuse-arm
// pauseSimulation ordering.
//
// FINDINGS:
//   F1 (Low) - clock ARGUMENT guards do not bound the minted stamps: every
//     persisted due is minted as `clock + span`, and only the
//     WorkerLaneAdvance nowMs input got the companion headroom
//     `!(nowMs + Math.max(0, cycleMs) < 2**52)`. Every sibling `+span`
//     mint point can still stamp persisted dues >= 2^52 when an admitted
//     clock sits within a span of the bound: (a) the same function's
//     emptyLaneStartMs seed input (|x| < 2^52 only - no headroom),
//     (b) AlchemySystem.restoreJobs' shifted completesAtMs = restoreNow +
//     span, (c) ProductionSystem.restoreStates' shifted completesAtMs
//     (same arithmetic), (d) AlchemySystem.startJob's nowMs + duration,
//     (e) DecomposeSystem.tick / settleOffline's nowMs + cycleMs mints.
//     Each lands in this.jobs / state.workerCycles / this.nextCycleAt and
//     self-refuses the next save write (isBoundedTimestamp / write-gate
//     refuse -> coded 'SAVE_INVALID' -> corrupted + terminal arm). Ungated
//     caller only: every production clock is min-clamped at Date.now() so
//     the window (2^52 - span, 2^52) is unreachable today - same reachability
//     profile the project adjudicated at Low for r30-AUT-F3b, of which this
//     is the narrower +span residue. Probed on (a), (b), (e) plus an
//     end-to-end write-gate refuse on the minted stamps.
//   F2 (Nit) - asymmetric stamp domain: advanceWorkerLanes keeps the
//     symmetric |x| < 2^52 bound on emptyLaneStartMs and pending[] stamps
//     while the sibling offline window input on DecomposeSystem now denies
//     negatives (offlineSinceMs < 0 -> 0). A crafted-negative seed start
//     mints deep-past dues that settle under the budget cap vs the
//     decompose sibling's zero-settle for the identical crafted window -
//     parity inconsistency only; the mint is bounded (accepted deep-past
//     class). Probed: negative seeds admitted and paid.
//
// VERIFIED-HELD arms are asserted as positive behavior below (verbatim
// restore under bad clocks, the nowMs headroom on the input it does
// cover, flag-typing refuses truthy non-booleans).
// ============================================================================

let currentMs = 1_725_160_000_000

const BOUND = 2 ** 52

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

const JOB_RECIPE = alchemyRecipes.find((recipe) => recipe.id === 'alchemy_thong_mach_dan')!

function jobAt(startedAtMs: number, jobId: string, completesAtMs?: number) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: JOB_RECIPE.id,
      pillId: JOB_RECIPE.pillId,
      herbMaterialId: JOB_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: completesAtMs ?? startedAtMs + alchemySecondsFor(JOB_RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
    },
    undefined,
    JOB_RECIPE,
  )
}

function validWireSave(): GameSave {
  const writer = new GameManager()
  writer.catalogOps.registerEquipment(equipment)
  writer.catalogOps.registerAffixes(affixes)
  writer.catalogOps.registerBuildings(buildings)
  writer.catalogOps.registerPills(pills)
  writer.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

const AUTHORED_ITEM: Equipment = equipment[0]!

function craftedEquipmentEntry(instanceId: string, locked: unknown): Record<string, unknown> {
  const authored = AUTHORED_ITEM.mainStats[0]!
  const base = JSON.parse(
    JSON.stringify(
      makeInstance({
        instanceId,
        itemId: AUTHORED_ITEM.id,
        slot: AUTHORED_ITEM.slot,
        mainStat: {
          id: `${instanceId}-main`,
          sourceId: AUTHORED_ITEM.id,
          sourceType: 'equipment',
          stat: authored.stat,
          flat: authored.min,
        },
      }),
    ),
  ) as Record<string, unknown>
  base.locked = locked
  return base
}

function cycleAt(startedAtMs: number, completesAtMs: number, cycleId = 'cycle_probe'): ProductionCycle {
  return {
    cycleId,
    siteId: 'thanh_van_lam',
    collectionRealmId: 'luyen_khi',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs,
    completesAtMs,
  }
}

function clockIsolated() {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
}

// ============================================================================
// F1a - advanceWorkerLanes: the nowMs headroom guards the CLOCK it covers,
// but the sibling seed input emptyLaneStartMs keeps |x| < 2^52 only. A
// seed start one cycle below the bound mints dueMs/stamps >= 2^52.
// ============================================================================
describe('r31-AUT F1a - WorkerLaneAdvance emptyLaneStartMs seed headroom gap', () => {
  clockIsolated()

  it('emptyLaneStartMs = 2^52 - 1 mints persisted stamps >= 2^52 (write-gate wedge)', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: BOUND - 1,
      advanceMode: 'deadline',
      budgetMs: 86_400_000,
    })

    // The seeded lane due (emptyLaneStartMs + cycleMs) is far-future: it
    // stays pending and is persisted verbatim.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.startedAtMs).toBe(BOUND - 1)
    expect(result.pending[0]!.completesAtMs).toBeGreaterThanOrEqual(BOUND)

    // The persisted-stamp write gate (isBoundedTimestamp) refuses the
    // minted head -> coded refuse -> corrupted + terminal.
    expect(Math.abs(result.pending[0]!.completesAtMs) >= BOUND).toBe(true)
  })

  it('control: the nowMs input IT DOES headroom zero-advances at the same edge', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [],
      slots: 1,
      nowMs: BOUND - 1,
      emptyLaneStartMs: BOUND - 1,
      advanceMode: 'deadline',
      budgetMs: 86_400_000,
    })

    // !(nowMs + max(0, cycleMs) < 2^52) -> zero-advance: the asymmetry is
    // that only nowMs gets this arithmetic; the seed input does not.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(0)
  })
})

// ============================================================================
// F1b - AlchemySystem.restoreJobs shift arm: shifted.completesAtMs =
// restoreNow + span. An admitted clock within a span of the bound mints
// an over-bound persisted stamp.
// ============================================================================
describe('r31-AUT F1b - AlchemySystem.restoreJobs shift-arm over-bound mint', () => {
  clockIsolated()

  it('restoreNowMs = 2^52 - 1 re-grounds a post-dated job to completesAtMs >= 2^52', () => {
    const system = new AlchemySystem()
    const span = alchemySecondsFor(JOB_RECIPE, 1) * 1000
    // Job pair post-dates the restore clock (admitted via ungated caller):
    // the shift arm re-grounds it at restoreNow, minting span past it.
    const job = jobAt(BOUND - 1 + span, 'job_shift_probe')
    system.restoreJobs([job], BOUND - 1)

    const restored = system.getJobs()
    expect(restored).toHaveLength(1)
    expect(restored[0]!.startedAtMs).toBe(BOUND - 1)
    expect(restored[0]!.completesAtMs).toBeGreaterThanOrEqual(BOUND)
  })

  it('held: restoreNowMs outside [0, 2^52) parks the pair verbatim (deny)', () => {
    const system = new AlchemySystem()
    const job = jobAt(currentMs + 60_000, 'job_verbatim_probe')
    for (const clock of [-1, BOUND, Number.POSITIVE_INFINITY, Number.NaN]) {
      system.restoreJobs([job], clock)
      const restored = system.getJobs()
      expect(restored[0]!.startedAtMs).toBe(currentMs + 60_000)
      expect(restored[0]!.completesAtMs).toBe(job.completesAtMs)
    }
  })
})

// ============================================================================
// F1e - DecomposeSystem.tick: nowMs in (2^52 - cycleMs, 2^52) mints
// nextCycleAt = nowMs + cycleMs >= 2^52 -> persisted -> write refuse.
// ============================================================================
describe('r31-AUT F1e - DecomposeSystem.tick nextCycleAt over-bound mint', () => {
  clockIsolated()

  function startedSystem() {
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
    return system
  }

  it('tick(2^52 - 1) mints nextCycleAt >= 2^52 (persisted -> write refuse)', () => {
    const system = startedSystem()
    system.tick(BOUND - 1)
    expect(system.getSaveState().nextCycleAt).toBeGreaterThanOrEqual(BOUND)
  })

  it('control: tick(BOUND) zero-advances - the deadline stays parked', () => {
    const system = startedSystem()
    system.tick(BOUND)
    expect(system.getSaveState().nextCycleAt).toBe(0)
  })
})

// ============================================================================
// F1 end-to-end: stamps minted over the bound self-refuse the next write
// (the corrupted-card arm the r30 batch wired). Asserts the shape layer
// refuses every over-bound mint produced above.
// ============================================================================
describe('r31-AUT F1 - minted over-bound stamps refuse at the write gate', () => {
  clockIsolated()

  it('workerCycles / alchemyJobs / decompose.nextCycleAt >= 2^52 each refuse', () => {
    const sitesSave = validWireSave()
    ;(sitesSave as unknown as Record<string, unknown>).productionSites = [
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [cycleAt(BOUND - 1, BOUND + 30_000 - 1)],
      },
    ]
    const sitesResult = validateGameSaveShape(sitesSave)
    expect(sitesResult.ok).toBe(false)
    // The bound check collapses into the generic entry-shape refuse.
    expect(
      sitesResult.issues.some((issue) => issue.path === 'productionSites[0].workerCycles[0]'),
    ).toBe(true)

    const jobsSave = validWireSave()
    ;(jobsSave as unknown as Record<string, unknown>).alchemyJobs = [
      jobAt(BOUND - 1, 'job_wedge', BOUND + 60_000),
    ]
    const jobsResult = validateGameSaveShape(jobsSave)
    expect(jobsResult.ok).toBe(false)
    expect(
      jobsResult.issues.some((issue) => issue.path === 'alchemyJobs[0]'),
    ).toBe(true)

    const decomposeSave = validWireSave()
    ;(decomposeSave as unknown as Record<string, unknown>).decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: BOUND + 30_000 - 1,
      started: true,
    }
    const decomposeResult = validateGameSaveShape(decomposeSave)
    expect(decomposeResult.ok).toBe(false)
    expect(
      decomposeResult.issues.some((issue) => issue.path === '.decompose.nextCycleAt'),
    ).toBe(true)
  })
})

// ============================================================================
// F2 - asymmetric stamp domain: |x| < 2^52 on emptyLaneStartMs/pending
// admits negative stamps the sibling window guards now deny. Deep-past
// seeds settle under the budget cap (bounded mint, same class as the
// accepted deep-past residual) - the parity inconsistency is the Nit.
// ============================================================================
describe('r31-AUT F2 - symmetric |x| stamp domain admits negative epochs', () => {
  clockIsolated()

  it('a negative emptyLaneStartMs seeds deep-past lanes that settle under budget', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: -(BOUND - 1),
      advanceMode: 'deadline',
      budgetMs: 86_400_000,
    })

    // Negative seed start is ADMITTED (|x| bound, not the r30 [0,2^52)
    // domain) and mints bounded output - the decompose sibling denies the
    // identical crafted window outright (offlineSinceMs < 0 -> 0).
    expect(result.completed.length).toBeGreaterThan(0)
    expect(result.consumedBudgetMs).toBeLessThanOrEqual(86_400_000)
  })

  it('a negative-stamp pending pair is admitted (completes once, bounded)', () => {
    const result = advanceWorkerLanes({
      siteId: 'thanh_van_lam',
      collectionRealmId: 'luyen_khi',
      siteLevel: 1,
      baseSeconds: 30,
      cycleMs: 30_000,
      pending: [cycleAt(-(BOUND - 1), -(BOUND - 1) + 30_000)],
      slots: 0,
      nowMs: currentMs,
      advanceMode: 'observe',
    })

    expect(result.completed).toHaveLength(1)
    expect(result.completed[0]!.startedAtMs).toBeLessThan(0)
    expect(result.pending).toHaveLength(0)
  })
})

// ============================================================================
// Held - flag-typing: truthy non-boolean locked/favorite refuse (the r30
// fix verified still holding).
// ============================================================================
describe('r31-AUT held - equipment locked/favorite flag typing', () => {
  clockIsolated()

  it("crafted locked:'yes' / favorite:'yes' entries refuse", () => {
    const locked = validWireSave()
    locked.equipment = [craftedEquipmentEntry('crafted_locked', 'yes')] as never
    const lockedResult = validateGameSaveShape(locked)
    expect(lockedResult.ok).toBe(false)
    expect(lockedResult.issues.some((issue) => issue.path === 'equipment[0].locked')).toBe(true)

    const favorite = validWireSave()
    const favoriteEntry = craftedEquipmentEntry('crafted_favorite', false)
    favoriteEntry.favorite = 'yes'
    favorite.equipment = [favoriteEntry] as never
    const favoriteResult = validateGameSaveShape(favorite)
    expect(favoriteResult.ok).toBe(false)
    expect(favoriteResult.issues.some((issue) => issue.path === 'equipment[0].favorite')).toBe(true)
  })
})
