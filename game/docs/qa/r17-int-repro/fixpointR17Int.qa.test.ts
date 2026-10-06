// r17-INT audit repro - deterministic evidence for the spawned-lane
// re-stamp's origin-blindness (ProductionOffline.ts:183-191).
// No production code touched; this file + the sibling vitest config are
// the whole repro. Run:
//   npx vitest run --config docs/qa/r17-int-repro/vitest.r17.config.ts
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { settleProductionOffline } from '../../../src/core/production/ProductionOffline'
import type { ProductionSiteState } from '../../../src/core/production/ProductionTypes'
import { MaterialBag } from '../../../src/core/material/MaterialBag'
import { MaterialRegistry } from '../../../src/core/material/MaterialRegistry'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../../src/core/production/ProductionBalance'

const NOW = 1_000_000_000

function makeCycle(siteId: string, startMs: number, doneMs: number) {
  return {
    cycleId: `saved_${siteId}`,
    siteId,
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs: startMs,
    completesAtMs: doneMs,
  }
}

function makeState(siteId: string, workerCycles: ReturnType<typeof makeCycle>[]): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: true,
    activeWorkerSlots: 0,
    workerCycles,
  }
}

const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal']!, 1) * 1000

describe('r17-INT-01: spawned-lane re-stamp is chain-origin blind', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('server-anchored window: saved-lane chain successor gets shifted past its own deadline (deny = skew)', () => {
    // Fast client clock: device NOW is 1h ahead of the authority end.
    const skew = 3_600_000
    const untilMs = NOW - skew // settleNowMs under cold-boot fast clock
    const sinceMs = untilMs - 86_400_000 // offlineSinceMs (server epoch)

    // Saved lane (client-epoch deadline) completing 10s before the
    // window end -> spawns a pending successor at C + cycleMs.
    const savedDeadline = untilMs - 10_000
    const saved = makeCycle('s1', savedDeadline - CYCLE_MS, savedDeadline)
    const states = new Map<string, ProductionSiteState>([['s1', makeState('s1', [saved])]])

    settleProductionOffline(
      {
        states,
        getSiteDefinition: () => ({ siteId: 's1' }) as never,
        grantCycleRewards: () => undefined,
      },
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      untilMs,
      { workerCapacity: 1, offlineSinceMs: sinceMs },
    )

    const pending = states.get('s1')!.workerCycles!
    expect(pending.length).toBe(1)
    // The successor's stamp is derived from the SAVED lane's own
    // client-epoch deadline (WorkerLaneAdvance chain: due = lane.dueMs +
    // cycleMs) - it is already field-epoch. The blanket re-stamp pushes
    // it +skew anyway: tickWorkers pays it `skew` later than honest.
    const honestDeadline = savedDeadline + CYCLE_MS
    expect(pending[0]!.completesAtMs).toBe(honestDeadline + skew) // over-shift evidence
    expect(pending[0]!.completesAtMs).toBeGreaterThan(honestDeadline)
  })

  it('client-anchored window (clock slow at save): EVERY spawned lane is shifted by the skew CHANGE', () => {
    // Device clock was 1h SLOW at save (s0 < 0) and honest at restore:
    // offlineSinceMs anchors at lastSavedAt (client epoch),
    // settleNowMs = lastSavedAt + elapsed - NOT untilMs.
    const s0 = -3_600_000
    const lastSavedAt = NOW - 100_000 + s0 // client stamp of the save instant
    const elapsed = 50_000
    const settleNowMs = lastSavedAt + elapsed // client-anchored end (< NOW)
    const offlineSinceMs = lastSavedAt

    const states = new Map<string, ProductionSiteState>([['s1', makeState('s1', [])]])

    settleProductionOffline(
      {
        states,
        getSiteDefinition: () => ({ siteId: 's1' }) as never,
        grantCycleRewards: () => undefined,
      },
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      settleNowMs,
      { workerCapacity: 1, offlineSinceMs },
    )

    const pending = states.get('s1')!.workerCycles!
    expect(pending.length).toBe(1)
    // Seed was the client-epoch marker itself - its chain is already
    // field-epoch, yet the re-stamp adds Date.now() - settleNowMs.
    const seededDue = offlineSinceMs + CYCLE_MS
    const unshiftedPendingDue =
      offlineSinceMs + CYCLE_MS * Math.ceil((settleNowMs - offlineSinceMs + 1) / CYCLE_MS)
    expect(pending[0]!.completesAtMs).toBe(unshiftedPendingDue + (NOW - settleNowMs))
    expect(pending[0]!.completesAtMs).toBeGreaterThanOrEqual(seededDue)
  })
})
