import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { settleProductionOffline, type ProductionOfflineDeps } from '../../core/production/ProductionOffline'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type { GameSave } from './SaveSystem'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'

// ============================================================================
// QA repro - fixpoint r19 INT wave (blind audit of commit 8f60f30c, the r18
// adjudication batch). Probes the integration seams the r18 pins do not
// already cover:
//
//   A) crafted-parity: a validator-admitted oversized TLT expiry must mint
//      NOTHING beyond the honest class-max shape through the payout bound.
//   B) bound ordering: the stored (provenance+dur) bound may be TIGHTER
//      than the payout (lastSavedAt+dur) bound under a fast clock - deny
//      direction only - and must never be looser (that would admit mint).
//   C) mixed-lane seeded marking: a saved lane head keeps its own stamp
//      while seed-rooted heads in the same site re-stamp to field epoch.
//   D) oversubscribed forfeit parity: lanes dying on the slot rule count
//      exactly 1; the surviving lane counts its whole skipped tail.
//   E) observe-mode seeds DO carry `seeded` on the result, but the only
//      seededPending consumer lives in settleProductionOffline - no leak
//      channel exists online.
// ============================================================================

let currentMs = 1_725_160_000_000

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000 // 100_000
const T0 = 1_000_000

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1
  return {
    cycleId: `probe_cycle_${cycleSeq}`,
    siteId,
    collectionRealmId: REALM,
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: cycleSeq,
    startedAtMs,
    completesAtMs,
  }
}

function makeState(
  siteId: string,
  overrides: Partial<ProductionSiteState> = {},
): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: false,
    activeWorkerSlots: 0,
    workerCycles: [],
    ...overrides,
  }
}

function createDeps(states: Map<string, ProductionSiteState>): ProductionOfflineDeps {
  const siteDefinitions = new Map<string, ProductionSiteDefinition>(
    THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]),
  )
  return {
    states,
    getSiteDefinition: (siteId) => siteDefinitions.get(siteId),
    grantCycleRewards: () => {},
  }
}

function validSave(): Record<string, unknown> {
  const p = createDefaultPlayer()
  p.realmLevel = 12
  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    productionSites: [],
    alchemyJobs: [],
  }
}

function tltRecord(overrides: Record<string, unknown>) {
  return {
    id: 'fx-tlt',
    sourceItemId: 'tu_linh_tran',
    effectGroup: 'tu_linh_tran',
    cultivationSpeedPercent: 0.25,
    modifiers: [],
    ...overrides,
  }
}

describe('fixpoint r19 INT - r18 batch integration probes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    cycleSeq = 0
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // A) A crafted expires = lastSavedAt + 6d (inside the +7d validator
  //    allowance) must pay exactly what the honest class-max shape
  //    (expires = lastSavedAt + 24h) pays - the bound is a cap, not a
  //    mint widener.
  // ------------------------------------------------------------------
  it('crafted +6d TLT expiry pays no more than the honest +24h class max', () => {
    const build = (expiresAtMs: number) => {
      const save = validSave()
      const p = save.player as PlayerData
      const lastSavedAt = currentMs - 24 * 3_600_000 // save is 24h old
      p.lastSavedAt = lastSavedAt
      p.cultivationPerSecond = 12.5 // 10 x 1.25
      p.persistentTimedEffects = [
        tltRecord({
          appliedAtMs: lastSavedAt - 60_000,
          expiresAtMs,
        }),
      ] as never
      const validation = validateGameSaveShape(save)
      expect(validation.ok).toBe(true)
      if (!validation.ok) return null
      const player = usePlayerStore()
      return player.restoreFromSave(validation.normalizedSave as GameSave, {
        kind: 'cold-boot',
        sinceMs: lastSavedAt,
        untilMs: currentMs,
      })
    }

    const honest = build(currentMs - 24 * 3_600_000 + 24 * 3_600_000) // expires = now = lastSavedAt+24h
    const crafted = build(currentMs - 24 * 3_600_000 + 6 * 86_400_000) // expires = +6d

    expect(honest).not.toBeNull()
    expect(crafted).not.toBeNull()
    // Both shapes admitted; the crafted record's bound clamps to
    // lastSavedAt + 24h so the payout cannot exceed the honest claim.
    expect(crafted!.cultivation).toBe(honest!.cultivation)
  })

  // ------------------------------------------------------------------
  // B) Bound ordering under a fast client clock (lastSavedAt > until):
  //    stored bound = until + dur, payout bound = lastSavedAt + dur.
  //    The stored copy must NEVER exceed lastSavedAt + dur (the class
  //    max) - stored looser than payout would be the exploit direction.
  // ------------------------------------------------------------------
  it('fast clock: stored bound stays <= class max while payout pays the payload-epoch bound', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs + 2 * 3_600_000 // client 2h ahead of server
    const expires = lastSavedAt + 23 * 3_600_000 // live claim 23h past marker
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({
        appliedAtMs: lastSavedAt - 3_600_000,
        expiresAtMs: expires,
      }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: currentMs - 60_000,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    // Stored bound: min(expires, until + 24h) = currentMs + 24h - deny
    // direction vs the raw +25h claim, still inside lastSavedAt + 24h.
    expect(stored!.expiresAtMs).toBe(currentMs + 24 * 3_600_000)
    expect(stored!.expiresAtMs).toBeLessThanOrEqual(
      lastSavedAt + 24 * 3_600_000,
    )
  })

  // ------------------------------------------------------------------
  // C) Mixed lanes in one site: a saved head keeps its own client stamp
  //    while seed-rooted heads re-stamp to the field epoch.
  // ------------------------------------------------------------------
  it('mixed site: saved lane head unshifted, seed-rooted heads shifted', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0 + 500_000)
    const saved = makeCycle(LAM, T0 + 150_000, T0 + 250_000) // future saved deadline
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { autoRestart: true, workerCycles: [saved] })],
    ])
    const deps = createDeps(states)

    // nowMs = T0+300k (settle epoch), field-now = T0+500k -> shift 200k.
    settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      T0 + 300_000,
      {
        workerCapacity: 3,
        offlineSinceMs: T0,
        workerAssignments: new Map([[LAM, 3]]),
      },
    )

    const cycles = states.get(LAM)!.workerCycles!
    // 1 saved lane + 2 seeds -> 3 pending heads. The saved head (due
    // T0+250k <= settle-now) pays once, its successor continues the
    // SAVED chain: head at T0+350k keeps the client-epoch stamp
    // unshifted (the documented saved-chain residual - one owed grant
    // settles at the next tick). The two seed-rooted heads (seeded at
    // T0, dues at +100k..+400k) owe 100k remaining at settle -> field
    // T0+600k.
    const completes = cycles.map((c) => c.completesAtMs).sort((a, b) => a - b)
    expect(completes).toEqual([T0 + 350_000, T0 + 600_000, T0 + 600_000])
  })

  // ------------------------------------------------------------------
  // D) Oversubscribed lanes under the jump arm: dying lanes count 1
  //    forfeit each (the head only); the surviving lane counts its whole
  //    skipped tail. Also pins workerCycles convergence to slots.
  // ------------------------------------------------------------------
  it('oversubscribed saved lanes: dead lanes forfeit 1 each, survivor counts skipped tail', () => {
    const dues = [T0 + 50_000, T0 + 60_000, T0 + 70_000] // all past-due vs now
    const states = new Map<string, ProductionSiteState>([
      [
        LAM,
        makeState(LAM, {
          autoRestart: true,
          workerCycles: dues.map((d) => makeCycle(LAM, d - CYCLE_MS, d)),
        }),
      ],
    ])
    const deps = createDeps(states)

    // slots = 1, budget 50k < cycleMs -> the jump arms immediately for
    // every lane; lanes 0/1 die (forfeit 1 each), lane 2 survives and
    // counts skippedDues for its whole chain.
    const result = advanceWorkerLanes({
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
      cycleMs: CYCLE_MS,
      pending: states.get(LAM)!.workerCycles!,
      slots: 1,
      nowMs: T0 + 400_000,
      emptyLaneStartMs: T0,
      advanceMode: 'deadline',
      budgetMs: 50_000,
      rng: () => 0.5,
    })

    // Survivor lane 2: dues at 70k, 170k, 270k, 370k all <= now=400k ->
    // skippedDues = floor((400k - 70k)/100k) + 1 = 4.
    expect(result.forfeited).toBe(1 + 1 + 4)
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.completesAtMs).toBe(T0 + 470_000)
    // The surviving lane is SAVED-rooted -> not in seededPending.
    expect(result.seededPending).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // E) Observe mode flags seeds `seeded` on the RESULT, but seededPending
  //    has no online consumer (only ProductionOffline re-stamps it) - the
  //    mark is classification metadata, not a leak channel.
  // ------------------------------------------------------------------
  it('observe mode: seeds carry the seeded mark but stamps are untouched', () => {
    const result = advanceWorkerLanes({
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
      cycleMs: CYCLE_MS,
      pending: [],
      slots: 2,
      nowMs: T0 + 400_000,
      emptyLaneStartMs: T0 + 400_000,
      advanceMode: 'observe',
      rng: () => 0.5,
    })

    expect(result.pending).toHaveLength(2)
    // Seeds are marked seeded on the result - classification only.
    expect(result.seededPending).toHaveLength(2)
    // Stamps are the raw nowMs-epoch values - the mechanism never shifts.
    for (const cycle of result.pending) {
      expect(cycle.startedAtMs).toBe(T0 + 400_000)
      expect(cycle.completesAtMs).toBe(T0 + 500_000)
    }
  })
})
