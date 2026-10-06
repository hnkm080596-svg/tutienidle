// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import { GameManager } from '../../core/game/GameManager'
import type { GameSave } from './saveTypes'
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
import {
  alchemySecondsFor,
  verifyAlchemyJobReservation,
} from '../../core/alchemy/AlchemySystem'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { PillBag } from '../../core/pill/PillBag'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { useAppLifecycle } from '../../composables/useAppLifecycle'
import type { GameManager as GameManagerType } from '../../core/game/GameManager'
import { makeInstance as makeEquipmentInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type { ProductionCycle } from '../../core/production/ProductionTypes'
import { buildProfessionMaterialId } from '../../core/profession/ProfessionMaterial'
import { EventBus } from '../../core/events/EventBus'
import { TribulationDirector } from '../../core/tribulation/TribulationDirector'

// ============================================================================
// QA probe - fixpoint r31 COR wave. Audits the r30 adjudication at e90f46a2:
//
//   (A) F-NEG-MINT: the new [0, 2^52) clock-input domain does NOT reach the
//       persisted stamp gate - isBoundedTimestamp admits |x| < 2^52 incl. ALL
//       negative stamps, so a crafted negative-due workerCycles/alchemyJobs
//       pair validates clean, restores verbatim, and mints on the next honest
//       tick. Full chain probes: gate -> restore -> tick -> grant/pill.
//   (B) F-WIN-ASYM: DecomposeSystem.settleOffline now denies offlineSinceMs
//       < 0 or >= 2^52 while the sibling production settle
//       (advanceWorkerLanes emptyLaneStartMs) still admits the SAME crafted
//       negative window start via |x| - and the comment claims parity.
//   (C) F-HEADROOM: only advanceWorkerLanes' nowMs arm got a
//       (nowMs + cycleMs < 2^52) headroom check. Sibling mint paths still
//       stamp clock + delta unbounded: startJob completesAtMs,
//       DecomposeSystem.tick nextCycleAt (3 sites + settle-loop increments),
//       seeded/lane-successor dues when emptyLaneStartMs > nowMs - each can
//       persist a stamp >= 2^52 that the next save write then refuses
//       (the same self-wedge class the batch fixed for workerLanes).
//       Reachability: crafted in-process clock feeds only - honest
//       Date.now() clocks sit at ~1.8e12 ms, far from 4.5e15.
//   (D) F-APPLIEDAT: applyTimedEffect clamps expiresAtMs on all three arms
//       but the push arm still persists appliedAtMs verbatim - a crafted
//       caller value >= 2^52 wedges the next save write the same way.
//   (E) locked/favorite optional-boolean gate truth table (undefined/boolean
//       admit; 'yes'/1/null/'true' refuse) + sibling `equipped` parity.
//   (F) WorkerLaneAdvance headroom/domain truth table: nowMs edges
//       (-1/-0/+0/2^52-1/2^52/NaN/+-Inf), cycleMs edges (0/negative/NaN),
//       slots edges, pending dues and emptyLaneStartMs |x| edges.
//   (G) pauseSimulation-before-fail ordering: the pause is a no-op off the
//       game stage, so calling it BEFORE bootFlow.fail() is load-bearing.
//   (H) domain-edge truth table across every touched seam: -1 is newly
//       denied at all seam clocks; -0/+0 admitted (pinned residual);
//       2^52-1 admitted; 2^52/NaN/+-Inf denied.
//   (I) honest-shape regression pins.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

const BOUND = 2 ** 52
const SITE_ID = THANH_VAN_PRODUCTION_SITES[0]!.siteId

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

/** A real writer-produced save in wire form (validateGameSaveShape-clean). */
function validWireSave(): GameSave {
  const writer = registeredManager()
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

function mortalRecipe() {
  return alchemyRecipes.find((r) => r.id === 'alchemy_tu_linh_dan_mortal')!
}

function mortalJob(startedAtMs: number, jobId: string) {
  const recipe = mortalRecipe()
  const variant = recipe.herbVariants[0]!
  const span = alchemySecondsFor(recipe, 1) * 1000
  const job = alchemyJobFixture(
    {
      jobId,
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: variant.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + span,
      roomLevelAtStart: 1,
    },
    undefined,
    recipe,
  )
  return { job, recipe, span }
}

const ANY_PILL = () => new PillBag()
const RESOLVE_ANY = (pillId: string) => ({ id: pillId })

function workerCycle(startedAtMs: number, completesAtMs: number, cycleId = 'cyc_probe'): ProductionCycle {
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

function laneParams(overrides: Partial<Parameters<typeof advanceWorkerLanes>[0]> = {}) {
  return {
    siteId: SITE_ID,
    collectionRealmId: 'mortal',
    siteLevel: 1,
    baseSeconds: CYCLE_BASE_SECONDS_BY_REALM.mortal!,
    cycleMs: 30_000,
    pending: [] as ProductionCycle[],
    slots: 1,
    nowMs: currentMs,
    emptyLaneStartMs: currentMs,
    advanceMode: 'observe' as const,
    ...overrides,
  }
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
// (A) F-NEG-MINT - crafted negative persisted stamps pass the |x| gate and
//     mint on the next honest tick. This is the class the r30-AUT-3 comments
//     themselves name ("a negative clock would mint an already-due job"),
//     but the seam guards only cover CLOCK INPUTS - persisted stamps keep
//     the legacy |x| < 2^52 domain.
// ----------------------------------------------------------------------------

describe('r31 COR - A: crafted negative persisted stamps mint (gate admits |x|)', () => {
  it('full chain: workerCycles {startedAtMs<0, completesAtMs<0} validates clean -> verbatim restore -> tick mints grant', () => {
    const save = validWireSave()
    // Test scope unlocks every beta feature, so the lane ceiling reads the
    // claimed pool: chi_hien_quan + autoWorkerCapacity must be present.
    save.buildings = [
      { instanceId: 'bld_chq', buildingId: 'chi_hien_quan', level: 1, lastCollectedAt: 0 },
    ] as never
    ;(save.player as unknown as Record<string, unknown>).autoWorkerCapacity = 3
    const span = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM.mortal!, 1) * 1000
    // All forgery pins pass: exact authored span, startedAt <= lastSavedAt,
    // siteLevelAtStart in [1, level], producible collection realm, int rollSeed.
    const forged = workerCycle(-2_000_000, -2_000_000 + span, 'forged_neg_lane')
    save.productionSites = [
      {
        siteId: SITE_ID,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 1,
        workerCycles: [forged],
      },
    ] as never

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(true)
    expect(
      shape.issues.filter((i) => i.path.includes('workerCycles')),
    ).toHaveLength(0)

    // Restore: the negative stamps never post-date a sane clock, so the
    // verbatim arm (explicitly designed) takes them as-is.
    const manager = registeredManager()
    manager.productionSystem.restoreStates(save.productionSites as never, currentMs)
    const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(restored.startedAtMs).toBe(-2_000_000)
    expect(restored.completesAtMs).toBe(-2_000_000 + span)

    // First honest tick: due <= now -> completes -> grantCycleRewards mints.
    manager.productionSystem.tickWorkers(
      currentMs,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      3,
    )
    expect(manager.productionSystem.drainSettlementEvents().length).toBeGreaterThan(0)
  })

  it('full chain: alchemyJobs {startedAtMs<0, completesAtMs<0} validates clean -> verbatim restore -> settle mints a pill', () => {
    const save = validWireSave()
    // maxJobs needs a claimed pill_room; level 1 <= mortal tier 1.
    save.buildings = [
      { instanceId: 'bld_1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ] as never
    const { job, span } = mortalJob(-1_000_000, 'forged_neg_job')
    save.alchemyJobs = [job] as never

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(true)
    expect(
      shape.issues.filter((i) => i.path.includes('alchemyJobs')),
    ).toHaveLength(0)

    const manager = registeredManager()
    manager.alchemySystem.restoreJobs(save.alchemyJobs as never, currentMs)
    const restored = manager.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(-1_000_000)
    expect(restored.completesAtMs).toBe(-1_000_000 + span)

    // Next honest tick: completesAtMs <= now -> settles -> pill minted.
    // rng=()=>0 plus a flat success bonus forces the guaranteed-pill arm.
    const pillBag = ANY_PILL()
    manager.alchemySystem.tick(currentMs, pillBag, RESOLVE_ANY, () => 0, 200)
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
    const events = manager.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(true)
    expect(events[0]!.delivered).toBeGreaterThanOrEqual(1)
  })

  it('control: the SAME job at an honest now-anchored stamp still settles - mint path is live', () => {
    const { job } = mortalJob(currentMs - 1_000_000, 'control_job')
    const manager = registeredManager()
    manager.alchemySystem.restoreJobs([job], currentMs)
    manager.alchemySystem.tick(currentMs, ANY_PILL(), RESOLVE_ANY, () => 0, 200)
    const events = manager.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (B) F-WIN-ASYM - decompose settleOffline denies the negative window start
//     that the sibling production settle still admits via |x|. Same crafted
//     lastSavedAt < 0 -> offlineSinceMs < 0 feeds both seams differently.
// ----------------------------------------------------------------------------

describe('r31 COR - B: window-input asymmetry (decompose denies, production admits)', () => {
  function decomposeWithOre() {
    const bag = new MaterialBag()
    const ore = materials.find((m) => /_ore_/.test(m.id))!
    bag.add(ore, 10_000)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs,
        started: true,
      },
      currentMs,
    )
    return { system, bag }
  }

  it('advanceWorkerLanes ADMITS emptyLaneStartMs = -1e6 (|x| form) and settles a deep-past cycle', () => {
    const result = advanceWorkerLanes(
      laneParams({ emptyLaneStartMs: -1_000_000 }),
    )
    // 'observe' mode seeds a lane due at -1e6 + cycleMs (< 0 <= nowMs)
    // and settles it in the same call - the crafted negative window start
    // is accepted as deep-past work.
    expect(result.completed.length).toBeGreaterThanOrEqual(1)
  })

  it('DecomposeSystem.settleOffline now DENIES the same -1e6 window start (returns 0)', () => {
    const { system } = decomposeWithOre()
    expect(system.settleOffline(currentMs, -1_000_000)).toBe(0)
  })

  it('DecomposeSystem.settleOffline denies the upper bound too: offlineSinceMs = 2^52 returns 0', () => {
    const { system } = decomposeWithOre()
    expect(system.settleOffline(currentMs, BOUND)).toBe(0)
  })

  it('advanceWorkerLanes still ADMITS the matching -1e6 pending head that decompose would deny as a window', () => {
    // Mechanism mirror: pending dues use the same |x| guard - a negative
    // due completes under a sane nowMs.
    const span = 30_000
    const result = advanceWorkerLanes(
      laneParams({ pending: [workerCycle(-2_000_000, -2_000_000 + span)] }),
    )
    expect(result.completed).toHaveLength(1)
    expect(result.pending).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// (C) F-HEADROOM - clock+delta mints without the WorkerLaneAdvance headroom
// ----------------------------------------------------------------------------

describe('r31 COR - C: headroom asymmetry - mint paths still stamp >= 2^52', () => {
  function alchemyContext() {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const woodId = buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)
    const bag = manager.materialBag
    const registry = manager.materialRegistry
    // stock the burn inputs so startJob reaches the mint arm
    bag.add(registry.get(variant.materialId), recipe.herbAmount)
    bag.add(registry.get(woodId), recipe.fuelWoodAmount)
    return { manager, recipe, variant, bag, registry }
  }

  it('startJob(nowMs = 2^52 - 1) admits the clock but mints completesAtMs >= 2^52 (out-of-domain stamp)', () => {
    const { manager, recipe, variant, bag, registry } = alchemyContext()
    const result = manager.alchemySystem.startJob(
      recipe,
      variant.materialId,
      bag,
      registry,
      1_000_000,
      1,
      BOUND - 1,
      4,
    )
    expect(result.ok).toBe(true)
    const minted = manager.alchemySystem.getJobs()[0]!
    expect(minted.completesAtMs).toBeGreaterThanOrEqual(BOUND)

    // The minted stamp then self-wedges the NEXT save write: the |x|
    // persisted gate refuses exactly this stamp (fails at the entry's
    // shape check - completesAtMs is outside |x| < 2^52).
    const save = validWireSave()
    save.buildings = [
      { instanceId: 'bld_1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ] as never
    save.alchemyJobs = [minted] as never
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((i) => i.path.startsWith('alchemyJobs')),
    ).toBe(true)
  })

  it('DecomposeSystem.tick(nowMs = 2^52 - 1) admits the clock but stamps nextCycleAt >= 2^52 (fresh-start arm)', () => {
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: 0,
        started: false,
      },
      currentMs,
    )

    system.tick(BOUND - 1)
    expect(system.getSaveState().nextCycleAt).toBeGreaterThanOrEqual(BOUND)
  })

  it('DecomposeSystem.tick(nowMs = 2^52 - 1) with a running cycle re-stamps nextCycleAt >= 2^52 (advance arm)', () => {
    const bag = new MaterialBag()
    const ore = materials.find((m) => /_ore_/.test(m.id))!
    bag.add(ore, 10_000)
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: BOUND - 2,
        started: true,
      },
      currentMs,
    )

    system.tick(BOUND - 1)
    expect(system.getSaveState().nextCycleAt).toBeGreaterThanOrEqual(BOUND)
  })

  it('the minted nextCycleAt >= 2^52 is refused by the persisted gate on the next write', () => {
    const save = validWireSave()
    save.decompose = {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: BOUND + 30_000,
      started: true,
    } as never

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((i) => i.path.endsWith('decompose.nextCycleAt')),
    ).toBe(true)
  })

  it('advanceWorkerLanes seeds due >= 2^52 when the caller passes emptyLaneStartMs > nowMs (headroom only covers nowMs)', () => {
    const result = advanceWorkerLanes(
      laneParams({
        // emptyLaneStartMs is admitted by |x| < 2^52 - it is never compared
        // to nowMs, so a caller-crafted start near the bound mints an
        // out-of-domain due.
        emptyLaneStartMs: BOUND - 10_000,
      }),
    )
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.completesAtMs).toBeGreaterThanOrEqual(BOUND)
  })

  it('deadline-mode successor dues ARE covered by the headroom - a chain can only mint dues <= nowMs + cycleMs < 2^52', () => {
    // lastDue <= nowMs for every completed lane, so successors mint
    // <= nowMs + cycleMs - the nowMs+headroom guard bounds them all.
    const result = advanceWorkerLanes(
      laneParams({
        pending: [workerCycle(currentMs - 60_000, currentMs - 30_000)],
        advanceMode: 'deadline',
      }),
    )
    expect(result.completed.length).toBeGreaterThanOrEqual(1)
    for (const cycle of result.pending) {
      expect(cycle.completesAtMs).toBeLessThan(BOUND)
    }
  })
})

// ----------------------------------------------------------------------------
// (D) F-APPLIEDAT - applyTimedEffect clamps expiresAtMs but pushes
//     appliedAtMs verbatim
// ----------------------------------------------------------------------------

describe('r31 COR - D: applyTimedEffect appliedAtMs verbatim (sibling-field half-fix)', () => {
  it('push arm persists a crafted out-of-domain appliedAtMs; the next save write refuses it', () => {
    const manager = registeredManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    primeMortalCreationPick(player, manager.skillManager)

    // applyTimedEffect push arm: expiresAtMs clamped, appliedAtMs verbatim.
    manager.effectOps.applyTimedEffect(player, {
      id: 'eff_probe',
      sourceItemId: 'pill_probe',
      appliedAtMs: 1e16, // >= 2^52 - crafted caller value
      expiresAtMs: 1e16,
      modifiers: [],
      effectGroup: 'probe_group',
      durationStackable: false,
    })

    const stored = player.persistentTimedEffects.find((e) => e.id === 'eff_probe')!
    expect(stored.appliedAtMs).toBe(1e16) // verbatim - no clamp
    expect(stored.expiresAtMs).toBe(BOUND - 1) // clamped arm confirms the sibling fix

    // The persisted stamp then self-wedges the next save write:
    // isBoundedTimestamp |x| < 2^52 refuses appliedAtMs = 1e16 AND the
    // appliedAtMs > lastSavedAt pin also fires.
    const shape = validateGameSaveShape(
      JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave,
    )
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((i) => i.path.includes('appliedAtMs')),
    ).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (E) locked/favorite optional-boolean gate (r30 fix under test)
// ----------------------------------------------------------------------------

describe('r31 COR - E: locked/favorite optional-boolean gate truth table', () => {
  function entryWith(flag: Record<string, unknown>) {
    const instance = makeEquipmentInstance()
    return {
      instanceId: instance.instanceId,
      itemId: instance.itemId,
      ...flag,
    }
  }

  it.each([
    [{}, true],
    [{ locked: true }, true],
    [{ locked: false }, true],
    [{ favorite: true }, true],
    [{ favorite: false }, true],
    [{ locked: true, favorite: true }, true],
    [{ locked: 'yes' }, false],
    [{ locked: 1 }, false],
    [{ locked: 0 }, false],
    [{ locked: null }, false],
    [{ locked: 'true' }, false],
    [{ favorite: 'yes' }, false],
    [{ favorite: 1 }, false],
    [{ favorite: {} }, false],
    [{ locked: [] }, false],
  ])('equipment flags %j -> shape ok = %j', (flag, expectedOk) => {
    const save = validWireSave()
    save.equipment = [entryWith(flag)] as never
    const shape = validateGameSaveShape(save)
    const flagIssues = shape.issues.filter(
      (i) =>
        i.path.endsWith('.locked') || i.path.endsWith('.favorite'),
    )
    expect(flagIssues.length === 0).toBe(expectedOk)
  })

  it('sibling parity: equipped was already strict-boolean - a truthy string refuses', () => {
    const save = validWireSave()
    save.equipment = [entryWith({ equipped: 'yes' })] as never
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((i) => i.path.includes('equipped')),
    ).toBe(true)
  })

  it('refusal is consistent: a truthy non-boolean locked no longer counts as unprotected - verdict is plain refuse', () => {
    const save = validWireSave()
    save.equipment = Array.from({ length: 12 }, (_, i) =>
      entryWith({ locked: i % 2 === 0 ? 'yes' : true }),
    ) as never
    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
    expect(
      shape.issues.some((i) => i.path.endsWith('.locked')),
    ).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// (F) WorkerLaneAdvance domain/headroom truth table
// ----------------------------------------------------------------------------

describe('r31 COR - F: advanceWorkerLanes domain + headroom truth table', () => {
  it.each([
    [-1, 0],
    [-0.5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
    [BOUND, 0],
    [BOUND + 1, 0],
    // headroom: nowMs + cycleMs >= 2^52 denies even in-domain nowMs
    [BOUND - 1, 0],
    [BOUND - 30_000, 0],
    // the first admitted clock below the headroom ceiling
    [BOUND - 30_001, 'admit'],
  ])('nowMs=%j with cycleMs=30000 -> %s advance', (nowMs, expected) => {
    const result = advanceWorkerLanes(
      laneParams({ nowMs: nowMs as number }),
    )
    if (expected === 0) {
      expect(result.completed).toHaveLength(0)
      expect(result.pending).toHaveLength(0)
    } else {
      // admitted: seeds land at emptyLaneStartMs - under a huge nowMs the
      // seed is instantly due and settles in the same call.
      expect(result.completed.length + result.pending.length).toBeGreaterThan(0)
    }
  })

  it.each([
    [0, 'admit'], // -0 and +0 both admit (pinned residual)
    [currentMs, 'admit'],
  ])('nowMs=%j -> %s (admitted edge; seed stamps emptyLaneStartMs)', (nowMs) => {
    const result = advanceWorkerLanes(
      laneParams({ nowMs: nowMs as number }),
    )
    expect(result.pending).toHaveLength(1)
    // seeds root at emptyLaneStartMs, not nowMs
    expect(result.pending[0]!.startedAtMs).toBe(currentMs)
  })

  it.each([
    [0, 'admit-no-seed'],
    [-5, 'admit-no-seed'],
    [Number.NaN, 'deny'],
    [BOUND, 'deny'], // headroom: nowMs + huge cycleMs >= 2^52
  ])('cycleMs=%j -> %s', (cycleMs, expected) => {
    const result = advanceWorkerLanes(
      laneParams({ cycleMs: cycleMs as number }),
    )
    if (expected === 'deny') {
      expect(result.completed).toHaveLength(0)
      expect(result.pending).toHaveLength(0)
    } else {
      // cycleMs <= 0 is not spawnable - no seeds, no completes
      expect(result.pending).toHaveLength(0)
    }
  })

  it.each([
    [0, 'admit'],
    [-1, 'deny'],
    [1.5, 'deny'],
    [65_536, 'admit'],
    [65_537, 'deny'],
    [Number.NaN, 'deny'],
  ])('slots=%j -> %s', (slots, expected) => {
    const result = advanceWorkerLanes(
      laneParams({ slots: slots as number }),
    )
    if (expected === 'deny') {
      expect(result.pending).toHaveLength(0)
      expect(result.completed).toHaveLength(0)
    } else if ((slots as number) === 0) {
      expect(result.pending).toHaveLength(0)
    } else {
      // every admitted slot seeds one lane
      expect(result.pending.length + result.completed.length).toBe(slots)
    }
  })

  it.each([
    [BOUND - 1, 'admit'],
    [BOUND, 'deny'],
    [-(BOUND - 1), 'admit'], // negative seed admitted - F-WIN-ASYM evidence
    [-BOUND, 'deny'],
    [Number.NaN, 'deny'],
    [Number.POSITIVE_INFINITY, 'deny'],
  ])('emptyLaneStartMs=%j -> %s', (seed, expected) => {
    const result = advanceWorkerLanes(
      laneParams({ emptyLaneStartMs: seed as number }),
    )
    if (expected === 'deny') {
      expect(result.pending).toHaveLength(0)
    } else {
      expect(result.pending.length + result.completed.length).toBeGreaterThan(0)
    }
  })

  it('pending dues: past-due negative pair settles (the F-NEG-MINT mechanism arm)', () => {
    const pending = [workerCycle(-BOUND + 1, -BOUND + 30_001)]
    const result = advanceWorkerLanes(
      laneParams({ pending, emptyLaneStartMs: undefined, slots: 0 }),
    )
    expect(result.completed).toHaveLength(1)
    expect(result.pending).toHaveLength(0)
  })

  it('pending dues: future-due in-domain pair is kept verbatim', () => {
    const pending = [workerCycle(BOUND - 60_001, BOUND - 30_001)]
    const result = advanceWorkerLanes(
      laneParams({ pending, emptyLaneStartMs: undefined, slots: 0 }),
    )
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
  })

  it.each([
    [BOUND - 30_000, BOUND],
    [-BOUND - 30_000, -BOUND],
  ])(
    'pending due at |x|=2^52 boundary (%j, %j) -> denied: lane parked verbatim, never settles',
    (start, due) => {
      const pending = [workerCycle(start, due)]
      const result = advanceWorkerLanes(
        laneParams({ pending, emptyLaneStartMs: undefined, slots: 0 }),
      )
      // deny direction parks the lane untouched (verbatim-parked doctrine),
      // it neither settles nor disappears.
      expect(result.completed).toHaveLength(0)
      expect(result.pending).toHaveLength(1)
      expect(result.pending[0]!.completesAtMs).toBe(due)
    },
  )
})

// ----------------------------------------------------------------------------
// (G) pauseSimulation-before-fail ordering (App.vue coded-refuse arm)
// ----------------------------------------------------------------------------

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
      load: vi.fn(async () => ({ status: 'empty' as const, revision: 0 as const })),
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      reset: vi.fn(),
      capability: 'local-only' as const,
    } as never,
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
      materialRegistry: { has: () => false },
      materialBag: { add: vi.fn(), getAll: () => [] },
      techniqueManager: { getAll: () => [] },
      skillManager: { getAll: () => [] },
      equipmentBag: { getAll: () => [] },
      pillBag: { getAll: () => [] },
      equipmentSlotManager: { getAll: () => [] },
      alchemySystem: { getJobs: () => [] },
      questManager: { getState: () => ({}) },
      decomposeSystem: { getSaveState: () => ({}) },
      tribulationDirector: { serializeRuntime: () => ({}) },
      productionSystem: { getSiteDefinitions: () => [], getAllStates: () => [] },
      setProductionAutoRestart: vi.fn(),
      setActivePlayer: vi.fn(),
      buildingManager: { add: vi.fn(), getAll: () => [] },
      refreshAutoWorkerCapacity: vi.fn(),
      restoreFromSave: vi.fn(),
      freezeCombat: vi.fn(),
      resumeCombat: vi.fn(),
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

describe('r31 COR - G: pauseSimulation ordering is load-bearing', () => {
  it('the arm order (pause while stage=game) freezes combat and stops the clock', () => {
    const stubs = lifecycleStubs()
    const lifecycle = useAppLifecycle({ ...stubs } as never)
    stubs.entryStage.value = 'game'
    lifecycle.startTickLoop(vi.fn())
    lifecycle.startAutosave()

    lifecycle.pauseSimulation()

    expect(stubs.gameManager.freezeCombat).toHaveBeenCalledWith('authority-pause')
    expect(stubs.clock.stop).toHaveBeenCalled()
    lifecycle.stopAll()
  })

  it('counterfactual: after fail() flips the stage off game, pauseSimulation is a no-op', () => {
    const stubs = lifecycleStubs()
    const lifecycle = useAppLifecycle({ ...stubs } as never)
    // bootFlow.fail() lands the error route - stage leaves 'game'.
    stubs.entryStage.value = 'error'

    lifecycle.pauseSimulation()

    // combat keeps running + clock keeps ticking if the pause is ordered
    // after fail() - the ordering in the arm is what makes it fire.
    expect(stubs.gameManager.freezeCombat).not.toHaveBeenCalled()
    expect(stubs.clock.stop).not.toHaveBeenCalled()
    lifecycle.stopAll()
  })
})

// ----------------------------------------------------------------------------
// (H) domain-edge truth table across every touched seam
// ----------------------------------------------------------------------------

describe('r31 COR - H: [0, 2^52) seam domain truth table', () => {
  it('alchemy startJob/tick deny -1 (previously |x| admitted it)', () => {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const bag = manager.materialBag
    for (const m of materials) {
      if (m.id === variant.materialId || m.id.includes(recipe.fuelWoodRealmId)) {
        bag.add(m, 10_000)
      }
    }
    const result = manager.alchemySystem.startJob(
      recipe,
      variant.materialId,
      bag,
      manager.materialRegistry,
      1_000_000,
      1,
      -1,
      4,
    )
    expect(result).toEqual({ ok: false, reason: 'invalid_clock' })

    // tick(-1): a restored due job does NOT settle
    const { job } = mortalJob(currentMs - 1_000_000, 'h_neg')
    manager.alchemySystem.restoreJobs([job], currentMs)
    manager.alchemySystem.tick(-1, ANY_PILL(), RESOLVE_ANY)
    expect(manager.alchemySystem.getJobs()).toHaveLength(1)
  })

  it('alchemy startJob stocking: honest inputs reach the mint arm', () => {
    const manager = registeredManager()
    const recipe = mortalRecipe()
    const variant = recipe.herbVariants[0]!
    const woodId = buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)
    const bag = manager.materialBag
    bag.add(manager.materialRegistry.get(variant.materialId), recipe.herbAmount)
    bag.add(manager.materialRegistry.get(woodId), recipe.fuelWoodAmount)
    const result = manager.alchemySystem.startJob(
      recipe,
      variant.materialId,
      bag,
      manager.materialRegistry,
      1_000_000,
      1,
      currentMs,
      4,
    )
    expect(result.ok).toBe(true)
  })

  it('production restoreStates denies -1 (verbatim arm)', () => {
    const manager = registeredManager()
    const started = currentMs + 60_000
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(started, started + 30_000)],
        },
      ],
      -1,
    )
    const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(restored.startedAtMs).toBe(started) // verbatim, not re-anchored
  })

  it('decompose tick/restore/settleOffline all deny -1/2^52/NaN', () => {
    const bag = new MaterialBag()
    const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
    system.updateCapacity(4)
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: currentMs,
        started: true,
      },
      currentMs,
    )

    const baseline = system.getSaveState().nextCycleAt
    for (const edge of [-1, BOUND, Number.NaN]) {
      system.tick(edge as number)
      expect(system.getSaveState().nextCycleAt).toBe(baseline) // deny: unchanged
    }
    expect(system.settleOffline(-1, currentMs)).toBe(0)
    expect(system.settleOffline(BOUND, currentMs)).toBe(0)
  })

  it('quest/tribulation restore deny -1 (verbatim/parked arms)', () => {
    const manager = registeredManager()
    // quest: lastDailyResetAtMs verbatim under bad clock
    manager.questManager.restore(
      {
        active: [],
        completedOnceIds: [],
        lastDailyResetAtMs: currentMs + 1_000_000,
      },
      -1,
    )
    expect(manager.questManager.getState().lastDailyResetAtMs).toBe(currentMs + 1_000_000)

    // tribulation: verbatim cooldown under bad clock
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({ cooldownUntil: currentMs + 1_000_000 }, -1)
    expect(director.serializeRuntime().cooldownUntil).toBe(currentMs + 1_000_000)
  })

  it('admit edges: -0/+0/2^52-1 pass every seam; honest save shape stays clean', () => {
    const manager = registeredManager()
    const started = currentMs + 60_000

    // -0 and +0 both satisfy x >= 0 (pinned residual - stamps land at
    // tiny-past, no mint).
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(started, started + 30_000)],
        },
      ],
      -0,
    )
    const restored = manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!
    expect(Math.abs(restored.startedAtMs)).toBeLessThanOrEqual(4)
    expect(restored.completesAtMs - restored.startedAtMs).toBe(30_000)

    // 2^52-1: admitted at restore (verbatim or shift arm) - no NaN, no wedge
    const { job, span } = mortalJob(currentMs + 60_000, 'h_top')
    manager.alchemySystem.restoreJobs([job], BOUND - 1)
    const restoredJob = manager.alchemySystem.getJobs()[0]!
    expect(Number.isFinite(restoredJob.completesAtMs)).toBe(true)
    expect(restoredJob.completesAtMs - restoredJob.startedAtMs).toBe(span)
  })
})

// ----------------------------------------------------------------------------
// (I) honest-shape regression pins
// ----------------------------------------------------------------------------

describe('r31 COR - I: honest-shape regression', () => {
  it('a real writer save validates clean', () => {
    const shape = validateGameSaveShape(validWireSave())
    expect(shape.ok).toBe(true)
    expect(shape.issues).toHaveLength(0)
  })

  it('honest equipment flags (locked/favorite booleans) validate clean', () => {
    const save = validWireSave()
    const instance = makeEquipmentInstance()
    save.equipment = [
      {
        instanceId: instance.instanceId,
        itemId: instance.itemId,
        locked: true,
        favorite: false,
      },
    ] as never
    const shape = validateGameSaveShape(save)
    expect(
      shape.issues.filter(
        (i) => i.path.endsWith('.locked') || i.path.endsWith('.favorite'),
      ),
    ).toHaveLength(0)
  })

  it('honest production/alchemy restores under a sane clock behave normally', () => {
    const manager = registeredManager()
    const { job, span } = mortalJob(currentMs + 60_000, 'honest_job')
    manager.alchemySystem.restoreJobs([job], currentMs)
    // post-dated under a sane clock -> shift arm re-grounds at restoreNowMs
    const restored = manager.alchemySystem.getJobs()[0]!
    expect(Math.abs(restored.startedAtMs - currentMs)).toBeLessThanOrEqual(4)
    expect(restored.completesAtMs - restored.startedAtMs).toBe(span)

    const started = currentMs - 60_000
    manager.productionSystem.restoreStates(
      [
        {
          siteId: SITE_ID,
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 1,
          workerCycles: [workerCycle(started, started + 30_000)],
        },
      ],
      currentMs,
    )
    expect(
      manager.productionSystem.getState(SITE_ID)!.workerCycles![0]!.completesAtMs,
    ).toBe(started + 30_000)
  })
})
