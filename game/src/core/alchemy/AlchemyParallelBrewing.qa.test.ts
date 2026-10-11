import { describe, expect, it, vi } from 'vitest'

// QA wave-4 blind seam hunt (2026-10-11) - parallel-brewing seam:
// 2+ concurrent orders of DIFFERENT recipes must keep independent
// unitsDone/progress/rollSeed streams when one order cancels
// mid-flight, and cancel-refund must count the right units after
// merges. Same betaScope unlock as the sibling queue-seam suite.

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

  return { bag, registry, system: new AlchemySystem() }
}

describe('SEAM-2 parallel brewing — cross-order independence', () => {
  it('two different-recipe orders occupy two slots with independent anchors', () => {
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
    expect(b!.completesAtMs).not.toBe(a!.completesAtMs)
  })

  it('cancelling order A mid-flight leaves order B progress + stream untouched', () => {
    const { bag, registry, system } = buildContext()

    system.enqueueJob(RECIPE_A, 'herb_decade', bag, registry, 0, 1, 0, 2)
    system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2)
    // Merge B once: order B is quantity 2 now.
    system.enqueueJob(RECIPE_B, 'herb_red', bag, registry, 0, 1, 0, 2)

    // t = 70_000: A's single unit is started (60s/unit), B's unit 0 is
    // started (120s/unit) - neither deadline reached.
    const jobA = system.getJobs().find((job) => job.recipeId === 'recipe_a')!
    const before = system.getJobs().find((job) => job.recipeId === 'recipe_b')!
    const bSnapshot = JSON.parse(JSON.stringify(before))

    const cancelled = system.cancelJob(jobA.jobId, bag, registry, 70_000)
    expect(cancelled).toEqual({ ok: true, unprocessedUnits: 0 })

    const after = system.getJobs().find((job) => job.recipeId === 'recipe_b')!
    expect(JSON.parse(JSON.stringify(after))).toEqual(bSnapshot)
  })

  it('cancel-refund counts unstarted units after a merge (quantity 3, 1 started)', () => {
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
    // t = 59_999: only unit 0 is in the cauldron (it starts at t=0;
    // unit 1 enters at 60_000). units 1-2 unstarted -> refund 2 units.
    const cancelled = system.cancelJob(jobId, bag, registry, 59_999)
    expect(cancelled).toEqual({ ok: true, unprocessedUnits: 2 })
    expect(bag.getAmount('herb_decade')).toBe(500 - 2 * 3 + 2 * 2)
    expect(bag.getAmount(BUI_GO_ID)).toBe(500 - 2 * 3 + 2 * 2)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(500 - 1 * 3 + 1 * 2)
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
