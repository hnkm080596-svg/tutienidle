// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { primeMortalCreationPick } from './GameSave.fixture'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import { AlchemySystem, alchemySecondsFor } from '../../core/alchemy/AlchemySystem'
import { PillBag } from '../../core/pill/PillBag'
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { EQUIPMENT_BAG_SOFT_CAP, EquipmentBag } from '../../core/equipment/EquipmentBag'
import { dissolveInstances } from '../../core/equipment/EquipmentDissolve'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'
import type { Equipment } from '../../core/equipment/Equipment'

// BETA SCOPE - only the decompose engine is force-visible for this suite
// (it is scope-hidden in beta and audited as enabled, same convention as
// auditR21Cor.probe.test.ts). Every other scope keeps real visibility.
vi.mock('../../core/betaScope', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../core/betaScope')>()
  return {
    ...original,
    isScopeHidden: (feature: string) =>
      feature === 'equipmentOreDecompose' ? false : original.isScopeHidden(feature),
  }
})

// ============================================================================
// QA probe - fixpoint r30 AUT wave. Adversarial audit of the r29 batch at
// 33ade943: finite-clock doctrine across every ms-clock seam, the
// entryStage tick gate, the coded-refuse early return, array-cap []
// returns, protection-cap sibling walks, EquipmentBag.setProtected.
//
// FINDINGS:
//   F1 (Medium) - DecomposeSystem.settleOffline guards nowMs only;
//     offlineSinceMs is the lone unguarded window input left across the
//     offline-settle family (settleAutoFarmOffline guards its elapsed,
//     advanceWorkerLanes guards emptyLaneStartMs + budgetMs). NaN
//     collapses windowStartMs to NaN -> the confiscation fast-forward
//     arm never runs -> the settle loop pays EVERY due cycle up to the
//     5000 bound. Probed: 5000 settles vs exactly 2 for the honest 60s
//     window on identical restored state. Ungated-caller only, but the
//     r29 fix patched the sibling input on this same signature - the
//     doctrine is incomplete on the seam it just touched.
//   F2 (Medium) - validateEquipmentEntries requireBooleans `equipped`
//     but never `locked`/`favorite`: a crafted truthy non-boolean flag
//     (locked: 'yes') validates, restores verbatim through
//     EquipmentBag.add(), and reads protected to EVERY consumer
//     (dissolve -> 'locked', wash/refine guards, auto-dissolve
//     exclusion) - while setProtected, the only un-lock path, has no
//     production caller. 500 crafted entries wedge the whole equipment
//     channel: every later drop self-dissolves on arrival.
//   F3 (Low) - admitted-window asymmetries on the 2^53 guards:
//     (a) restoreJobs' shift arm fires under ANY admitted restoreNowMs
//       below the stamp - a negative-finite clock (-(2^52)-1, inside the
//       guard's |x| < 2^53 bound) re-anchors the queue deep-past and the
//       next honest tick mints it whole; a >= 0 pin would close the
//       unbounded half (small-positive lying clocks are inherent).
//     (b) startJob + the restore re-anchors admit clocks in
//       [2^52, 2^53): the stamped values then sit outside the persisted
//       domain (isBoundedTimestamp < 2^52) and wedge the NEXT save
//       write - deny direction, heals on the next honest restore.
//     Ungated-caller only (production restoreClockMs is bounded by
//     construction: min(lastSavedAt, authorityNowMs, Date.now())) -
//     severity parity with r29-AUT-F2.
//   F4 (Nit) - pauseSimulation/resumeSimulation share the entryStage
//     gate, so under the refuse-arm 'error' surface a live combat RAF
//     never receives the freeze the arm cannot reach. Every recovery
//     exit reloads, so no catch-up channel exists - cosmetic only.
//     (Pre-existing gate; the r29 tick gate is what actually freezes.)
//
// VERIFIED-HELD arms are asserted as positive behavior below.
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

const JOB_RECIPE = alchemyRecipes.find((recipe) => recipe.id === 'alchemy_thong_mach_dan')!

function jobAt(startedAtMs: number, jobId: string) {
  return alchemyJobFixture(
    {
      jobId,
      recipeId: JOB_RECIPE.id,
      pillId: JOB_RECIPE.pillId,
      herbMaterialId: JOB_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + alchemySecondsFor(JOB_RECIPE, 1) * 1000,
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

/** A fully schema-valid equipment entry with a chosen `locked` value. */
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

function startedDecomposeSystem(): { system: DecomposeSystem; bag: MaterialBag } {
  const bag = new MaterialBag()
  const system = new DecomposeSystem(bag, { cycleSeconds: 30 })
  system.updateCapacity(1)
  // Validator-admitted restore payload: nextCycleAt is non-negative-
  // finite-pinned only, started is boolean. Deep-past deadline = a long
  // backlog the window arithmetic must bound.
  system.restore(
    {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: 0,
      started: true,
    },
    currentMs,
  )
  return { system, bag }
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
// F1 - DecomposeSystem.settleOffline: the offlineSinceMs sibling input the
// r29 guard skipped. NaN skips the confiscation arm and pays the whole
// backlog up to the 5000-cycle bound.
// ============================================================================
describe('r30-AUT F1 - DecomposeSystem.settleOffline offlineSinceMs parity', () => {
  clockIsolated()

  it('NaN offlineSinceMs pays the entire deep-past backlog (5000-cycle bound)', () => {
    const { system, bag } = startedDecomposeSystem()
    const ore = materials.find((material) => material.id.includes('_ore_'))!
    bag.add(ore, 100_000)

    const settled = system.settleOffline(currentMs, NaN)
    const output = system.drainOutput()

    expect(settled).toBe(5000)
    expect(output.some((entry) => entry.amount > 0)).toBe(true)
  })

  it('control: the same backlog under an honest 60s window settles exactly 2', () => {
    const { system } = startedDecomposeSystem()

    const settled = system.settleOffline(currentMs, currentMs - 60_000)

    expect(settled).toBe(2)
  })

  it('control: a repeated settle over the same window settles 0 (idempotent)', () => {
    const { system } = startedDecomposeSystem()

    system.settleOffline(currentMs, currentMs - 60_000)
    expect(system.settleOffline(currentMs, currentMs - 60_000)).toBe(0)
  })

  it('+Infinity offlineSinceMs denies - the whole backlog is confiscated, 0 paid', () => {
    const { system } = startedDecomposeSystem()

    expect(system.settleOffline(currentMs, Infinity)).toBe(0)
    expect(system.getSaveState().nextCycleAt).toBeGreaterThan(currentMs)
  })

  it('-Infinity offlineSinceMs bounds by the 10h cap window (~1200 cycles, deny)', () => {
    const { system } = startedDecomposeSystem()

    const settled = system.settleOffline(currentMs, -Infinity)

    expect(settled).toBeGreaterThan(0)
    expect(settled).toBeLessThanOrEqual(1200)
  })
})

// ============================================================================
// F2 - locked/favorite have no type check: a crafted truthy non-boolean
// flag validates, then reads protected to every domain consumer.
// ============================================================================
describe('r30-AUT F2 - equipment locked/favorite truthy-flag admission', () => {
  clockIsolated()

  it("crafted locked:'yes' entry passes validateGameSaveShape", () => {
    const save = validWireSave()
    save.equipment = [craftedEquipmentEntry('crafted_locked', 'yes')] as never

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(true)
  })

  it("the admitted 'yes' restores verbatim and refuses dissolve as locked", () => {
    const bag = new EquipmentBag()
    bag.add(craftedEquipmentEntry('crafted_locked', 'yes') as unknown as EquipmentInstance)

    const instance = bag.get('crafted_locked')!
    expect(instance.locked).toBe('yes')
    expect(dissolveInstances(['crafted_locked'], bag, () => {})).toEqual({
      ok: false,
      reason: 'locked',
    })
  })

  it('a full bag of crafted-locked entries survives overflow - the honest drop pays', () => {
    const bag = new EquipmentBag()
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i += 1) {
      bag.add(
        craftedEquipmentEntry(`crafted_${i}`, 'yes') as unknown as EquipmentInstance,
      )
    }

    const rewards = bag.add(
      craftedEquipmentEntry('honest_drop', false) as unknown as EquipmentInstance,
    )

    expect(bag.get('crafted_0')).toBeDefined()
    expect(bag.get(`crafted_${EQUIPMENT_BAG_SOFT_CAP - 1}`)).toBeDefined()
    expect(bag.get('honest_drop')).toBeUndefined()
    expect(rewards).toHaveLength(1)
  })

  it('HELD - setProtected union pool: second flag free, 11th distinct refuses', () => {
    const bag = new EquipmentBag()
    for (let i = 0; i < 10; i += 1) {
      bag.add(makeInstance({ instanceId: `p${i}` }))
      expect(bag.setProtected(`p${i}`, 'locked', true).ok).toBe(true)
    }

    expect(bag.setProtected('p0', 'favorite', true).ok).toBe(true)

    bag.add(makeInstance({ instanceId: 'p10' }))
    expect(bag.setProtected('p10', 'locked', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })

    expect(bag.setProtected('p0', 'locked', false).ok).toBe(true)
    expect(bag.setProtected('p0', 'favorite', false).ok).toBe(true)
    expect(bag.setProtected('p10', 'locked', true).ok).toBe(true)
  })

  it('HELD - equipped entries may hold protection flags (validator counts them protected)', () => {
    const bag = new EquipmentBag()
    bag.add(makeInstance({ instanceId: 'eq', equipped: true }))
    expect(bag.setProtected('eq', 'locked', true).ok).toBe(true)
    expect(bag.get('eq')!.locked).toBe(true)
  })
})

// ============================================================================
// F3 - admitted-window asymmetry on the 2^53 clock guards.
// ============================================================================
describe('r30-AUT F3 - startJob origination gate boundary sweep', () => {
  clockIsolated()

  const recipe = alchemyRecipes[0]!

  const hostileClocks: Array<[string, number]> = [
    ['NaN', NaN],
    ['+Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['+2^53', 2 ** 53],
    ['-2^53', -(2 ** 53)],
    ['1e300', 1e300],
  ]

  for (const [label, clock] of hostileClocks) {
    it(`startJob(${label}) -> invalid_clock before any cost/burn`, () => {
      const system = new AlchemySystem()
      const result = system.startJob(
        recipe,
        'unobtainable_herb',
        new MaterialBag(),
        new MaterialRegistry(),
        0,
        1,
        clock,
        1,
      )
      expect(result).toEqual({ ok: false, reason: 'invalid_clock' })
    })
  }

  it('boundary: |x| < 2^53 is admitted - the origination gate does not fire', () => {
    const system = new AlchemySystem()
    for (const clock of [2 ** 53 - 1, -(2 ** 53) + 1, 0, -0, 2 ** 52 + 1]) {
      const result = system.startJob(
        recipe,
        'unobtainable_herb',
        new MaterialBag(),
        new MaterialRegistry(),
        0,
        1,
        clock,
        1,
      )
      expect(result.reason).not.toBe('invalid_clock')
    }
  })

  it('admitted-but-unpersistable window: 2^52 + 1 leaves isBoundedTimestamp', () => {
    const inGap = 2 ** 52 + 1
    // Mirror of the unexported validator bound (saveShapeValidation.ts:421).
    const isBoundedTimestamp = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 2 ** 52

    expect(Math.abs(inGap) < 2 ** 53).toBe(true)
    expect(isBoundedTimestamp(inGap)).toBe(false)
  })
})

// ============================================================================
// F3a - restoreJobs shift arm mints under a negative-finite restoreNowMs.
// ============================================================================
describe('r30-AUT F3a - restoreJobs negative-finite clock', () => {
  clockIsolated()

  it('restoreNowMs = -(2^52)-1 re-anchors the queue deep-past - honest tick mints it', () => {
    const reader = registeredManager()
    reader.alchemySystem.restoreJobs(
      [jobAt(currentMs - 60_000, 'r30_neg_clock')],
      -(2 ** 52) - 1,
    )

    const shifted = reader.alchemySystem.getJobs()[0]!
    expect(shifted.startedAtMs).toBe(-(2 ** 52) - 1)
    expect(shifted.completesAtMs).toBeLessThan(currentMs)

    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)

    expect(reader.alchemySystem.getJobs()).toHaveLength(0)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBeGreaterThan(0)
  })
})

// ============================================================================
// VERIFIED-HELD arms.
// ============================================================================
describe('r30-AUT held - restoreJobs verbatim arm under bad clock', () => {
  clockIsolated()

  it('-Infinity restoreNowMs keeps original stamps - postdated job stays parked', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs + 3_600_000, 'r30_verbatim_neg')
    reader.alchemySystem.restoreJobs([job], -Infinity)

    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(job.startedAtMs)
    expect(restored.completesAtMs).toBe(job.completesAtMs)

    const bag = new PillBag()
    reader.alchemySystem.tick(currentMs, bag, (id) => ({ id }), () => 0)
    expect(reader.alchemySystem.getJobs()).toHaveLength(1)
    expect(bag.getAmount(JOB_RECIPE.pillId)).toBe(0)
  })

  it('NaN restoreNowMs is verbatim too - no shift, digest untouched', () => {
    const reader = registeredManager()
    const job = jobAt(currentMs - 60_000, 'r30_verbatim_nan')
    reader.alchemySystem.restoreJobs([job], NaN)

    const restored = reader.alchemySystem.getJobs()[0]!
    expect(restored.startedAtMs).toBe(job.startedAtMs)
    expect(restored.completesAtMs).toBe(job.completesAtMs)
  })
})

describe('r30-AUT held - DecomposeSystem.restore verbatim merge under bad clock', () => {
  clockIsolated()

  it('NaN restoreNowMs parks a crafted-future deadline verbatim - settle pays 0', () => {
    const { system } = startedDecomposeSystem()
    const craftedFuture = currentMs + 3_600_000
    system.restore(
      {
        settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
        nextCycleAt: craftedFuture,
        started: true,
      },
      NaN,
    )

    expect(system.getSaveState().nextCycleAt).toBe(craftedFuture)
    expect(system.settleOffline(currentMs, currentMs - 60_000)).toBe(0)
  })
})
