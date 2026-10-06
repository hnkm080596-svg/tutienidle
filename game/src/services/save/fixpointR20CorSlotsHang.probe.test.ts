// @vitest-environment node
import { it } from 'vitest'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'

declare const process: { env: Record<string, string | undefined> }

// R20-COR-2 helper - spawned ONLY by fixpointR20Cor.qa.test.ts with
// R20_SLOTS_HANG_PROBE=1. Skipped in every normal run so the hang can
// never stall the suite. With the env set, slots = +Infinity makes the
// empty-lane seed `for` loop's condition `count < Infinity` true
// forever: the process hangs until the parent kills it by timeout.
it.skipIf(process.env.R20_SLOTS_HANG_PROBE !== '1')(
  'advanceWorkerLanes with slots=+Infinity hangs the seed loop',
  () => {
    advanceWorkerLanes({
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: Number.POSITIVE_INFINITY,
      nowMs: 1_725_160_000_000,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 1,
    })
  },
)
