// @vitest-environment node
import { it } from 'vitest'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'

declare const process: { env: Record<string, string | undefined> }

// R21-INT-01 helper - spawned ONLY by auditR21Int.probe.test.ts with
// R21_SLOTS_HUGE_PROBE=1. Skipped in every normal run. With the env
// set, slots = 1e9 - it passes the r20 non-finite pin but trips the
// r21 bounded-integer pin (> 65536), so the call zero-advances and
// the child exits cleanly. If the pin ever regresses the seed loop
// pushes ~1e9 cursors until the capped heap dies instead.
it.skipIf(process.env.R21_SLOTS_HUGE_PROBE !== '1')(
  'advanceWorkerLanes with slots=1e9 exhausts the heap',
  () => {
    advanceWorkerLanes({
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: 1_000_000_000,
      nowMs: 1_725_160_000_000,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 1,
    })
  },
)
