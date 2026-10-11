import { describe, expect, it, vi } from 'vitest'

// Same betaScope mock as AlchemySystem.test.ts - the suite exercises the
// ENABLED implementation, so the scope authority reports a beta family.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import {
  AlchemySystem,
  alchemyJobReservationDigest,
  alchemyMulberry32,
  alchemySecondsFor,
  ALCHEMY_MAX_BATCH_QUANTITY,
} from './AlchemySystem'
import type { ActiveAlchemyJob, AlchemyRecipe } from './AlchemySystem'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'
import { PillBag } from '../pill/PillBag'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

// ---------------------------------------------------------------
// Blind-QA repro suite (2026-10-11): defects INTRODUCED by the
// rollSeedBase adjudication commit 9c1ad6d8. Each test encodes the
// invariant the fix claims; every one FAILS on the current code.
// ---------------------------------------------------------------

const RECIPE: AlchemyRecipe = {
  id: 'recipe_test',
  pillId: 'pill_test',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thập Niên' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

function material(id: string): Material {
  return { id, name: id, category: 'other', sourceType: 'monster' }
}

function context() {
  const bag = new MaterialBag()
  const registry = new MaterialRegistry()
  registry.register(material('herb_decade'))
  registry.register(material(BUI_GO_ID))
  registry.register(material(LUYEN_DAN_TINH_HOA_ID))
  bag.add(registry.get('herb_decade'), 50)
  bag.add(registry.get(BUI_GO_ID), 50)
  bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), 50)
  const system = new AlchemySystem()
  system.setRecipeLookup((id) => (id === RECIPE.id ? RECIPE : undefined))
  return { bag, registry, system }
}

function makeJob(overrides: Partial<ActiveAlchemyJob> = {}): ActiveAlchemyJob {
  const job: ActiveAlchemyJob = {
    jobId: 'job_test',
    recipeId: RECIPE.id,
    pillId: RECIPE.pillId,
    herbMaterialId: 'herb_decade',
    startedAtMs: 0,
    completesAtMs: 1_000,
    roomLevelAtStart: 1,
    quantity: 1,
    unitsDone: 0,
    reservation: {
      woodId: BUI_GO_ID,
      fuelWoodAmount: RECIPE.fuelWoodAmount,
      spiritStoneCost: RECIPE.spiritStoneCost,
      herbAmount: RECIPE.herbAmount,
      luyenDanTinhHoaAmount: RECIPE.luyenDanTinhHoaAmount,
      specialIngredients: [],
      costScale: 1,
      digest: 0,
    },
    ...overrides,
  }
  job.reservation = { ...job.reservation, digest: alchemyJobReservationDigest(job, job.reservation) }
  return job
}

describe('REPRO F1 — rollSeedCursor leaks across restores (anti-scum invariant broken)', () => {
  // The commit claims "the cursor restores with the save", i.e. the
  // next order after loading a given save always lands the same anchor
  // (an undo+re-enqueue replays identical rolls). restoreJobs uses
  // Math.max(this.rollSeedCursor, ...) - it never re-grounds DOWN to
  // the save's restored maximum, so a cursor inflated by earlier
  // allocations leaks through the restore and the same save file
  // mints a different stream for the same action.
  it('same save, fresh-boot vs mid-session restore -> different next base', () => {
    // Fresh boot path: brand-new system, restore the (empty-queue) save.
    const fresh = new AlchemySystem()
    fresh.restoreJobs([])

    // Mid-session path: a live system whose cursor already advanced
    // (player enqueued + cancelled one job since boot, then loads the
    // same save via the remote/import restore seam).
    const { system: mid, bag, registry } = context()
    mid.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 4, 1, 1)
    mid.cancelJob(mid.getJobs()[0]!.jobId, bag, registry, 1_000)
    mid.restoreJobs([])

    // Enqueue the same order on both paths.
    const freshCtx = context()
    fresh.startJob(RECIPE, 'herb_decade', freshCtx.bag, freshCtx.registry, 0, 1, 1_000, 4, 1, 1)
    mid.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 2_000, 4, 1, 1)

    const freshBase = fresh.getJobs()[0]!.rollSeedBase
    const midBase = mid.getJobs()[0]!.rollSeedBase

    // INVARIANT: the same save allocates the same anchor regardless of
    // the live session's pre-restore allocation history.
    expect(midBase).toBe(freshBase)
  })

  it('cursor must re-ground to max(persisted bases)+MAX, not max(live cursor, ...)', () => {
    const { system, bag, registry } = context()

    // Push the live cursor two strides up.
    system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 4, 1, 1)
    system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 2_000, 4, 1, 1)

    // Restore a save holding exactly one job at base 0.
    const restored = makeJob({ jobId: 'job_restored', rollSeedBase: 0 })
    system.restoreJobs([restored], 500)

    // Next allocation must land at 0 + MAX (the save's own cursor) -
    // a fresh boot of this save mints the identical stream.
    system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 3_000, 4, 1, 1)
    const nextBase = system.getJobs().at(-1)!.rollSeedBase
    expect(nextBase).toBe(0 + ALCHEMY_MAX_BATCH_QUANTITY)
  })
})

describe('REPRO F3 — rollSeedBase save validation accepts impossible writer output', () => {
  // The writer only ever stamps multiples of ALCHEMY_MAX_BATCH_QUANTITY
  // inside [0, 2^32): allocRollSeedBase strides by the batch cap from
  // cursor 0, and mulberry32 folds the seed mod 2^32 (>>> 0). A base
  // that is not a multiple, or one >= 2^32, can never come from an
  // honest save yet passes the "integer >= 0" check - and because the
  // stream wraps mod 2^32 it collides with a low legitimate base,
  // making another order's rolls predictable.
  function saveWithJob(base: number): Record<string, unknown> {
    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!
    const herbMaterialId = recipe.herbVariants[0]!.materialId
    const startedAtMs = 1_000
    const completesAtMs =
      startedAtMs + alchemySecondsFor(recipe, 1) * 1000 * 1
    const job = {
      jobId: 'job_crafted',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId,
      startedAtMs,
      completesAtMs,
      roomLevelAtStart: 1,
      quantity: 1,
      unitsDone: 0,
      rollSeedBase: base,
    }
    const witness = {
      woodId: BUI_GO_ID,
      fuelWoodAmount: Math.ceil(recipe.fuelWoodAmount * 1),
      spiritStoneCost: Math.ceil(recipe.spiritStoneCost * 1),
      herbAmount: recipe.herbAmount,
      luyenDanTinhHoaAmount: recipe.luyenDanTinhHoaAmount,
      specialIngredients: (recipe.specialIngredients ?? []).map((s) => ({ ...s })),
      costScale: 1,
    }
    const player = createDefaultPlayer()
    player.realmLevel = 12
    player.lastSavedAt = 4e15
    return {
      version: CURRENT_SAVE_VERSION,
      player,
      techniques: [],
      skills: [],
      materials: [],
      equipment: [],
      equipmentSlots: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [{ instanceId: 'b1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 }],
      productionSites: [],
      alchemyJobs: [
        { ...job, reservation: { ...witness, digest: alchemyJobReservationDigest(job, witness) } },
      ],
    }
  }

  it('mulberry32 folds the seed mod 2^32 - a base >= 2^32 collides with a low legitimate base', () => {
    const low = alchemyMulberry32(7)
    const wrapped = alchemyMulberry32(7 + 2 ** 32)
    expect(wrapped()).toBe(low())
    // A crafted rollSeedBase of 2^32 + k mints the identical stream as
    // base k - validation must bound the field below the wrap point.
    const legit = alchemyMulberry32(0 + 7 + 2 ** 32)
    const legitZero = alchemyMulberry32(7)
    expect(legit()).toBe(legitZero())
  })

  it('validation must reject a non-stride / out-of-domain rollSeedBase', () => {
    // Non-multiple of the batch stride: the writer cannot emit it, and
    // its unit indices overlap the NEXT legitimate base's range.
    const offStride = validateGameSaveShape(saveWithJob(ALCHEMY_MAX_BATCH_QUANTITY + 1))
    expect(offStride.ok).toBe(false)

    // >= 2^32: wraps the mulberry32 seed onto a low legitimate stream.
    const wrapped = validateGameSaveShape(saveWithJob(2 ** 32 + 1))
    expect(wrapped.ok).toBe(false)
  })
})
