// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'

declare const process: { env: Record<string, string | undefined> }

// R21-COR helper - spawned ONLY by auditR21Cor.probe.test.ts with
// R21_NOWMS_HANG_PROBE=1. Skipped in every normal run so the hang can
// never stall the suite. With the env set, nowMs = 1e300 lets the r17
// jump arm land the lane cursor in the FP-absorption zone
// (dueMs + cycleMs === dueMs at ~1e300): the jumped head completes at
// headCost 0 forever - budget never drains, the grant loop never ends.
//
// The marker file is written BEFORE the hanging call: the parent
// distinguishes "armed then died without completing" (hang confirmed)
// from a startup crash (marker absent). The child runs with a capped
// heap (NODE_OPTIONS) so the unbounded completed.push OOMs quickly
// instead of growing for the full timeout window.
it.skipIf(process.env.R21_NOWMS_HANG_PROBE !== '1')(
  'advanceWorkerLanes with nowMs=1e300 hangs the deadline loop',
  () => {
    const marker = process.env.R21_HANG_MARKER_FILE

    if (marker) {
      writeFileSync(marker, 'armed')
    }

    advanceWorkerLanes({
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: 1,
      nowMs: 1e300,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
    })
  },
)
