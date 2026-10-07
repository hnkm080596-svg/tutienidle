// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  settleProductionOffline,
  type ProductionOfflineDeps,
} from '../../core/production/ProductionOffline'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '../../core/production/ProductionBalance'
import type {
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'
import {
  THANH_VAN_PRODUCTION_SITES,
} from '../../core/production/ProductionCatalog'

// ============================================================================
// QA probe - fixpoint r22 INT wave (audit of commit bf3b44a1, the r21
// batch: isBoundedTimestamp on every persisted timestamp cursor).
//
//   A) gate -> derived -> mechanism composition edge (finding
//      QA-2026-10-05-r22-int-01 - FIXED): the outermost r21-admitted
//      marker lastSavedAt = -(2^53 - 1) derived |offlineSinceMs|
//      exactly -2^53 through the /1000*1000 float64 round-trip,
//      tripping the mechanism guard -> lanes froze verbatim every
//      boot. r22 fix: the admitted bound tightened to |x| < 2^52 - a
//      ~4.5e15 headroom band between admitted stamps and the 2^53
//      mechanism pin, so no derivation can drift onto it. The marker
//      now dies at the gate; the derivation + guard facts are kept
//      as mechanism-level pins.
//   B) positive control: the outermost admitted marker under the new
//      bound (lastSavedAt = -(2^52 - 1)) derives an in-domain window
//      start and the lane settles normally.
//   C) the mechanism guard itself is unit-agnostic and unchanged:
//      an already-derived |emptyLaneStartMs| >= 2^53 still zero-advances
//      verbatim (defense-in-depth holds for non-save feeds).
// ============================================================================

const REALM = 'mortal'
const LAM = 'thanh_van_lam'
const CYCLE_MS = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM[REALM]!, 1) * 1000

function makeState(
  siteId: string,
  overrides: Partial<ProductionSiteState> = {},
): ProductionSiteState {
  return {
    siteId,
    level: 1,
    autoRestart: true,
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

// The exact arithmetic GameManagerSaveRestore.ts:426-429 performs on
// the payload marker (uncapped elapsed, authority-anchored end).
function deriveOfflineSinceMs(lastSavedAt: number, authorityNowMs: number): number {
  const elapsedOfflineSeconds = (authorityNowMs - lastSavedAt) / 1000
  return Math.min(lastSavedAt, authorityNowMs - elapsedOfflineSeconds * 1000)
}

describe('fixpoint r22 INT - timestamp pin integration probes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('boundary marker -(2^53 - 1) rejected at gate (r22 fix); the derivation fact is documented arithmetic', () => {
    const authorityNowMs = 1_760_000_000_000

    // r22-INT-01 + COR-1: the admitted bound tightened to |x| < 2^52,
    // so the outermost r21-admitted marker now dies at the gate -
    // the derived-cursor wedge path below is unreachable via saves.
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = -(2 ** 53 - 1)
    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(false)

    // The derivation fact that motivated the fix stands: the float64
    // seconds round-trip lands exactly on -2^53 for that marker - any
    // admitted stamp had to stay one honest-epoch clear of the pin,
    // which is why the bound dropped to 2^52 and not 2^53 - epsilon.
    const offlineSinceMs = deriveOfflineSinceMs(p.lastSavedAt, authorityNowMs)
    expect(offlineSinceMs).toBe(-(2 ** 53))

    // Mechanism-level (non-save feed): the derived feed still trips
    // the guard - zero-advance, lanes preserved verbatim.
    const result = advanceWorkerLanes({
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
      cycleMs: CYCLE_MS,
      pending: [],
      slots: 2,
      nowMs: authorityNowMs,
      emptyLaneStartMs: offlineSinceMs,
      advanceMode: 'deadline',
      budgetMs: 8_640_000,
      rng: () => 0.5,
    })
    expect(result.completed).toHaveLength(0)
    expect(result.seededPending).toHaveLength(0)
    expect(result.consumedBudgetMs).toBe(0)
  })

  it('outermost admitted marker -(2^52 - 1) derives an in-domain window and settles', () => {
    const authorityNowMs = 1_760_000_000_000
    const lastSavedAt = -(2 ** 52 - 1)

    // Gate: the deepest admitted marker still passes.
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = lastSavedAt
    expect(validateGameSaveShape(save).ok).toBe(true)

    const offlineSinceMs = deriveOfflineSinceMs(lastSavedAt, authorityNowMs)
    expect(Math.abs(offlineSinceMs)).toBeLessThan(2 ** 53)

    const result = advanceWorkerLanes({
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM[REALM]!,
      cycleMs: CYCLE_MS,
      pending: [],
      slots: 1,
      nowMs: authorityNowMs,
      emptyLaneStartMs: offlineSinceMs,
      advanceMode: 'deadline',
      budgetMs: CYCLE_MS * 2,
      rng: () => 0.5,
    })
    // r31-WIN-ASYM: the derived window start is negative (marker
    // -(2^52-1) < 0) so the feed now denies verbatim - the lane
    // parks instead of walking. Deny-lean: a forged negative marker
    // yields zero offline accrual, never a mint.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(0)
    expect(result.seededPending).toHaveLength(0)
    expect(result.consumedBudgetMs).toBe(0)
  })

  it('mechanism guard: a direct |emptyLaneStartMs| >= 2^53 feed still zero-advances verbatim', () => {
    const pendingStamp = 1_000_000
    const pending = {
      cycleId: 'r22_probe_1',
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevelAtStart: 1,
      rewardTableVersion: 1,
      rollSeed: 1,
      startedAtMs: pendingStamp,
      completesAtMs: pendingStamp + CYCLE_MS,
    }
    const states = new Map<string, ProductionSiteState>([
      [LAM, makeState(LAM, { workerCycles: [pending] })],
    ])
    const deps = createDeps(states)

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      pendingStamp + 400_000,
      { workerCapacity: 2, offlineSinceMs: -(2 ** 53) },
    )
    expect(settled).toBe(0)
    // Lanes preserved verbatim through the wedge.
    expect(states.get(LAM)!.workerCycles![0]).toBe(pending)
  })
})
