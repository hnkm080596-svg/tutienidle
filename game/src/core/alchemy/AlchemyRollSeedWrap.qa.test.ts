import { describe, expect, it, vi } from 'vitest'

// Same betaScope mock as the sibling roll-seed suites - the tests
// exercise the ENABLED implementation.
vi.mock('../betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import {
  AlchemySystem,
  alchemyJobReservationDigest,
  alchemySecondsFor,
  ALCHEMY_MAX_BATCH_QUANTITY,
} from './AlchemySystem'
import type { ActiveAlchemyJob, AlchemyRecipe } from './AlchemySystem'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { MaterialBag } from '../material/MaterialBag'
import { MaterialRegistry } from '../material/MaterialRegistry'
import type { Material } from '../material/Material'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

// ---------------------------------------------------------------
// QA wave-6 blind seam hunt (2026-10-11) - AGGREGATE seam none of the
// five earlier waves could see: the R-fix bound `rollSeedBase % MAX
// === 0 && base < 2^32` still admits the LAST stride slot
// (2^32 - 1000 = 4294967000), whose own unit stream wraps the
// mulberry32 seed (>>> 0) and whose restore re-grounds the cursor
// PAST 2^32 - the next honest enqueue then persists a base the same
// validator rejects -> the save self-bricks at the following load.
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

// Largest stride-aligned base the current bound admits:
//   4294967000 = 2^32 - 296... the greatest multiple of 1000 < 2^32.
const WRAP_ADJACENT_BASE = 4_294_967_000

function saveWithJob(base: number): Record<string, unknown> {
  const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!
  const herbMaterialId = recipe.herbVariants[0]!.materialId
  const startedAtMs = 1_000
  const completesAtMs = startedAtMs + alchemySecondsFor(recipe, 1) * 1000
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

describe('R5-SEED-WRAP - validator must bound rollSeedBase so its own stream stays in [0, 2^32)', () => {
  // A base is only sane if its WHOLE unit stream fits the mulberry32
  // domain: unit i rolls seed (base + i), and quantity can reach
  // ALCHEMY_MAX_BATCH_QUANTITY. base = 4294967000 passes today's
  // stride + domain checks, yet unit 296 rolls seed 2^32 -> >>> 0 -> 0,
  // aliasing the FIRST order's stream (units 296..999 all wrap onto
  // bases 0..703). The bound must therefore be
  //   base + ALCHEMY_MAX_BATCH_QUANTITY <= 2^32  (i.e. base <= 4294966296)
  // so no admitted base ever wraps its own stream.
  it('rejects the last stride slot whose unit stream wraps mod 2^32', () => {
    const shape = validateGameSaveShape(saveWithJob(WRAP_ADJACENT_BASE))
    expect(shape.ok).toBe(false)
  })
})

describe('R5-SEED-WEDGE - an admitted wrap-adjacent base self-bricks the save', () => {
  // End-to-end: a crafted-but-accepted base re-grounds
  // rollSeedCursor = base + MAX = 4294968000 >= 2^32 in restoreJobs.
  // The next honest enqueue then stamps rollSeedBase = 4294968000 -
  // a value the same validator rejects - so the save this session
  // writes fails shape validation at the NEXT load ('corrupted'),
  // stranding the player on the recovery surface. The cursor clamp
  // must keep allocated bases inside the domain the validator admits.
  it('restore of a wrap-adjacent base keeps the next allocated base < 2^32', () => {
    const { system, bag, registry } = context()
    system.restoreJobs([makeJob({ jobId: 'crafted_wrap', rollSeedBase: WRAP_ADJACENT_BASE })])

    const res = system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 2_000, 4, 1, 1)
    expect(res.ok).toBe(true)

    const nextBase = system.getJobs().at(-1)!.rollSeedBase!
    expect(nextBase % ALCHEMY_MAX_BATCH_QUANTITY).toBe(0)
    expect(nextBase).toBeLessThan(2 ** 32)
    // And the save the writer would emit must still pass its own gate.
    const reserialized = validateGameSaveShape(saveWithJob(nextBase))
    expect(reserialized.ok).toBe(true)
  })
})
