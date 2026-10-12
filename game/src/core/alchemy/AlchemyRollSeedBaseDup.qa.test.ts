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
  alchemyJobReservationDigest,
  alchemySecondsFor,
  ALCHEMY_MAX_BATCH_QUANTITY,
} from './AlchemySystem'
import { BUI_GO_ID } from '../equipment/TinhHoaMaterial'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import { TECHNIQUES } from '../../data/technique/Techniques'

// ---------------------------------------------------------------
// QA wave-7 (r6) blind seam hunt (2026-10-11) - AGGREGATE seam 1:
// the allocator can never stamp the same rollSeedBase on two live
// orders (the cursor only advances in ALCHEMY_MAX_BATCH_QUANTITY
// strides and restore re-grounds it to max(base)+MAX), yet the save
// gate checks each job in isolation - it dedupes jobId across jobs
// (F-ALCH-JOBID-DUP) but never dedupes rollSeedBase. A crafted save
// carrying two orders that share one base is accepted, and on the
// next tick both orders roll unit i off seed (base + i): one stream
// window serves two deliveries, defeating the anti-scum anchor the
// base exists for. The gate must refuse a base shared between jobs
// the same way it refuses a shared jobId.
// ---------------------------------------------------------------

const SHARED_BASE = 2_000 // a legal stride-aligned in-domain base

function craftedJob(jobId: string, rollSeedBase: number): Record<string, unknown> {
  const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!
  const herbMaterialId = recipe.herbVariants[0]!.materialId
  const startedAtMs = 1_000
  const completesAtMs = startedAtMs + alchemySecondsFor(recipe, 1) * 1000
  const job = {
    jobId,
    recipeId: recipe.id,
    pillId: recipe.pillId,
    herbMaterialId,
    startedAtMs,
    completesAtMs,
    roomLevelAtStart: 1,
    quantity: 1,
    unitsDone: 0,
    rollSeedBase,
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
  return { ...job, reservation: { ...witness, digest: alchemyJobReservationDigest(job, witness) } }
}

function saveWithJobs(jobs: unknown[]): Record<string, unknown> {
  const player = createDefaultPlayer()
  // A foundation_establishment claim (tier 3) admits a level-3
  // pill_room -> maxJobs 2 -> the pair clears the slot law so the
  // base-dup check is what the verdict turns on. The realm claim
  // carries its mandated receipts (F-REALM-1).
  player.realmId = 'foundation_establishment'
  player.realmLevel = 18
  player.breakthroughGrade = 1
  player.highestFoundationAchieved = 'human'
  player.lastSavedAt = 4e15
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [JSON.parse(JSON.stringify(TECHNIQUES.find((t) => t.id === 'five_elements_art')))],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    // Level 3 -> maxJobs 2, so a two-job payload passes the slot law
    // and the base-domain checks are what decide the verdict.
    buildings: [{ instanceId: 'b1', buildingId: 'pill_room', level: 3, lastCollectedAt: 0 }],
    productionSites: [],
    alchemyJobs: jobs,
  }
}

describe('R6-SEED-DUP - the gate must refuse two live jobs sharing one rollSeedBase', () => {
  it('rejects a crafted pair of orders aliasing the same stream window', () => {
    // Two distinct jobIds (the jobId dedupe passes), one shared base.
    // No honest writer can emit this pair: allocRollSeedBase hands out
    // disjoint strides and the merge path never mints a second record.
    const shape = validateGameSaveShape(
      saveWithJobs([craftedJob('job_dup_a', SHARED_BASE), craftedJob('job_dup_b', SHARED_BASE)]),
    )
    expect(shape.ok).toBe(false)
  })

  it('sanity pin: distinct bases on distinct jobs still validate (writer output)', () => {
    const shape = validateGameSaveShape(
      saveWithJobs([
        craftedJob('job_ok_a', SHARED_BASE),
        craftedJob('job_ok_b', SHARED_BASE + ALCHEMY_MAX_BATCH_QUANTITY),
      ]),
    )
    expect(shape.ok).toBe(true)
  })
})
