import { describe, expect, it, vi } from 'vitest'

// QA wave-6 residual blind hunt (2026-10-11) - adversarial review of
// the R5 rollSeedBase fix (0b45d0d4 + cc99d469 + merge 0c6964cc).
// The fix moved the validator bound to `base + MAX <= 2^32` and made
// restoreJobs skip out-of-domain bases for the CURSOR. Two residual
// seams remain, verified live on HEAD:
//
// R6-SEED-WEDGE (front-door reachable from an admitted save):
//   The largest base the new bound still admits is 4294966000
//   (multiple of MAX; 4294966000 + 1000 = 4294967000 <= 2^32).
//   restoreJobs re-grounds the cursor to 4294967000, and
//   allocRollSeedBase stamps-then-increments, so the NEXT honest
//   enqueue mints rollSeedBase = 4294967000 - a value the same
//   validator rejects (4294967000 + 1000 > 2^32). The session then
//   emits a save its own write gate (driveSave OUTGOING_ADMISSION /
//   next boot loadGame) refuses: the self-brick the fix claimed to
//   close survives, relocated one stride lower. The clamp changed
//   WHERE the boundary sits, not the invariant shape.
//
// R6-RESTORE-DROP (crafted-only; drop-contract violation):
//   restoreJobs skips the out-of-domain base for cursor math but
//   KEEPS the record in this.jobs - every other impossible record in
//   the same function drops at the boundary (negative/inverted
//   stamps, bad batch fields). The kept record persists into every
//   later write (the shape gate refuses it -> SAVE_INVALID), and its
//   unit stream wraps mod 2^32: mulberry32 truncates the seed via
//   >>> 0, so crafted unit 296 rolls seed 0 - replaying a base-0
//   order's own stream, the aliasing the anchor scheme exists to
//   prevent. Reachable only through callers that bypass the load
//   gate (the validator refuses such a save first) - defense-in-
//   depth hole, same class the fix targeted.

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
import { mulberry32 } from '../battle/SeededRandom'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { createDefaultPlayer } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'

const RECIPE: AlchemyRecipe = {
  id: 'recipe_test',
  pillId: 'pill_test',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'herb_decade', age: 'decade', label: 'Thap Nien' }],
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

// Largest stride-aligned base the current bound ADMITS:
// 4294966000 % 1000 == 0 and 4294966000 + 1000 <= 2^32.
const ADMITTED_LAST_BASE = 4_294_966_000
// First stride the new bound rejects (base + MAX > 2^32).
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

describe('R6-SEED-WEDGE - the last ADMITTED base still self-bricks', () => {
  it('admitted base -> restore -> next enqueue stamps a base the write gate refuses', () => {
    // Front door: the current headroom bound ADMITS 4294966000, so a
    // (crafted) save carrying it passes loadGame/import/driveSave.
    expect(validateGameSaveShape(saveWithJob(ADMITTED_LAST_BASE)).ok).toBe(true)

    const { system, bag, registry } = context()
    system.restoreJobs([
      makeJob({ jobId: 'admitted_tail', rollSeedBase: ADMITTED_LAST_BASE }),
    ])

    const res = system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 2_000, 4, 1, 1)
    expect(res.ok).toBe(true)

    const nextBase = system.getJobs().at(-1)!.rollSeedBase!
    // INVARIANT (violated on HEAD): a save the validator admits must
    // restore to a cursor whose next stamp the SAME validator admits.
    // On HEAD the cursor re-grounds to 4294967000 and the next honest
    // order stamps 4294967000 - rejected below, so every later write
    // of this session's state fails admission (self-brick).
    expect(validateGameSaveShape(saveWithJob(nextBase)).ok).toBe(true)
  })
})

describe('R6-RESTORE-DROP - out-of-domain jobs must not survive restoreJobs', () => {
  it('drops the crafted wrap-adjacent record like every other malformed entry', () => {
    const { system } = context()
    system.restoreJobs([
      makeJob({ jobId: 'base_zero', rollSeedBase: 0 }),
      makeJob({ jobId: 'crafted_wrap', rollSeedBase: WRAP_ADJACENT_BASE, quantity: 400 }),
    ])

    // Live harm evidence while the record survives (documented, runs
    // green): its unit-296 roll replays seed 0 - base_zero's own
    // stream - and the record serializes into a save the write gate
    // refuses. Cursor-skip neutralized allocation only.
    expect(mulberry32(WRAP_ADJACENT_BASE + 296)()).toBe(mulberry32(0)())

    // INVARIANT (violated on HEAD): impossible-authored records drop
    // at the restore boundary - the crafted job must not stay live.
    expect(
      system.getJobs().find((job) => job.jobId === 'crafted_wrap'),
    ).toBeUndefined()
  })

  it('documents the surviving allocation edge: next honest alloc after the cursor skip', () => {
    // Pin the CORRECT half of the fix: with jobs [2000, crafted], the
    // cursor skips the out-of-domain base and lands on 3000; the next
    // alloc stamps 3000 (stamps-then-increments, not increment-first)
    // and the crafted tail seeds (wrap to 0..703) do not alias a
    // base-3000 order. GREEN on HEAD - kept so a future change that
    // regresses the skip trips here.
    const { system, bag, registry } = context()
    system.restoreJobs([
      makeJob({ jobId: 'honest', rollSeedBase: 2000 }),
      makeJob({ jobId: 'crafted_wrap', rollSeedBase: WRAP_ADJACENT_BASE }),
    ])

    const res = system.startJob(RECIPE, 'herb_decade', bag, registry, 0, 1, 2_000, 4, 1, 1)
    expect(res.ok).toBe(true)

    expect(system.getJobs().at(-1)!.rollSeedBase).toBe(3000)
    expect(ALCHEMY_MAX_BATCH_QUANTITY).toBe(1_000)
  })
})
