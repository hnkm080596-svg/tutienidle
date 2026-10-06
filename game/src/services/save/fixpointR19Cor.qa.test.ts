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
import { settleProductionOffline } from '../../core/production/ProductionOffline'
import type { ProductionOfflineDeps } from '../../core/production/ProductionOffline'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'
import type {
  ProductionCycle,
  ProductionSiteDefinition,
  ProductionSiteState,
} from '../../core/production/ProductionTypes'
import { MaterialBag } from '../../core/material/MaterialBag'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import type { GameSave } from './SaveSystem'

// ============================================================================
// QA repro - fixpoint r19 COR wave (blind audit of commit 8f60f30c, the r18
// adjudication batch).
//
// R19-COR-1 (Low) - the dead arm `expires <= lastSavedAt ->
// min(authorityNow, Date.now())` of boundTimedEffectClocks (player.ts:135-144)
// treats a record as dead purely by comparing its stamp to the SAVE MARKER.
// That comparison is epoch-consistent only when the record's stamps and the
// marker share one clock epoch. An honest payload can carry them in
// different epochs: the record was written while the device clock was
// correct, the clock then stepped forward before the save write (manual
// set / RTC correction / drift), and corrected again before this restore.
// The record is honestly live on the field clock (expires > Date.now())
// yet reads dead-in-marker-epoch (expires <= lastSavedAt), so the dead arm
// clamps the stored expiry to now and the buff dies at boot - losing up to
// its whole remaining duration (bounded by TU_LINH_TRAN_DURATION_MS).
// Deny direction only; the identical crafted payload (forged future
// marker + forged mid-window expires) is indistinguishable.
//
// ADJUDICATED r19: ACCEPTED RESIDUAL - every relaxation that preserves
// the honest flipped-epoch case admits a deterministic mint of
// equal-or-greater size (a forged future marker + expires in (now,
// marker] revives a buff, minting up to marker+dur of fake live time
// stored raw). The honest loss needs a rare sequence (clock step
// forward past the buff's own expiry, then correction before restore)
// and is bounded <= the record's remaining duration, once per boot,
// deny-direction. The two repros below pin the DENY behavior so a
// future regression that re-opens the mint fails the suite.
//
// The rest of this file is verification pins for the r18 surface that
// came out CLEAN: the jump arm's forfeit parity, the seeded chain-root
// flag through jump reinserts, and the all-seeded re-stamp in
// ProductionOffline (seed-rooted heads shift; saved-chain heads do not -
// the COR-D1 regression class).
// ============================================================================

let currentMs = 1_725_160_000_000

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

let cycleSeq = 0

function makeCycle(siteId: string, startedAtMs: number, completesAtMs: number): ProductionCycle {
  cycleSeq += 1

  return {
    cycleId: `test_cycle_${cycleSeq}`,
    siteId,
    collectionRealmId: 'mortal',
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

describe('fixpoint r19 COR - r18 adjudication batch repros', () => {
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
  // R19-COR-1(a): validator admits the flipped-epoch record, the restore
  // map stores it dead. Honest timeline: buff bought at now-10h while the
  // clock was synced; the clock stepped +30d before the save write
  // (lastSavedAt = now+30d); the clock corrected before this restore
  // (Date.now() = now). expires = now+14h is honestly live yet
  // expires <= lastSavedAt routes to the dead arm -> stored = now.
  // --------------------------------------------------------------------
  it('epoch-flip honest TLT record: admitted by the validator, stored dead at restore (accepted residual)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs + 30 * 86_400_000
    const appliedAtMs = currentMs - 10 * 3_600_000
    const expiresAtMs = currentMs + 14 * 3_600_000
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5 // honest buffed snapshot at save time
    p.persistentTimedEffects = [tltRecord({ appliedAtMs, expiresAtMs })] as never

    const validation = validateGameSaveShape(save)
    // Admitted: appliedAt <= lastSavedAt and expires <=
    // lastSavedAt + 24h + 7d both hold (the buffed cps claim is
    // normalized down to BASE by the same epoch comparison, but the
    // save itself passes).
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
    // PINNED DENY (accepted residual, R19-COR-1): stored expiry =
    // currentMs - the dead arm's min(authorityNow, Date.now()) clamp.
    // The honest 14h tail is unprovable: the identical crafted payload
    // (forged future marker + mid expires) would mint a live buff if
    // this arm admitted future stamps, so the record stays dead.
    expect(stored!.expiresAtMs).toBe(currentMs)
  })

  // --------------------------------------------------------------------
  // R19-COR-1(b): the same record through the cold-boot offline payout -
  // the payout keeps raw dead-position stamps for expires <=
  // lastSavedAt, so the window [lastSavedAt, lastSavedAt + elapsed]
  // sits entirely AFTER the record's stamp: the honestly-buffed real
  // interval pays flat. The normalized cps (12.5 -> 10 under the same
  // marker-epoch probe) additionally erases the buffed snapshot.
  // --------------------------------------------------------------------
  it('epoch-flip honest TLT record: cold-boot payout pays flat for the honestly-buffed window (accepted residual)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs + 30 * 86_400_000
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({
        appliedAtMs: currentMs - 10 * 3_600_000,
        expiresAtMs: currentMs + 14 * 3_600_000,
      }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    const result = player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: currentMs - 120_000,
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(120)
    // PINNED DENY (accepted residual, R19-COR-1): validator probe
    // normalizes cps to 10 AND the record reads dead at every window
    // position -> 120 x 10 = 1200. The honestly-buffed 1500 is
    // unprovable - the payload window itself sits 30d in the forged
    // marker's epoch, past the record's own stamp.
    expect(result.cultivation).toBe(1200)
  })

  // --------------------------------------------------------------------
  // Verification pin - the r18-COR-2 widened jump arm fires on a
  // leftover in (0, cycleMs): 360 completions consume 36_000_000 of a
  // 36_050_000 budget; the remaining dues forfeit via the O(1) jump and
  // the jumped lane's pending head keeps its chain-root `seeded` flag.
  // --------------------------------------------------------------------
  it('jump arm at leftover < cycleMs: bounded iteration, jumped head stays seeded', () => {
    const result = advanceWorkerLanes({
      siteId: 'audit_lane',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: 1,
      nowMs: 100_000_000,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 36_050_000,
      rng: () => 0.5,
    })

    // dues at (k+1)*100k: 360 complete (36.0M spent, leftover 50k).
    // Next due 36.1M: cost 100k > 50k and cycleMs 100k > 50k -> jump.
    // skippedDues = floor((100M - 36.1M)/100k)+1 = 640; lastDue =
    // 36.1M + 639*100k = 100M <= nowMs; pending head at 100.1M.
    expect(result.completed).toHaveLength(360)
    expect(result.forfeited).toBe(640)
    expect(result.consumedBudgetMs).toBe(36_000_000)
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.startedAtMs).toBe(100_000_000)
    expect(result.pending[0]!.completesAtMs).toBe(100_100_000)
    // The jumped chain's pending head must stay seed-rooted so the
    // persister re-stamps it into the field epoch.
    expect(result.seededPending).toHaveLength(1)
    expect(result.seededPending[0]).toBe(result.pending[0])
  })

  // --------------------------------------------------------------------
  // Verification pin - r18-COR-3 fix: an oversubscribed lane (more lanes
  // than slots) dies on its head due with forfeited += 1 - the walk
  // would process exactly one forfeit before the respawn check kills
  // the lane. The r17 unconditional `forfeited += skippedDues` counted
  // the whole remaining chain.
  // --------------------------------------------------------------------
  it('oversubscribed lane dies at +1 forfeit, not +skippedDues', () => {
    const saved1 = makeCycle('audit_lane', 0, 50_000)
    const saved2 = makeCycle('audit_lane', 0, 60_000)
    const result = advanceWorkerLanes({
      siteId: 'audit_lane',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [saved1, saved2],
      slots: 0,
      nowMs: 1_000_000_000,
      advanceMode: 'deadline',
      budgetMs: 0,
      rng: () => 0.5,
    })

    expect(result.completed).toHaveLength(0)
    // Each lane's head due forfeits once; the slot check (inFlight >=
    // slots = 0) kills both chains - no dues beyond the heads count.
    expect(result.forfeited).toBe(2)
    expect(result.pending).toHaveLength(0)
    // Saved lanes never carry the seed-root flag.
    expect(result.seededPending).toHaveLength(0)
  })

  // --------------------------------------------------------------------
  // Verification pin - the r18-COR-4 re-stamp: seed-rooted pending heads
  // shift by max(0, Date.now() - nowMs) regardless of the window anchor,
  // while a SAVED lane's spawned successor keeps its own deadline
  // (COR-D1 regression class). settle at nowMs = 800_000 under a field
  // clock of 1_000_000 -> shift +200_000.
  //   saved lane: head [350k, 450k] completes; chain walks 450k,550k,
  //     650k,750k -> pending head [750k, 850k], never seed-rooted.
  //   seed lane: seeded at 400k; dues 500k..800k complete -> pending
  //     head [800k, 900k] -> shifted to [1.0M, 1.1M].
  // --------------------------------------------------------------------
  it('re-stamp shifts the seed-rooted head +200s and leaves the saved-chain head raw', () => {
    // Field clock pinned at the synthetic timeline origin (same
    // convention as ProductionOffline.test.ts) so the settle lands
    // +200_000 behind Date.now().
    vi.mocked(Date.now).mockReturnValue(1_000_000)
    const state = makeState('thanh_van_lam', {
      autoRestart: true,
      workerCycles: [makeCycle('thanh_van_lam', 350_000, 450_000)],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      800_000,
      { workerCapacity: 2, offlineSinceMs: 400_000, rng: () => 0.5 },
    )

    expect(settled).toBe(8) // 4 saved-chain + 4 seeded dues
    const cycles = state.workerCycles ?? []
    expect(cycles).toHaveLength(2)
    const savedChain = cycles.find((c) => c.startedAtMs === 750_000)
    const seeded = cycles.find((c) => c.startedAtMs === 1_000_000)
    expect(savedChain).toBeDefined()
    expect(savedChain!.completesAtMs).toBe(850_000) // unshifted
    expect(seeded).toBeDefined()
    expect(seeded!.completesAtMs).toBe(1_100_000) // 900k + 200k shift
  })

  // --------------------------------------------------------------------
  // Verification pin - the dead arm keeps honestly-dead stamps intact
  // (dead-in-marker-epoch AND dead on the field clock): a record whose
  // expiry lies below BOTH epochs' now is stored raw - only the live-
  // reading subset is clamped. Companion check to R19-COR-1.
  // --------------------------------------------------------------------
  it('dead arm keeps an honestly-dead record untouched', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs - 60_000
    const expiresAtMs = lastSavedAt - 3_600_000 // dead 1h before the save
    p.lastSavedAt = lastSavedAt
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: expiresAtMs - 86_400_000, expiresAtMs }),
    ] as never

    const player = usePlayerStore()
    player.restoreFromSave(save as unknown as GameSave)

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    expect(stored!.expiresAtMs).toBe(expiresAtMs)
  })
})
