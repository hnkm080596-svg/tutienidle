import { describe, expect, it, vi } from 'vitest'

// QA wave-7 (r6) blind seam hunt (2026-10-11) - AGGREGATE seam 5:
// getAlchemyJobs() is an UNFILTERED feed (pinned mechanism in
// AlchemyQueueSeams.qa.test.ts: a restored dormant-family order parks
// at the tick seam but never leaves this.jobs). Both consumers of the
// feed read it raw:
//   - useBuildingNavigation.getBuildingStatus: jobs.length > 0 -> 'active'
//   - useThienCoEntries 'active' branch: narrates jobs[0] verbatim
// A parked dormant order at jobs[0] therefore renders as a live brew:
// its stale deadline becomes the countdown (a past deadline clamps to
// "1 minute" forever), its frozen done/total becomes the progress line,
// and a REAL order sitting behind it is reduced to 'waiting'. The entry
// must skip parked orders - describe the first LIVE order, or not emit
// at all when every order is dormant.
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
} from '@/core/alchemy/AlchemySystem'
import type { ActiveAlchemyJob } from '@/core/alchemy/AlchemySystem'
import { BUI_GO_ID } from '@/core/equipment/TinhHoaMaterial'
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
      woodId: BUI_GO_ID,
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

function gameWithJobs(jobs: ActiveAlchemyJob[]) {
  const gm = new GameManager()
  gm.catalogOps.registerBuildings(buildings)
  gm.buildingManager.add({
    instanceId: 'b-pill',
    buildingId: 'pill_room',
    level: 1,
    lastCollectedAt: 0,
  })
  gm.alchemySystem.restoreJobs(jobs, Date.now())
  return gm
}

// A scope-hidden family restored from a pre-scope-lock save: the tick
// parks it forever (never settles, never delivers, uncancellable from
// any UI) yet it stays in the unfiltered getJobs() feed.
function dormantOrder(now: number): ActiveAlchemyJob {
  return makeJob({
    jobId: 'dormant_old_save',
    recipeId: 'alchemy_to_cot_dan_qi_refining',
    pillId: 'to_cot_dan_qi_refining',
    completesAtMs: now - 60_000, // deadline already past - parked
  })
}

describe('R6-THIENCO-DORMANT - parked orders must not narrate the brewing entry', () => {
  it('with a live order behind a parked one, the entry describes the LIVE order', async () => {
    const now = Date.now()
    const live = makeJob({
      jobId: 'order_live',
      quantity: 4,
      unitsDone: 2,
      completesAtMs: now + 30 * 60_000,
    })
    const gm = gameWithJobs([dormantOrder(now), live])

    const entries = await captureEntries(gm)
    const entry = entries.find((e) => e.id === 'active:pill_room')!

    expect(entry).toBeDefined()
    const params = entry.detailParams!
    // INVARIANT: progress and countdown come from the first LIVE order.
    expect(params.done).toBe(2)
    expect(params.total).toBe(4)
    expect(params.minutes).toBeGreaterThanOrEqual(29)
    expect(params.minutes).toBeLessThanOrEqual(31)
    // The parked order is not 'waiting' to brew - waiting counts only
    // other LIVE orders.
    expect(params.waiting).toBe(0)
  })

  it('emits no active:pill_room entry when every order is parked dormant', async () => {
    const now = Date.now()
    const gm = gameWithJobs([dormantOrder(now)])

    const entries = await captureEntries(gm)
    // INVARIANT: a queue that can never deliver is not brewing - no
    // phantom countdown on the home board (and the pill_room badge is
    // not 'active' either, same unfiltered-feed root cause).
    expect(entries.find((e) => e.id === 'active:pill_room')).toBeUndefined()
  })
})
