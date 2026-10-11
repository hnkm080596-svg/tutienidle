import { describe, expect, it, vi } from 'vitest'

// QA wave-6 blind seam hunt (2026-10-11) - aggregate seam in the
// Thien Co "Dan phong dang luyen" entry under PARALLEL alchemy orders.
// The detail line composes one sentence from THREE different orders:
//   done/total -> alchemyJobs[0] (the first/enqueued order)
//   waiting    -> alchemyJobs.length - 1
//   minutes    -> min(completesAtMs over ALL jobs)
// With two concurrent orders where the SECOND finishes sooner, the
// line reads "1/5 vien dang luyen . 1 order cho . con 5 phut" -
// attributing order B's deadline to a sentence describing order A,
// while calling B "cho" (waiting) even though it is brewing in
// parallel and completes FIRST. The countdown must come from the
// same order the progress fraction describes.
vi.mock('@/core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
  betaRecipeFamilyOfId: () => 'tu_linh_dan',
}))

import { createSSRApp, h, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'

import { useThienCoEntries, type ThienCoEntry } from '@/composables/useThienCoEntries'
import {
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
  BUMP_STATE_KEY,
} from '@/composables/useGameState'
import { GameManager } from '@/core/game/GameManager'
import {
  alchemyJobReservationDigest,
  ALCHEMY_MAX_BATCH_QUANTITY,
} from '@/core/alchemy/AlchemySystem'
import type { ActiveAlchemyJob } from '@/core/alchemy/AlchemySystem'
import { buildings } from '@/data/building/buildings'

function makeJob(overrides: Partial<ActiveAlchemyJob>): ActiveAlchemyJob {
  const job: ActiveAlchemyJob = {
    jobId: 'job_a',
    recipeId: 'recipe_test',
    pillId: 'pill_test',
    herbMaterialId: 'herb_decade',
    startedAtMs: 0,
    completesAtMs: 1_000,
    roomLevelAtStart: 1,
    quantity: 1,
    unitsDone: 0,
    reservation: {
      woodId: 'bui_go',
      fuelWoodAmount: 1,
      spiritStoneCost: 0,
      herbAmount: 1,
      luyenDanTinhHoaAmount: 1,
      specialIngredients: [],
      costScale: 1,
      digest: 0,
    },
    ...overrides,
  }
  job.reservation = { ...job.reservation, digest: alchemyJobReservationDigest(job, job.reservation) }
  return job
}

async function captureEntries(gm: GameManager): Promise<ThienCoEntry[]> {
  setActivePinia(createPinia())
  let captured: ThienCoEntry[] = []
  const app = createSSRApp({
    setup() {
      const { entries } = useThienCoEntries()
      captured = entries.value
      return () => h('div')
    },
  })
  app.provide(GAME_MANAGER_KEY, gm)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  await renderToString(app)
  return captured
}

describe('R5-THIENCO-ORDER-MIX - pill_room entry must describe ONE order coherently', () => {
  it('minutes comes from the same order as done/total (jobs[0]), not the earliest across orders', async () => {
    const gm = new GameManager()
    gm.catalogOps.registerBuildings(buildings)
    gm.buildingManager.add({
      instanceId: 'b-pill',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })

    const now = Date.now()
    // jobs[0]: the order the progress fraction describes - 1/5 units,
    // its own deadline is ~50 minutes out.
    const slowOrder = makeJob({
      jobId: 'order_slow',
      quantity: 5,
      unitsDone: 1,
      completesAtMs: now + 50 * 60_000,
    })
    // A second PARALLEL order finishing in ~5 minutes - the entry's
    // 'waiting' count calls it queued, yet its deadline is what the
    // minutes field ends up reading.
    const fastOrder = makeJob({
      jobId: 'order_fast',
      quantity: 3,
      unitsDone: 0,
      completesAtMs: now + 5 * 60_000,
    })
    gm.alchemySystem.restoreJobs([slowOrder, fastOrder], now)

    const entries = await captureEntries(gm)
    const entry = entries.find((e) => e.id === 'active:pill_room')!

    expect(entry).toBeDefined()
    const params = entry.detailParams!
    expect(params.done).toBe(1)
    expect(params.total).toBe(5)
    // INVARIANT: the countdown narrates the SAME order whose progress
    // is shown - jobs[0]'s own remaining time (~50), not the
    // cross-order minimum (~5 stolen from the "waiting" order).
    expect(params.minutes).toBeGreaterThanOrEqual(49)
    expect(params.minutes).toBeLessThanOrEqual(51)
  })
})
