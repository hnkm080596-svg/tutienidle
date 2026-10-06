// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

declare const process: { env: Record<string, string | undefined> }
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import type { ProductionOfflineDeps } from '../../core/production/ProductionOffline'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import { calculateOfflineTime } from '../../core/idle/GameClock'
import type {
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'

// ============================================================================
// QA repro - fixpoint r20 COR wave (blind audit of commit 060826af, the r19
// adjudication batch).
//
// R20-COR-1 - WAS: the r19 non-finite guard checked FINITENESS only,
// not MAGNITUDE. The seed arm computes dueMs = emptyLaneStartMs +
// cycleMs; for |emptyLaneStartMs| >= ~1e21 the addition FP-absorbs
// (ulp at 1e21 is 131072 > every authored cycleMs), so dueMs ===
// startMs and the head cost is 0. A zero-cost completion never drains
// budgetMs and respawns the identical cursor - an infinite loop
// minting free completions in deadline mode (the function never
// returns; the completed array grows to OOM). A crafted save carries
// lastSavedAt = -1e308 (validator pins it finite only -
// saveShapeValidation.ts:2297) -> local restore computes elapsed
// ~1e305s -> offlineSinceMs ~ -1e308 (finite, guard-admitted) -> the
// seed loop hangs every boot.
// r20 adjudication FIXED: the guard now rejects |stamp| >= 2^53 (the
// exact-integer-ms domain edge where any ms-delta can absorb) for
// emptyLaneStartMs AND pending dues, and non-finite slots - repros
// (b)/(c)/(COR-2) are flipped to pin the DENY semantics; (a) still
// documents the validator's admitted shape (the mechanism, not the
// marker, now owns the bound).
//
// R20-COR-2 - WAS: slots = +Infinity makes `count < slots` in the
// seed loop always true -> infinite push loop (OOM). FIXED in the
// same guard (non-finite slots rejected); the child-process probe
// now asserts the call returns instead of timing out.
// ============================================================================

let currentMs = 1_725_160_000_000

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

describe('fixpoint r20 COR - r19 adjudication batch repros', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------
  // R20-COR-1(a): the reader gate admits lastSavedAt = -1e308. The only
  // pin on the field is isFiniteNumber (saveShapeValidation.ts:2297) -
  // no epoch sanity floor exists anywhere in the pipeline.
  // --------------------------------------------------------------------
  it('validator admits lastSavedAt = -1e308 (finite-pinned only, no floor)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = -1e308
    save.productionSites = [
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [],
      },
    ]

    const validation = validateGameSaveShape(save)
    // ADMITTED: every lastSavedAt-relative pin bounds OTHER fields
    // against the marker; nothing bounds the marker's own magnitude.
    expect(validation.ok).toBe(true)
    if (validation.ok) {
      expect((validation.normalizedSave as { player: PlayerData }).player.lastSavedAt).toBe(-1e308)
    }
  })

  // --------------------------------------------------------------------
  // R20-COR-1(b): the admitted marker derives a finite
  // emptyLaneStartMs ~ -1e308 (guard passes it), the seed due
  // FP-collapses onto the start (ulp > cycleMs), headCostMs = 0 ->
  // every iteration completes at cost 0 (budget never drains, jump arm
  // never arms) and respawns the identical cursor. The rng stream is
  // the completion counter: >2000 proofs of a still-running loop.
  // --------------------------------------------------------------------
  it('crafted lastSavedAt -> finite -1e308 seed start -> zero-advance, settle returns (r20 fix)', () => {
    // Same window derivation as GameManagerSaveRestore.restoreFromSave
    // (local restore arm: uncapped +Infinity max).
    const lastSavedAt = -1e308
    const elapsedSeconds = calculateOfflineTime(
      { lastOnlineAt: lastSavedAt },
      currentMs,
      Number.POSITIVE_INFINITY,
    ).offlineSeconds
    const settleNowMs = Math.min(lastSavedAt + elapsedSeconds * 1000, currentMs)
    const offlineSinceMs = Math.min(lastSavedAt, currentMs - elapsedSeconds * 1000)

    // The derived seed start is FINITE - but now exceeds the
    // exact-integer domain, so the magnitude pin trips it.
    expect(Number.isFinite(offlineSinceMs)).toBe(true)
    expect(offlineSinceMs).toBeLessThan(-1e20)

    let completions = 0
    const rng = () => {
      completions += 1
      if (completions > 2000) {
        throw new Error(`STILL_LOOPING after ${completions} free completions`)
      }
      return 0.5
    }
    const state = makeState('thanh_van_lam', { autoRestart: true })
    const deps = createDeps(new Map([[state.siteId, state]]))

    // PINNED DENY (r20 fix): the settle returns normally - the site
    // zero-advances, no rng ever runs, the boot is no longer wedged.
    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      settleNowMs,
      { workerCapacity: 1, offlineSinceMs, rng },
    )
    expect(settled).toBe(0)
    expect(completions).toBe(0)
  })

  // --------------------------------------------------------------------
  // R20-COR-1(c): same class through advanceWorkerLanes directly - a
  // finite emptyLaneStartMs in the FP-absorption zone hangs the seed
  // loop even with a finite budget and a single lane. Deny-side check:
  // a non-finite seed start zero-advances (the r19 guard as designed).
  // --------------------------------------------------------------------
  it('advanceWorkerLanes: absorbing-magnitude and non-finite starts both zero-advance (r20 fix)', () => {
    const base = {
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: 1,
      nowMs: currentMs,
      advanceMode: 'deadline' as const,
      budgetMs: 36_000_000,
    }

    let completions = 0
    const rng = () => {
      completions += 1
      return 0.5
    }
    // PINNED DENY (r20 fix): -1e308 is inside the magnitude pin ->
    // zero-advance, rng untouched, the loop that used to mint free
    // completions forever is unreachable.
    const absorbed = advanceWorkerLanes({ ...base, emptyLaneStartMs: -1e308, rng })
    expect(absorbed.completed).toHaveLength(0)
    expect(absorbed.pending).toHaveLength(0)
    expect(completions).toBe(0)

    const guarded = advanceWorkerLanes({ ...base, emptyLaneStartMs: Number.NaN })
    expect(guarded.completed).toHaveLength(0)
    expect(guarded.pending).toHaveLength(0)
  })

  // --------------------------------------------------------------------
  // R20-COR-2: slots = +Infinity hangs the seed `for` loop
  // (count < Infinity is always true). The hang cannot run in-process
  // (a sync loop cannot be raced), so the probe spawns a child vitest
  // on the env-gated spec below and asserts the child is killed by
  // timeout. If a fix ever makes it return, the child exits and this
  // pin fails - regression detection on both directions.
  // --------------------------------------------------------------------
  it('slots = +Infinity returns normally (child-process probe, r20 fix)', { timeout: 45_000 }, () => {
    const spec = fileURLToPath(new URL('./fixpointR20CorSlotsHang.probe.test.ts', import.meta.url))
    const vitestBin = fileURLToPath(new URL('../../../node_modules/.bin/vitest', import.meta.url))
    try {
      const result = spawnSync(vitestBin, ['run', spec, '--reporter=dot'], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: { ...process.env, R20_SLOTS_HANG_PROBE: '1' },
        timeout: 20_000,
      })

      // PINNED DENY (r20 fix): the fixed guard makes the child exit
      // fast with status 0; a regression that re-opens the hang is
      // still caught - the spawn would be killed by timeout instead.
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(0)
    } finally {
      // Sweep any vitest worker that outlived the timeout kill.
      spawnSync('pkill', ['-f', 'fixpointR20CorSlotsHang'], { timeout: 5_000 })
    }
  })
})
