import { describe, expect, it, vi } from 'vitest'

// QA-A blind adversarial review (devin/khai-mach @ 77d311dc) - queue
// rework attack tests. betaScope mocked like the main suite EXCEPT the
// dormant spelling alchemy_phi_van_dan_mortal stays scope-hidden so the
// parked-job seam is exercised for real.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: (id: string) =>
    id === 'alchemy_phi_van_dan_mortal' ? null : 'tu_linh_dan',
}))

import {
  AlchemySystem,
  alchemyJobReservationDigest,
  type ActiveAlchemyJob,
  type AlchemyRecipe,
} from './AlchemySystem'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { PillBag } from '../pill/PillBag'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'

const RECIPE: AlchemyRecipe = {
  id: 'alchemy_tu_linh_dan_mortal',
  pillId: 'pill_test',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thap Nien' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 2,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

function material(id: string): Material {
  return { id, name: id, category: 'other', sourceType: 'monster' }
}

function buildContext() {
  const bag = new MaterialBag()
  const registry = new MaterialRegistry()

  for (const id of ['herb_decade', BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID]) {
    registry.register(material(id))
  }

  bag.add(registry.get('herb_decade'), 20)
  bag.add(registry.get(BUI_GO_ID), 60)
  bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), 20)

  return { recipe: RECIPE, bag, registry, system: new AlchemySystem() }
}

describe('QA-A review - tinh hoa consistency across order construction paths', () => {
  it('startJob(quantity=3) burns the same tinh hoa as a 3-click merged order (per-unit contract)', () => {
    const a = buildContext()
    expect(
      a.system.startJob(RECIPE, 'herb_decade', a.bag, a.registry, 0, 1, 1_000, 5, 1, 3).ok,
    ).toBe(true)
    const burnedBatch = 20 - a.bag.getAmount(LUYEN_DAN_TINH_HOA_ID)

    const b = buildContext()
    for (let click = 0; click < 3; click += 1) {
      expect(
        b.system.enqueueJob(RECIPE, 'herb_decade', b.bag, b.registry, 0, 1, 1_000, 5).ok,
      ).toBe(true)
    }
    const burnedMerged = 20 - b.bag.getAmount(LUYEN_DAN_TINH_HOA_ID)

    // Same 3-unit order through two construction paths - identical
    // reservation digest shape (per-unit luyenDanTinhHoaAmount), so the
    // input burn must agree. Today: batch burns 1, merged burns 3.
    expect(burnedBatch).toBe(burnedMerged)
  })

  it('cancel refunds EVERY reserved per-unit input per unstarted unit - including tinh hoa', () => {
    const { bag, registry, system } = buildContext()

    for (let click = 0; click < 3; click += 1) {
      system.enqueueJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 5)
    }

    const jobId = system.getJobs()[0]!.jobId
    const tinhHoaBefore = bag.getAmount(LUYEN_DAN_TINH_HOA_ID)

    // now = startedAt + 500ms: unit 0 sits in the cauldron, units 1-2
    // never started -> unprocessed = 2, each reserved per-unit line
    // refunds x2.
    const cancelled = system.cancelJob(jobId, bag, registry, 1_500)
    expect(cancelled).toMatchObject({ ok: true, unprocessedUnits: 2 })
    expect(bag.getAmount('herb_decade')).toBe(20 - 3 + 2)
    expect(bag.getAmount(BUI_GO_ID)).toBe(60 - 6 + 4)
    // tinh hoa is a digest-bound per-unit reserved input like the rest;
    // unstarted units must get theirs back.
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(tinhHoaBefore + 2)
  })
})

describe('QA-A review - evidence passes', () => {
  it('legacy save job (no quantity/unitsDone, legacy digest) restores verbatim and settles', () => {
    const { system } = buildContext()
    const pillBag = new PillBag()

    const legacyReservation = {
      woodId: BUI_GO_ID,
      fuelWoodAmount: RECIPE.fuelWoodAmount,
      spiritStoneCost: RECIPE.spiritStoneCost,
      herbAmount: RECIPE.herbAmount,
      luyenDanTinhHoaAmount: RECIPE.luyenDanTinhHoaAmount,
      specialIngredients: [],
      costScale: 1,
      digest: 0,
    }
    const legacyBase = {
      jobId: 'legacy_1',
      recipeId: RECIPE.id,
      pillId: RECIPE.pillId,
      herbMaterialId: 'herb_decade',
      startedAtMs: 0,
      completesAtMs: 60_000,
      roomLevelAtStart: 1,
    }
    const legacyJob = {
      ...legacyBase,
      reservation: {
        ...legacyReservation,
        digest: alchemyJobReservationDigest(legacyBase, legacyReservation),
      },
    } as ActiveAlchemyJob

    system.setRecipeLookup((id) => (id === RECIPE.id ? RECIPE : undefined))
    system.restoreJobs([legacyJob], 1_000)

    // Verbatim: no batch fields minted onto the record, stamps untouched.
    expect(system.getJobs()[0]!.quantity).toBeUndefined()
    expect(system.getJobs()[0]!.startedAtMs).toBe(0)
    expect(system.getJobs()[0]!.completesAtMs).toBe(60_000)

    system.tick(61_000, pillBag, () => ({ id: RECIPE.pillId }), () => 0)
    expect(system.getJobs()).toHaveLength(0)
  })

  it('second cancel returns ok:false - no double refund path', () => {
    const { bag, registry, system } = buildContext()

    system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 5, 1, 3)
    const jobId = system.getJobs()[0]!.jobId

    expect(system.cancelJob(jobId, bag, registry, 1_500)).toMatchObject({
      ok: true,
      unprocessedUnits: 2,
    })
    const herbAfter = bag.getAmount('herb_decade')

    expect(system.cancelJob(jobId, bag, registry, 1_500)).toEqual({ ok: false })
    expect(bag.getAmount('herb_decade')).toBe(herbAfter)
  })

  it('dormant-family job parks at tick but stays in the unfiltered getJobs feed (ghost feed for unfiltered UI)', () => {
    const { system } = buildContext()
    const pillBag = new PillBag()

    const dormantReservation = {
      woodId: BUI_GO_ID,
      fuelWoodAmount: 1,
      spiritStoneCost: 0,
      herbAmount: 1,
      luyenDanTinhHoaAmount: 1,
      specialIngredients: [],
      costScale: 1,
      digest: 0,
    }
    const dormantBase = {
      jobId: 'dormant_1',
      recipeId: 'alchemy_phi_van_dan_mortal',
      pillId: 'phi_van_dan_mortal',
      herbMaterialId: 'herb_decade',
      startedAtMs: 0,
      completesAtMs: 60_000,
      roomLevelAtStart: 1,
    }
    const dormantJob = {
      ...dormantBase,
      reservation: {
        ...dormantReservation,
        digest: alchemyJobReservationDigest(dormantBase, dormantReservation),
      },
    } as ActiveAlchemyJob

    system.setRecipeLookup(() => undefined)
    system.restoreJobs([dormantJob], 1_000)

    system.tick(10_000_000, pillBag, () => ({ id: 'x' }), () => 0)

    // Parked at the delivery seam: no event, no pill, record intact...
    expect(system.drainSettlementEvents()).toHaveLength(0)
    expect(pillBag.getAmount('phi_van_dan_mortal')).toBe(0)
    // ...but still present in the raw feed every non-filtering reader
    // (Thien Co board, building status badge) consumes.
    expect(system.getJobs()).toHaveLength(1)
  })
})
