import { describe, expect, it, vi } from 'vitest'

// Single-kiln scheduling: cancellation promotes waiting orders without
// changing their quantity or random stream, and every unfinished unit refunds.

vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'test_family',
}))

import { AlchemySystem, type AlchemyRecipe } from './AlchemySystem'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'
import { PillBag } from '../pill/PillBag'

function material(id: string): Material {
  return { id, name: id, category: 'other', sourceType: 'monster' }
}

const RECIPE_A: AlchemyRecipe = {
  id: 'recipe_a',
  pillId: 'pill_a',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thập Niên' }],
  herbAmount: 2,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 2,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

const RECIPE_B: AlchemyRecipe = {
  id: 'recipe_b',
  pillId: 'pill_b',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_red', age: 'decade', label: 'Thập Niên' }],
  herbAmount: 3,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  luyenDanTinhHoaAmount: 2,
  spiritStoneCost: 0,
  baseDurationSeconds: 120,
}

function buildContext() {
  const bag = new MaterialBag()
  const registry = new MaterialRegistry()

  for (const id of ['herb_decade', 'herb_red', BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID]) {
    registry.register(material(id))
    bag.add(registry.get(id), 500)
  }

  const system = new AlchemySystem()
  system.setRecipeLookup((id) => [RECIPE_A, RECIPE_B].find((recipe) => recipe.id === id))
  return { bag, registry, system }
}

describe('SEAM-2 single-kiln scheduling and order isolation', () => {
  it('two recipes reserve separate orders and nonoverlapping kiln times', () => {
    const { bag, registry, system } = buildContext()

    expect(system.enqueueJob(RECIPE_A, 'herb_decade', bag, registry, 0, 1, 0, 2).ok).toBe(true)
    expect(system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2).ok).toBe(true)

    const [a, b] = system.getJobs()
    expect(system.getJobs()).toHaveLength(2)
    expect(a!.recipeId).toBe('recipe_a')
    expect(b!.recipeId).toBe('recipe_b')
    // rollSeedBase strides by 1000 per allocation - the streams cannot
    // collide for any quantity <= the cap.
    expect(a!.rollSeedBase).toBe(0)
    expect(b!.rollSeedBase).toBe(1000)
    expect(b!.startedAtMs).toBe(a!.completesAtMs)
    expect(b!.completesAtMs).toBeGreaterThan(a!.completesAtMs)
  })

  it('cancelling active order A promotes waiting B without changing its quantity or random stream', () => {
    const { bag, registry, system } = buildContext()

    system.enqueueJob(RECIPE_A, 'herb_decade', bag, registry, 0, 1, 0, 2)
    system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2)
    // Merge B once: order B is quantity 2 now.
    system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2)

    // Cancel before A settles; B is waiting for the single kiln.
    const jobA = system.getJobs().find((job) => job.recipeId === 'recipe_a')!
    const before = system.getJobs().find((job) => job.recipeId === 'recipe_b')!
    const bSnapshot = { ...before }
    const bDuration = before.completesAtMs - before.startedAtMs

    const cancelled = system.cancelJob(jobA.jobId, bag, registry, 59_999)
    expect(cancelled).toEqual({ ok: true, unprocessedUnits: 1 })

    const after = system.getJobs().find((job) => job.recipeId === 'recipe_b')!
    expect(after.quantity).toBe(bSnapshot.quantity)
    expect(after.unitsDone).toBe(bSnapshot.unitsDone)
    expect(after.rollSeedBase).toBe(bSnapshot.rollSeedBase)
    expect(after.startedAtMs).toBe(59_999)
    expect(after.completesAtMs).toBe(59_999 + bDuration)
    expect(system.getJobs()).toHaveLength(1)
  })

  it('cancel-refund includes the active unit after a merge (quantity 3, none settled)', () => {
    const { bag, registry, system } = buildContext()

    for (let i = 0; i < 3; i += 1) {
      expect(
        system.enqueueJob(RECIPE_A, 'herb_decade', bag, registry, 0, 1, 0, 2).ok,
      ).toBe(true)
    }
    expect(system.getJobs()).toHaveLength(1)
    expect(system.getJobs()[0]!.quantity).toBe(3)

    const herbAfterBurn = bag.getAmount('herb_decade')
    expect(herbAfterBurn).toBe(500 - 2 * 3)

    const jobId = system.getJobs()[0]!.jobId
    // No unit has settled; active unit plus both waiting units refund.
    const cancelled = system.cancelJob(jobId, bag, registry, 59_999)
    expect(cancelled).toEqual({ ok: true, unprocessedUnits: 3 })
    expect(bag.getAmount('herb_decade')).toBe(500)
    expect(bag.getAmount(BUI_GO_ID)).toBe(500)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(500)
  })

  it("order B's deterministic mint stream is identical whether order A cancels mid-flight or settles", () => {
    // Two runs of the same world: A + B(merged to 2) enqueued. Run 1
    // cancels A before B's deadlines; run 2 lets A settle. B's
    // mintedGrades (quality draws off rollSeedBase=1000) must replay
    // identically - a cancel on a sibling order must not perturb the
    // surviving stream.
    const runBGrades = (cancelA: boolean) => {
      const { bag, registry, system } = buildContext()
      const pillBag = new PillBag()

      system.enqueueJob(RECIPE_A, 'herb_decade', bag, registry, 0, 1, 0, 2)
      system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2)
      system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2)
      system.setRecipeLookup((id) => [RECIPE_A, RECIPE_B].find((recipe) => recipe.id === id))

      if (cancelA) {
        const jobA = system.getJobs().find((job) => job.recipeId === 'recipe_a')!
        system.cancelJob(jobA.jobId, bag, registry, 59_999)
      }

      // +50pp success bonus makes every due unit mint exactly 1 pill so
      // mintedGrades records one draw per unit deterministically.
      system.tick(400_000, pillBag, (pillId) => ({ id: pillId }), undefined, 50)

      return system
        .drainSettlementEvents()
        .filter((event) => event.pillId === 'pill_b')
        .flatMap((event) => event.mintedGrades ?? [])
    }

    const gradesWithoutCancel = runBGrades(false)
    const gradesAfterCancel = runBGrades(true)

    expect(gradesWithoutCancel).toHaveLength(2)
    expect(gradesAfterCancel).toEqual(gradesWithoutCancel)
  })
})
