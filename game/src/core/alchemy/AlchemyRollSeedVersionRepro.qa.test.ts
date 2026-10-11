// QA R3 seam repro (blind wave 3) - FINDING R3-ALCH-V1 (HIGH).
//
// Seam: the reservation witness's wire format changed INSIDE save
// version 89. The first v89 writer (77d311dc, "alchemy queue rework +
// spirit-stone flatten") folded the digest over
//   [jobId, recipeId, pillId, herbMaterialId, startedAtMs,
//    completesAtMs, roomLevelAtStart, ...batchFields, ...reservation]
// with NO rollSeedBase term. Commit 9c1ad6d8 then added `rollSeedBase`
// to the SAME fold (`seedField` arm in alchemyJobReservationDigest)
// while CURRENT_SAVE_VERSION stayed 89.
//
// Consequence (save downgrade at equal version): a v89 save written by
// THIS head carries jobs whose stored digest includes the seed field.
// Opened in an earlier v89 build the verifier recomputes the legacy
// fold, the digests mismatch, and validateAlchemyJobsSave rejects the
// WHOLE save with 'reservation witness khong replay duoc' - read by
// the user as save corruption, not a version gap. The project's own
// versioning rule (see saveVersion.ts v88 entry: a persisted-witness
// change that can no longer verify forces a version bump) required a
// bump for the fold change; none happened.
//
// Repro: the witness minted by today's writer must replay under the
// earliest v89 writer's fold for same-version compat - it does not.
// Deterministic - no ambient rng anywhere in the digest path.

import { describe, expect, it } from 'vitest'
import {
  alchemyJobReservationDigest,
  type AlchemyRecipe,
} from './AlchemySystem'
import { alchemyJobFixture } from './AlchemyJob.fixture'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

const RECIPE: AlchemyRecipe = {
  id: 'alchemy_repro_r3',
  pillId: 'pill_repro_r3',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_repro', age: 'decade', label: 'Herb' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

describe('R3-ALCH-V1 - rollSeedBase digest-fold changed inside v89 (downgrade break)', () => {
  it('a v89 save written by this head verifies under the first v89 writer fold', () => {
    // Job exactly as this head persists it: rollSeedBase stamped, digest
    // folded WITH the seed field (alchemyJobFixture mirrors startJob).
    const job = alchemyJobFixture(
      {
        jobId: 'alchemy_r3_job',
        recipeId: RECIPE.id,
        pillId: RECIPE.pillId,
        herbMaterialId: 'herb_repro',
        startedAtMs: 1_000,
        completesAtMs: 61_000,
        roomLevelAtStart: 1,
        quantity: 1,
        unitsDone: 0,
        rollSeedBase: 0,
      },
      undefined,
      RECIPE,
    )

    // What the earliest v89 writer (pre-anchor fold, no seedField arm)
    // recomputes for the same persisted record: the raw entry carries
    // rollSeedBase but the legacy fold ignores unknown terms, so the
    // old verifier folds the job WITHOUT it.
    const { rollSeedBase: _stripped, ...legacyJob } = job
    void _stripped
    const legacyFoldDigest = alchemyJobReservationDigest(legacyJob, job.reservation)

    // Post-fix contract: the digests MUST differ (the fold legitimately
    // changed) and the version gate below is what protects a downgraded
    // v89 build from reporting a witness mismatch - identical-version
    // rejection is exactly what the bump exists to prevent.
    expect(legacyFoldDigest).not.toBe(job.reservation.digest)
    expect(CURRENT_SAVE_VERSION).toBeGreaterThan(89)
  })

  it('CURRENT_SAVE_VERSION was bumped to cover the rollSeedBase fold change', () => {
    // The fold change shipped mid-v89 (9c1ad6d8) with no bump: the
    // version gate cannot explain to a downgraded build why the save
    // fails. Per the v88 precedent this contract change needed v90.
    expect(CURRENT_SAVE_VERSION).toBeGreaterThan(89)
  })
})
