// Test fixture: replay-valid alchemy job literals. Wave 2
// (F-ALCH-JOB-FORGE) requires every persisted/restored job to carry
// the reservation witness startJob stamps; fixtures that build job
// literals go through this helper so the reservation re-derives the
// way the writer does (canonical fuel wood id, recipe costs at the
// claimed costScale, digest over the whole bundle).
//
// ASCII only (P15).

import {
  alchemyJobReservationDigest,
  type AlchemyJobReservation,
  type AlchemyRecipe,
} from './AlchemySystem'
import { BUI_GO_ID } from '../equipment/TinhHoaMaterial'
import type { AlchemyJobSave } from '../../services/save/saveTypes'

/**
 * Replay-valid AlchemyJobSave for a fixture job + recipe: the
 * reservation mirrors what startJob would have stamped. Overrides
 * replace reservation fields then the digest is refolded, so the
 * result stays self-consistent. Pass no recipe for jobs whose
 * recipeId is not authored (the digest arm still verifies; the
 * recipe-miss arm consumes them at settle).
 */
export function alchemyJobFixture(
  job: {
    jobId: string
    recipeId: string
    pillId: string
    herbMaterialId: string
    startedAtMs: number
    completesAtMs: number
    roomLevelAtStart: number
    // QUEUE REWORK - batch fields; omit both for a pre-rework
    // (one-unit) record, the digest folds whichever shape is given.
    quantity?: number
    unitsDone?: number
  },
  reservation?: Partial<Omit<AlchemyJobReservation, 'digest'>>,
  recipe?: AlchemyRecipe,
): AlchemyJobSave {
  const base: Omit<AlchemyJobReservation, 'digest'> = {
    // Materials economy rework - the reserved fuel id is always bui_go.
    woodId: recipe === undefined ? 'fixture_wood' : BUI_GO_ID,
    fuelWoodAmount: recipe?.fuelWoodAmount ?? 1,
    spiritStoneCost: recipe?.spiritStoneCost ?? 0,
    herbAmount: recipe?.herbAmount ?? 1,
    luyenDanTinhHoaAmount: recipe?.luyenDanTinhHoaAmount ?? 0,
    specialIngredients: (recipe?.specialIngredients ?? []).map((special) => ({ ...special })),
    costScale: 1,
  }
  const merged = { ...base, ...(reservation ?? {}) }

  return {
    ...job,
    reservation: {
      ...merged,
      digest: alchemyJobReservationDigest(job, merged),
    },
  }
}
