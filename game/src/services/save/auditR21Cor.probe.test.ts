// @vitest-environment node
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { existsSync, rmSync } from 'node:fs'
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
import { DecomposeSystem } from '../../core/production/DecomposeSystem'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'

// BETA SCOPE - only the decompose engine is force-visible for this
// suite (it is scope-hidden in beta and audited as enabled). Every
// other scope keeps its real visibility - workerCycles lane-ceiling
// validation depends on the hidden manualWorkforce baseline.
vi.mock('../../core/betaScope', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../core/betaScope')>()
  return {
    ...original,
    isScopeHidden: (feature: string) =>
      feature === 'equipmentOreDecompose' ? false : original.isScopeHidden(feature),
  }
})

// ============================================================================
// QA repro - fixpoint r21 COR wave (blind audit of commit be30c152, the r20
// adjudication batch).
//
// R21-COR-1 - the widened guard pins |stamp| >= 2^53 on emptyLaneStartMs
//   and pending dues, finiteness on nowMs/slots/budgetMs, and the
//   ordering pin completesAtMs <= startedAtMs. Audit verdicts below.
//
// R21-COR-2 (finding, Low) - nowMs is the ONE guard input checked for
//   finiteness only. The r20 magnitude pins cover the two STAMP inputs
//   but not the observation instant: nowMs >= ~2e20 lets the r17 jump
//   arm (skippedDues division) land the lane in the FP-absorption zone
//   where dueMs + cycleMs === dueMs - headCost 0 completions respawn
//   the identical cursor forever (same COR-1 mechanism, different
//   input). Unreachable through restoreFromSave today (settleNowMs is
//   min-clamped at authorityNowMs ~ Date.now()); the guard's stated
//   purpose is future callers, and every sibling input got a bound.
//   Evidence: the env-gated child probe below is killed by timeout.
//
// R21-COR-3 (finding, Medium-Low) - the validator ADMITS the exact
//   shape the mechanism freezes on: a pending pair with |stamps|
//   >= 2^53 still satisfies the span pin when the span is a multiple
//   of the representable ulp (e.g. started -9.1e15 / completes
//   -9.1e15+100000, span exactly 100000ms). The save loads, then every
//   advanceWorkerLanes call zero-advances: the site produces NOTHING
//   offline AND online (observe mode shares the guard) and no code
//   path ever removes a workerCycles entry - permanent silent freeze.
//   Rejected-by-validator (recovery surface) or per-lane drop would be
//   gentler; preserve-verbatim was the accepted deny direction.
// ============================================================================

const LAM = 'thanh_van_lam'
const QUANG = 'thanh_van_quang'
const REALM = 'mortal'
const T0 = 1_000_000

let currentMs = 1_725_160_000_000

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1

  return {
    cycleId: `r21_cycle_${cycleSeq}`,
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

describe('fixpoint r21 COR - r20 adjudication batch audit probes', () => {
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
  // Boundary evidence: the 2^53 pin is EXACTLY where integer-ms
  // absorption starts (+1 vanishes at 2^53, not below). The real
  // absorb threshold for the authored minimum cycleMs (22000ms,
  // mortal level 9) is ~1.18e21 - the pin errs strictly deny-side on
  // crafted magnitudes while honest stamps (~1.7e12) sit far inside.
  // --------------------------------------------------------------------
  it('ulp table: +1ms absorbs exactly at 2^53; authored cycleMs needs ~1.18e21', () => {
    expect(2 ** 53 + 1).toBe(2 ** 53)
    expect(2 ** 53 - 1 + 1).toBe(2 ** 53)
    expect(2 ** 53 + 100_000).toBe(2 ** 53 + 100_000)

    // Below the pin every integer-ms delta is exact - the guard covers
    // the whole honest integer-ms domain with no honest-shape fallout.
    expect(4_500_000_000_000_000 + 100_000).not.toBe(4_500_000_000_000_000)

    // The absorbing inputs the r20/r21 findings exercise.
    expect(-1e308 + 100_000).toBe(-1e308)
    expect(1e300 + 100_000).toBe(1e300)

    // Threshold where the smallest authored span (22000ms) absorbs:
    // ~1.18e21, far above the 2^53 pin - the pin is conservative, not
    // wrong, for integer-ms arithmetic.
    let probe = 1
    while (probe + 22_000 !== probe) {
      probe *= 2
    }
    expect(probe).toBeGreaterThan(2 ** 53)
  })

  // --------------------------------------------------------------------
  // r18/r19 surface re-verify at tip: per-site isolation - a site whose
  // pending trips the magnitude pin zero-advances verbatim while the
  // sibling site settles normally on the SAME budget.
  // --------------------------------------------------------------------
  it('per-site isolation: a frozen site does not starve or stop sibling settlement', () => {
    // Validator-admitted shape (span-exact at |stamp| >= 2^53).
    const frozen = makeCycle(LAM, -9.1e15, -9.1e15 + 100_000)
    const honest = makeCycle(QUANG, T0 - 100_000, T0)

    const stateA = makeState(LAM, { autoRestart: true, workerCycles: [frozen] })
    const stateB = makeState(QUANG, { autoRestart: true, workerCycles: [honest] })
    const deps = createDeps(
      new Map<string, ProductionSiteState>([
        [LAM, stateA],
        [QUANG, stateB],
      ]),
    )

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      T0,
      { workerCapacity: 2, offlineSinceMs: T0 - 200_000, rng: () => 0.5 },
    )

    // The frozen site preserves its crafted lane verbatim; the honest
    // site still settles its due head and respawns its successor.
    expect(stateA.workerCycles).toEqual([frozen])
    expect(settled).toBe(1)
    expect(stateB.workerCycles?.length).toBe(1)
  })

  // --------------------------------------------------------------------
  // R21-COR-3(a): the seam - validateGameSaveShape ADMITS the crafted
  // pending pair (span-exact multiple of ulp), then BOTH drivers
  // zero-advance it forever. The freeze is total for that site.
  // --------------------------------------------------------------------
  it('validator admits |stamp| >= 2^53 span-exact pending that the mechanism then freezes', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = currentMs - 60_000
    save.productionSites = [
      {
        siteId: LAM,
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [
          {
            cycleId: 'crafted',
            siteId: LAM,
            collectionRealmId: REALM,
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 1,
            startedAtMs: -9.1e15,
            completesAtMs: -9.1e15 + 100_000,
          },
        ],
      },
    ]

    // ADMITTED: ordering pin passes (completes > started), span pin
    // passes (100000 is a multiple of the representable ulp at 9.1e15),
    // startedAtMs <= lastSavedAt passes (deep past is unbounded below).
    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
  })

  it('the admitted shape freezes the site in BOTH drivers, verbatim, forever', () => {
    const crafted = makeCycle(LAM, -9.1e15, -9.1e15 + 100_000)

    const base = {
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [crafted],
      slots: 1,
      nowMs: T0,
      advanceMode: 'deadline' as const,
      budgetMs: 36_000_000,
      rng: () => 0.5,
    }

    // deadline (offline settle): zero-advance, the crafted lane kept.
    const offline = advanceWorkerLanes({ ...base, emptyLaneStartMs: T0 - 200_000 })
    expect(offline.completed).toHaveLength(0)
    expect(offline.pending).toEqual([crafted])
    expect(offline.seededPending).toHaveLength(0)

    // observe (online tickWorkers): same guard, same freeze - the site
    // produces nothing in live play either.
    const online = advanceWorkerLanes({ ...base, advanceMode: 'observe', budgetMs: undefined })
    expect(online.completed).toHaveLength(0)
    expect(online.pending).toEqual([crafted])

    // Persisted verbatim through settleProductionOffline - the same
    // object refs round-trip, so the freeze survives every later save.
    const state = makeState(LAM, { autoRestart: true, workerCycles: [crafted] })
    const deps = createDeps(new Map([[LAM, state]]))
    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      REALM,
      T0,
      { workerCapacity: 1, offlineSinceMs: T0 - 200_000, rng: () => 0.5 },
    )
    expect(settled).toBe(0)
    expect(state.workerCycles).toEqual([crafted])
    expect(state.workerCycles?.[0]).toBe(crafted)
  })

  // --------------------------------------------------------------------
  // Positive control: a pending stamp JUST inside the pin (-4.5e15)
  // keeps integer-ms arithmetic exact - the lane drains the cap
  // (360 completions at 100_000ms each), the jump arm then skips the
  // deep-past tail in O(1). The pin line itself is not the wall; the
  // budget + jump are. This is the class the magnitude pins only
  // tightened - bounded settle already held below 2^53.
  // --------------------------------------------------------------------
  it('pending just inside 2^53 settles bounded: 360 grants then O(1) jump', () => {
    const saved = makeCycle(LAM, -4.5e15, -4.5e15 + 100_000)

    const result = advanceWorkerLanes({
      siteId: LAM,
      collectionRealmId: REALM,
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [saved],
      slots: 1,
      nowMs: T0,
      emptyLaneStartMs: undefined,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
      rng: () => 0.5,
    })

    expect(result.completed).toHaveLength(360)
    expect(result.consumedBudgetMs).toBe(36_000_000)
    expect(result.forfeited).toBeGreaterThan(0)
  })

  // --------------------------------------------------------------------
  // R21-COR-2: nowMs has no magnitude pin - the same absorbing
  // free-grant loop as COR-1, reached through the jump arm landing in
  // the absorption zone. Unreachable via saves (settleNowMs clamps at
  // authorityNowMs); mechanism-level evidence via child process.
  // --------------------------------------------------------------------
  it('nowMs = 1e300 hangs the deadline loop (child-process probe)', { timeout: 60_000 }, () => {
    const spec = fileURLToPath(new URL('./auditR21CorNowMsHang.probe.test.ts', import.meta.url))
    const vitestBin = fileURLToPath(new URL('../../../node_modules/.bin/vitest', import.meta.url))
    const marker = fileURLToPath(new URL('./.r21-hang-armed', import.meta.url))
    try {
      rmSync(marker, { force: true })
    } catch {
      // marker cleanup is best-effort
    }
    try {
      // --pool=threads: the hang then lives in a worker THREAD of the
      // spawned vitest process, so the timeout kill (SIGTERM to the
      // process) takes the looping thread down with it. With the
      // default forks pool the timeout kills only the parent vitest
      // and leaves the worker fork orphaned, still looping.
      // NODE_OPTIONS caps the child heap: the unbounded completed.push
      // OOMs in a few seconds instead of growing ~200MB/s for the
      // whole timeout window (observed ~4.4GB at kill).
      const result = spawnSync(vitestBin, ['run', spec, '--reporter=dot', '--pool=threads'], {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: {
          ...process.env,
          R21_NOWMS_HANG_PROBE: '1',
          R21_HANG_MARKER_FILE: marker,
          NODE_OPTIONS: '--max-old-space-size=768',
        },
        timeout: 25_000,
      })

      // DEFECT PRESENT (r21 audit): the child arms the probe marker
      // (proves it reached the hanging call, not a startup crash) and
      // never completes the spec - it is killed by timeout or dies on
      // the heap cap (status null + SIGTERM, wrapper exit 143, or an
      // OOM exit code). Once nowMs gets a magnitude pin this flips to
      // status 0, same regression-detection shape as the r20 probe.
      expect(existsSync(marker)).toBe(true)
      expect(result.status).not.toBe(0)
    } finally {
      // No pkill by spec-name pattern: with --pool=threads the timeout
      // kill already takes down the looping worker thread, and a -f
      // match on the spec filename would also hit THIS run's own
      // vitest cmdline whenever both spec files are listed together.
      try {
        rmSync(marker, { force: true })
      } catch {
        // marker cleanup is best-effort
      }
    }
  })

  // --------------------------------------------------------------------
  // Sibling sweep - DecomposeSystem.settleOffline shares the
  // `stamp += cycle` fast-forward shape. Absorption cannot arm (the
  // loop only runs below ~nowMs where ulp << cycleMs), but the r12-INT
  // bound caps only the loop END: a validator-admitted restore of
  // {started:true, nextCycleAt:0} still walks ~57M no-op iterations
  // from 0 to nowMs on every boot. Finite stall, crafted-only.
  // --------------------------------------------------------------------
  it('decompose fast-forward: restored nextCycleAt=0 walks ~57M no-op iterations', () => {
    const system = new DecomposeSystem(new MaterialBag(), { cycleSeconds: 30 })
    system.updateCapacity(1)
    // Validator admits this exact payload (nextCycleAt is
    // non-negative-finite-pinned only; started is boolean).
    system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 1 },
      nextCycleAt: 0,
      started: true,
    })

    const started = performance.now()
    const settled = system.settleOffline(currentMs, currentMs - 60_000)
    const elapsed = performance.now() - started

    // Returns (finite) - the fast-forward is ~1.7e12/30000 ~ 5.7e7
    // plain += iterations, not an unbounded hang. The settle phase is
    // separately capped at 5000 (settled counts cycles whose deadline
    // fell inside the window - a handful here). Elapsed is measured
    // for the report; no hard timing assertion (machine-dependent).
    expect(Number.isInteger(settled)).toBe(true)
    expect(settled).toBeLessThanOrEqual(5000)
    expect(Number.isFinite(elapsed)).toBe(true)
  })
})
