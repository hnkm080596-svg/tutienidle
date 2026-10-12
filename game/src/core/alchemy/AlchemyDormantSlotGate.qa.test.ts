import { describe, expect, it, vi } from 'vitest'

// Same betaScope mock as the sibling alchemy suites - the tests
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
} from './AlchemySystem'
import { BUI_GO_ID } from '../equipment/TinhHoaMaterial'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

// ---------------------------------------------------------------
// QA wave-7 (r6) blind seam hunt (2026-10-11) - AGGREGATE seam 5+2
// cross-system: the concurrent-slot gate counts EVERY persisted record
// in alchemyJobs (alchemyJobs.length > maxJobs -> refuse), while the
// save writer emits the UNFILTERED getJobs() feed - parked
// dormant-family records included (SaveSystem.ts: alchemyJobs:
// detachSaveValue(gameManager.alchemySystem.getJobs())). startJob
// deliberately does NOT count dormant records against live slots
// ('a restored dormant job... may not occupy the live slot'), so a
// player with a parked pre-scope-lock order can legitimately hold
// maxJobs live orders + 1 dormant. The writer persists that state,
// and the gate refuses it on the next load: an honest save
// self-bricks into the recovery surface.
// ---------------------------------------------------------------

function dormantRecord(): Record<string, unknown> {
  // Scope-hidden family restored from a pre-scope-lock save; parks at
  // the tick seam but stays in the unfiltered feed the writer emits.
  const job = {
    jobId: 'dormant_old_save',
    recipeId: 'alchemy_to_cot_dan_qi_refining',
    pillId: 'to_cot_dan_qi_refining',
    herbMaterialId: 'herb_decade',
    startedAtMs: 1_000,
    completesAtMs: 61_000,
    roomLevelAtStart: 1,
    quantity: 1,
    unitsDone: 0,
  }
  const witness = {
    woodId: BUI_GO_ID,
    fuelWoodAmount: 1,
    spiritStoneCost: 0,
    herbAmount: 1,
    luyenDanTinhHoaAmount: 1,
    specialIngredients: [],
    costScale: 1,
  }
  return { ...job, reservation: { ...witness, digest: alchemyJobReservationDigest(job, witness) } }
}

function liveRecord(jobId: string): Record<string, unknown> {
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
  }
  const witness = {
    woodId: BUI_GO_ID,
    fuelWoodAmount: Math.ceil(recipe.fuelWoodAmount),
    spiritStoneCost: Math.ceil(recipe.spiritStoneCost),
    herbAmount: recipe.herbAmount,
    luyenDanTinhHoaAmount: recipe.luyenDanTinhHoaAmount,
    specialIngredients: (recipe.specialIngredients ?? []).map((s) => ({ ...s })),
    costScale: 1,
  }
  return { ...job, reservation: { ...witness, digest: alchemyJobReservationDigest(job, witness) } }
}

function saveWithJobs(jobs: unknown[], pillRoomLevel = 1): Record<string, unknown> {
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
    buildings: [{ instanceId: 'b1', buildingId: 'pill_room', level: pillRoomLevel, lastCollectedAt: 0 }],
    productionSites: [],
    alchemyJobs: jobs,
  }
}

describe('R6-DORMANT-SLOT - parked orders must not consume the authored slot count at the gate', () => {
  it('accepts [dormant + live] at a level-1 pill_room (the state the writer honestly emits)', () => {
    // Level 1 -> maxJobs 1. The live queue is full, the dormant record
    // is dead weight the writer cannot drop (it rides the unfiltered
    // feed). INVARIANT: the slot gate counts only records that can
    // actually occupy a live slot (i.e. records that settle pills).
    const shape = validateGameSaveShape(
      saveWithJobs([dormantRecord(), liveRecord('live_1')]),
    )
    expect(shape.ok).toBe(true)
  })

  it('sanity pin: a genuine two-live-job save at level 1 still refuses (slot law intact)', () => {
    const shape = validateGameSaveShape(
      saveWithJobs([liveRecord('live_1'), liveRecord('live_2')]),
    )
    expect(shape.ok).toBe(false)
  })
})
