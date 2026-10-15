import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same betaScope unlock the sibling queue-seam suite uses so the test
// recipe id resolves as an enabled family (no parked dormant arm).
vi.mock('../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

// Real loadGame admission with seeded and unseeded reservation witnesses.
// Positive alchemy behavior uses CURRENT; old-version bytes are rejected.
// Old versions are now rejected. Current-schema job records must still
// verify their reservation witness, then settle through the real
// restoreJobs -> tick path minting deterministic rolls.

import {
  loadGame,
  buildGameSave,
  CURRENT_SAVE_VERSION,
} from './SaveSystem'
import { resolveSaveKey, setSaveAccountId } from './saveKeys'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { alchemyJobFixture } from '../../core/alchemy/AlchemyJob.fixture'
import {
  AlchemySystem,
  alchemyJobReservationDigest,
  verifyAlchemyJobReservation,
  alchemySecondsFor,
  type ActiveAlchemyJob,
  type AlchemyJobReservation,
} from '../../core/alchemy/AlchemySystem'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'
import { PillBag } from '../../core/pill/PillBag'

const SAVE_KEY = resolveSaveKey()

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

const RECIPE = alchemyRecipes.find((recipe) => recipe.id === 'alchemy_tu_linh_dan_mortal')!

function currentSaveWithJobs(jobs: Record<string, unknown>[], version: number = CURRENT_SAVE_VERSION) {
  const gameManager = new GameManager()
  gameManager.buildingManager.add({
    instanceId: 'b-pill',
    buildingId: 'pill_room',
    level: 1,
    lastCollectedAt: 0,
  })
  const player = createDefaultPlayer()
  player.lastSavedAt = 10_000_000

  const save = JSON.parse(JSON.stringify(buildGameSave(player, gameManager))) as Record<
    string,
    unknown
  >
  save.version = version
  save.alchemyJobs = jobs
  return JSON.stringify(save)
}

// Seeded job record: the digest binds batch progress and roll anchor.
function seededJob(overrides: Record<string, unknown> = {}) {
  const job = alchemyJobFixture(
    {
      jobId: 'v89_seeded_1',
      recipeId: RECIPE.id,
      pillId: RECIPE.pillId,
      herbMaterialId: RECIPE.herbVariants[0]!.materialId,
      startedAtMs: 1_000,
      completesAtMs: 1_000 + alchemySecondsFor(RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
      quantity: 1,
      unitsDone: 0,
      rollSeedBase: 0,
      ...overrides,
    },
    undefined,
    RECIPE,
  )
  return job as unknown as Record<string, unknown>
}

// Unseeded job shape accepted inside a current-schema save; the digest
// folds the fields actually present, independently of version admission.
function unseededJob(overrides: Record<string, unknown> = {}) {
  const seeded = alchemyJobFixture(
    {
      jobId: 'v89_legacy_1',
      recipeId: RECIPE.id,
      pillId: RECIPE.pillId,
      herbMaterialId: RECIPE.herbVariants[0]!.materialId,
      startedAtMs: 1_000,
      completesAtMs: 1_000 + alchemySecondsFor(RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
      ...overrides,
    },
    undefined,
    RECIPE,
  )
  const { rollSeedBase: _drop, ...legacy } = seeded as unknown as Record<
    string,
    unknown
  > & { rollSeedBase?: number }
  const reservation = legacy.reservation as AlchemyJobReservation
  legacy.reservation = {
    ...reservation,
    digest: alchemyJobReservationDigest(
      legacy as unknown as ActiveAlchemyJob,
      reservation,
    ),
  }
  return legacy
}

describe('strict version admission and current-schema alchemy job seams', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    setSaveAccountId(null)
  })

  it.each([
    ['seeded', () => seededJob()],
    ['unseeded', () => unseededJob()],
  ] as const)('rejects old-version %s jobs without rewriting bytes or restoring/minting', (_kind, job) => {
    const raw = currentSaveWithJobs([job()], 89)
    localStorage.setItem(SAVE_KEY, raw)
    const restore = vi.spyOn(AlchemySystem.prototype, 'restoreJobs')
    const tick = vi.spyOn(AlchemySystem.prototype, 'tick')
    try {
      expect(loadGame()).toEqual({ status: 'incompatible', foundVersion: 89, raw })
      expect(localStorage.getItem(SAVE_KEY)).toBe(raw)
      expect(restore).not.toHaveBeenCalled()
      expect(tick).not.toHaveBeenCalled()
    } finally { restore.mockRestore(); tick.mockRestore() }
  })

  it('current seeded job preserves its rollSeedBase reservation witness', () => {
    localStorage.setItem(SAVE_KEY, currentSaveWithJobs([seededJob()]))

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      const jobs = (outcome.save as { alchemyJobs?: ActiveAlchemyJob[] }).alchemyJobs
      expect(jobs).toHaveLength(1)
      expect(jobs![0]!.rollSeedBase).toBe(0)
      // The current-schema witness still replays after load.
      expect(verifyAlchemyJobReservation(jobs![0]!, RECIPE)).toBeNull()
    }
  })

  it('current-schema unseeded job preserves its reservation witness', () => {
    localStorage.setItem(SAVE_KEY, currentSaveWithJobs([unseededJob()]))

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      const jobs = (outcome.save as { alchemyJobs?: ActiveAlchemyJob[] }).alchemyJobs
      expect(jobs).toHaveLength(1)
      expect(jobs![0]!.rollSeedBase).toBeUndefined()
      expect(verifyAlchemyJobReservation(jobs![0]!, RECIPE)).toBeNull()
    }
  })

  it('the current-schema seeded job settles through restoreJobs->tick and mints', () => {
    const job = seededJob({
      completesAtMs: 1_000 + alchemySecondsFor(RECIPE, 1) * 1000,
    })
    localStorage.setItem(SAVE_KEY, currentSaveWithJobs([job]))

    const outcome = loadGame()
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return

    const jobs = (outcome.save as { alchemyJobs?: ActiveAlchemyJob[] }).alchemyJobs!
    const gameManager = new GameManager()
    gameManager.alchemySystem.restoreJobs(jobs as ActiveAlchemyJob[], 2_000)
    gameManager.alchemySystem.setRecipeLookup(
      (id) => alchemyRecipes.find((recipe) => recipe.id === id),
    )
    const pillBag = new PillBag()
    gameManager.alchemySystem.tick(10_000_000, pillBag, (pillId) => ({ id: pillId }))

    const events = gameManager.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ success: true, jobDone: true })
    expect(events[0]!.delivered).toBeGreaterThan(0)
  })

  it('a current-schema merged job (quantity>1, unitsDone>0) reloads mid-batch and rolls only the remaining units', () => {
    const job = seededJob({
      jobId: 'v89_merged_midbatch',
      quantity: 3,
      unitsDone: 1,
      completesAtMs: 1_000 + alchemySecondsFor(RECIPE, 1) * 1000 * 3,
    })
    localStorage.setItem(SAVE_KEY, currentSaveWithJobs([job]))

    const outcome = loadGame()
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') return

    const jobs = (outcome.save as { alchemyJobs?: ActiveAlchemyJob[] }).alchemyJobs!
    const system = new AlchemySystem()
    system.restoreJobs(jobs as ActiveAlchemyJob[], 2_000)
    system.setRecipeLookup((id) => alchemyRecipes.find((recipe) => recipe.id === id))

    const pillBag = new PillBag()
    // +50pp success bonus -> every due unit mints exactly 1 pill, so
    // mintedGrades records one draw per remaining unit.
    system.tick(10_000_000, pillBag, (pillId) => ({ id: pillId }), undefined, 50)

    const events = system.drainSettlementEvents()
    expect(events).toHaveLength(1)
    // unitsDone=1 already settled pre-save: the reload rolls exactly
    // the 2 outstanding units (indexes 1..2 off base 0) - never
    // re-mints unit 0.
    expect(events[0]).toMatchObject({ success: true, jobDone: true, unitsProcessed: 2 })
    expect(events[0]!.mintedGrades).toHaveLength(2)
  })

  it('current job restore re-folds a post-dated seeded job and the witness still verifies', () => {
    // startedAtMs > restoreNowMs (clock moved back between save and
    // load) forces restoreJobs to re-ground the pair and re-fold the
    // digest - the rollSeedBase must ride the fold or the job settles
    // as a failed job instead of minting.
    const system = new AlchemySystem()
    const job = alchemyJobFixture(
      {
        jobId: 'v89_seeded_postdated',
        recipeId: RECIPE.id,
        pillId: RECIPE.pillId,
        herbMaterialId: RECIPE.herbVariants[0]!.materialId,
        startedAtMs: 5_000,
        completesAtMs: 5_000 + alchemySecondsFor(RECIPE, 1) * 1000,
        roomLevelAtStart: 1,
        quantity: 1,
        unitsDone: 0,
        rollSeedBase: 0,
      },
      undefined,
      RECIPE,
    ) as unknown as ActiveAlchemyJob

    system.restoreJobs([job], 2_000)

    const restored = system.getJobs()
    expect(restored).toHaveLength(1)
    expect(restored[0]!.startedAtMs).toBe(2_000)
    expect(verifyAlchemyJobReservation(restored[0]!, RECIPE)).toBeNull()
  })
})
