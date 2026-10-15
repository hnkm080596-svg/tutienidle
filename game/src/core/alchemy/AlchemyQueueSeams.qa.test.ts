import { describe, expect, it, vi } from 'vitest'

// QA-B blind adversarial review (queue-rework SEAMS) - tests only, no
// production edits. Same betaScope unlock the sibling suite uses so the
// test recipe id resolves as an enabled family.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import {
  AlchemySystem,
  ALCHEMY_MAX_BATCH_QUANTITY,
  type AlchemyRecipe,
  type ActiveAlchemyJob,
} from './AlchemySystem'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'
import { PillBag } from '../pill/PillBag'

function material(id: string): Material {
  return { id, name: id, category: 'other', sourceType: 'monster' }
}

const RECIPE: AlchemyRecipe = {
  id: 'recipe_test',
  pillId: 'pill_test',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thập Niên' }],
  herbAmount: 2,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 2,
  luyenDanTinhHoaAmount: 3,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

function buildContext(stock: { herb?: number; buiGo?: number; tinhHoa?: number } = {}) {
  const bag = new MaterialBag()
  const registry = new MaterialRegistry()

  registry.register(material('herb_decade'))
  registry.register(material(BUI_GO_ID))
  registry.register(material(LUYEN_DAN_TINH_HOA_ID))

  bag.add(registry.get('herb_decade'), stock.herb ?? 100)
  bag.add(registry.get(BUI_GO_ID), stock.buiGo ?? 100)
  bag.add(registry.get(LUYEN_DAN_TINH_HOA_ID), stock.tinhHoa ?? 100)

  const system = new AlchemySystem()
  system.setRecipeLookup((id) => id === RECIPE.id ? RECIPE : undefined)

  return { bag, registry, system }
}

describe('QA-B seam — luyen_dan_tinh_hoa batch accounting', () => {
  it('startJob quantity=N must burn tinh hoa x N, same as every sibling input', () => {
    const { bag, registry, system } = buildContext({ tinhHoa: 30 })

    const result = system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 4)

    expect(result.ok).toBe(true)
    // herb 2x4 = 8, bui_go 2x4 = 8 - tinh hoa must follow the same
    // per-unit law (merge path charges recipe.luyenDanTinhHoaAmount PER
    // CLICK, and reservation stores it as a per-unit amount).
    expect(bag.getAmount('herb_decade')).toBe(100 - 2 * 4)
    expect(bag.getAmount(BUI_GO_ID)).toBe(100 - 2 * 4)
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(30 - 3 * 4)
  })

  it('startJob quantity=N must REJECT when bag holds only N-1 unit worth of tinh hoa', () => {
    const { bag, registry, system } = buildContext({ tinhHoa: 3 * 4 - 1 })

    const result = system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 1, 1, 4)

    // 4 units * 3 tinh hoa = 12 required; bag has 11 -> deny. Today the
    // flat 1x check lets the batch mint 4 pills paying for 1.
    expect(result).toEqual({ ok: false, reason: 'missing_tinh_hoa' })
  })

  it('cancelJob refunds every unfinished unit including the active unit', () => {
    const { bag, registry, system } = buildContext({ tinhHoa: 30 })

    // 3 merged clicks = one order of 3, tinh hoa burned 3x3 = 9 total
    // (merge path correctly charges per unit).
    for (let i = 0; i < 3; i += 1) {
      expect(system.enqueueJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 1).ok).toBe(true)
    }

    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(30 - 3 * 3)

    const jobId = system.getJobs()[0]!.jobId

    // The active unit is unfinished too: all three reserved units refund.
    const cancelled = system.cancelJob(jobId, bag, registry, 2_000)

    expect(cancelled).toEqual({ ok: true, unprocessedUnits: 3 })
    expect(bag.getAmount('herb_decade')).toBe(100)
    expect(bag.getAmount(BUI_GO_ID)).toBe(100)
    // Every ingredient returns to its pre-order balance.
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(30)
    expect(system.getJobs()).toHaveLength(0)
    expect(system.cancelJob(jobId, bag, registry, 2_000)).toEqual({ ok: false })
    expect(bag.getAmount(LUYEN_DAN_TINH_HOA_ID)).toBe(30)
  })
})

describe('QA-B seam — merge legality at full slot count', () => {
  it('domain admits a same-order merge even when jobs.length == maxConcurrentJobs', () => {
    const { bag, registry, system } = buildContext()

    expect(system.enqueueJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 1_000, 1).ok).toBe(true)
    expect(system.getJobs()).toHaveLength(1)

    // The explicit total capacity is one; appending this active recipe
    // changes its quantity without allocating another order.
    const merged = system.enqueueJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 2_000, 1)

    expect(merged).toMatchObject({ ok: true, merged: true })
    expect(system.getJobs()).toHaveLength(1)
    expect(system.getJobs()[0]!.quantity).toBe(2)
  })
})

describe('QA-B seam - level-1 total order capacity', () => {
  it('admits four orders, merges the waiting tail at capacity, and rejects a fifth atomically', () => {
    const { bag, registry, system } = buildContext()
    const recipes = Array.from({ length: 5 }, (_, index) => ({ ...RECIPE, id: `recipe_${index}` }))
    system.setRecipeLookup(id => recipes.find(recipe => recipe.id === id))
    for (const recipe of recipes.slice(0, 4)) {
      expect(system.enqueueJob(recipe, 'herb_decade', bag, registry, 0, 1, 1_000, 4).ok).toBe(true)
    }
    expect(system.getJobs()).toHaveLength(4)
    expect(system.enqueueJob(recipes[3]!, 'herb_decade', bag, registry, 0, 1, 2_000, 4)).toMatchObject({ ok: true, merged: true })
    expect(system.getJobs()).toHaveLength(4)
    expect(system.getJobs()[3]!.quantity).toBe(2)
    const ingredients = [bag.getAmount('herb_decade'), bag.getAmount(BUI_GO_ID), bag.getAmount(LUYEN_DAN_TINH_HOA_ID)]
    expect(system.enqueueJob(recipes[4]!, 'herb_decade', bag, registry, 0, 1, 2_000, 4)).toEqual({ ok: false, reason: 'job_slots_full', merged: false })
    expect(system.getJobs()).toHaveLength(4)
    expect([bag.getAmount('herb_decade'), bag.getAmount(BUI_GO_ID), bag.getAmount(LUYEN_DAN_TINH_HOA_ID)]).toEqual(ingredients)
  })
})

describe('QA-B seam — dormant-family parked order', () => {
  it('a restored dormant recipe order never settles and never leaves getJobs()', () => {
    const system = new AlchemySystem()
    const bag = new PillBag()

    // Parked by the tick seam (scopeHiddenPillFamilyOfId): the record is
    // deliberately kept intact forever - documented mechanism, kept as a
    // passing pin for the consumer-leak finding.
    const parked: ActiveAlchemyJob = {
      jobId: 'job_dormant',
      recipeId: 'alchemy_to_cot_dan_qi_refining',
      pillId: 'to_cot_dan_qi_refining',
      herbMaterialId: 'herb_decade',
      startedAtMs: 0,
      completesAtMs: 60_000,
      roomLevelAtStart: 1,
      reservation: {
        woodId: BUI_GO_ID,
        fuelWoodAmount: 1,
        spiritStoneCost: 0,
        herbAmount: 1,
        luyenDanTinhHoaAmount: 1,
        specialIngredients: [],
        costScale: 1,
        digest: 0,
      },
    }

    system.restoreJobs([parked], 0)
    system.setRecipeLookup(() => undefined)
    system.tick(120_000, bag, () => ({ id: 'x' }), () => 0)

    // Mechanism pin (passes): parked forever - past its own deadline,
    // invisible to the filtered surface, un-cancellable from any UI,
    // but still returned by getAlchemyJobs() which the unfiltered
    // consumers (Thien Co board, building badge) read.
    expect(system.getJobs()).toHaveLength(1)
    expect(system.getJobs()[0]!.completesAtMs).toBeLessThan(120_000)
  })
})

describe('QA-B seam — ALCHEMY_MAX_BATCH_QUANTITY sanity', () => {
  it('sanity: cap constant still matches the stack bound the reservation obeys', () => {
    expect(ALCHEMY_MAX_BATCH_QUANTITY).toBe(1000)
  })
})
