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
// cycleMs; once |stamp| is large enough that ulp/2 exceeds the delta
// (~1.2e21 for the probed 100s cycle), the addition FP-absorbs -
// dueMs === startMs and the head cost is 0. A zero-cost completion
// never drains budgetMs and respawns the identical cursor - an
// infinite loop minting free completions in deadline mode (the
// function never returns; the completed array grows to OOM). A
// crafted save carries lastSavedAt = -1e308 (validator pins it finite
// only - saveShapeValidation.ts:2297) -> local restore computes
// elapsed ~1e305s -> offlineSinceMs ~ -1e308 (finite, guard-admitted)
// -> the seed loop hangs every boot.
// r20 adjudication FIXED: the guard now rejects |stamp| >= 2^53 (the
// exact-integer-ms domain edge where any ms-delta can absorb) for
// emptyLaneStartMs AND pending dues, and non-finite slots - repros
// (b)/(c)/(COR-2) are flipped to pin the DENY semantics.
// r21 adjudication (R21-AUT-01/02 + R21-COR-1/2/3, same class):
// admission co-owns the bound - the validator now rejects |stamp| >=
// 2^53 on every persisted timestamp cursor, so repro (a) flips to a
// REJECTION pin (a crafted magnitude marker never reaches restore).
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
  // R20-COR-1(a) - WAS: the reader gate admitted lastSavedAt = -1e308
  // (finite-pinned only, no floor). r21 fix: admission rejects
  // |stamp| >= 2^53 on every persisted timestamp cursor - the crafted
  // marker fails at the gate and never reaches restore (louder deny
  // than the silent per-site freeze it used to cause downstream).
  // --------------------------------------------------------------------
  it('validator rejects lastSavedAt = -1e308 (r21 magnitude pin)', () => {
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
    // REJECTED: |stamp| >= 2^53 is outside the exact-integer-ms domain
    // - no legal writer can produce it (epoch-ms is ~1e12).
    expect(validation.ok).toBe(false)
    expect(
      validation.issues.some((issue) => issue.path === 'player.lastSavedAt'),
    ).toBe(true)

    // r22-INT-01 tightened the admitted bound to |x| < 2^52: a
    // sub-pin marker like -9e15 is now rejected too (still ~2500x
    // beyond any honest epoch stamp).
    const outside = validSave()
    ;(outside.player as PlayerData).lastSavedAt = -9e15
    expect(validateGameSaveShape(outside).ok).toBe(false)

    // Boundary control: a crafted marker INSIDE the admitted domain
    // is still admitted and settles safely (sub-bound magnitudes
    // cannot absorb a ms-delta - ulp/2 < every authored cycleMs at
    // < 2^52, and derivations get ~4.5e15 of headroom before the
    // mechanism's own 2^53 pin).
    const admitted = validSave()
    const admittedPlayer = admitted.player as PlayerData
    admittedPlayer.lastSavedAt = -4e15
    admitted.productionSites = [
      {
        siteId: 'thanh_van_lam',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [],
      },
    ]
    expect(validateGameSaveShape(admitted).ok).toBe(true)
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
    // --pool=threads: a regressed hang would live in a worker THREAD of
    // the spawned vitest process, so the timeout kill (SIGTERM to the
    // process) takes the looping thread down with it - no pkill sweep
    // needed (R22-COR-2: any spec-name pkill pattern can also match a
    // parent vitest cmdline when both spec files are listed together).
    // NODE_OPTIONS caps the child heap so an OOM-class hang dies fast.
    const result = spawnSync(vitestBin, ['run', spec, '--reporter=dot', '--pool=threads'], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: {
        ...process.env,
        R20_SLOTS_HANG_PROBE: '1',
        NODE_OPTIONS: '--max-old-space-size=768',
      },
      timeout: 20_000,
    })

    // PINNED DENY (r20 fix): the fixed guard makes the child exit
    // fast with status 0; a regression that re-opens the hang is
    // still caught - the spawn would be killed by timeout instead.
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
  })
})
