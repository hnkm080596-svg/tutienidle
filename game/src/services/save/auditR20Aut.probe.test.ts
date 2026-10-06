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
import { TECHNIQUES } from '../../data/technique/Techniques'
import type { GameSave } from './SaveSystem'

// F-REALM-1: a realm witness must carry an authored technique object.
function fiveElementsTechnique() {
  return structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
}

// The pill writer's exact regen modifier shape (PillSystem.ts):
// flat + domain:spell + pill provenance ids.
function regenModifier(pillId: string, flat: number) {
  return {
    id: `pill-regen-mp:${pillId}`,
    sourceId: pillId,
    sourceType: 'pill',
    stat: 'manaRegenPerTurn',
    flat,
    domain: 'spell',
  }
}

// ============================================================================
// QA repro - fixpoint r20 AUT wave (blind audit of commit 060826af, the
// r19 adjudication batch).
//
// Surface map at this tip:
//  A. WorkerLaneAdvance widened guard (WorkerLaneAdvance.ts:123-138) -
//     reachability of a non-finite pending stamp through any save feed,
//     plus the early return's preserve-then-persist semantics.
//  B. TLT bounds re-verified (unchanged since r18) - boundary classes:
//     expires == lastSavedAt, expires == lastSavedAt + 1, non-finite
//     marker/stamp probes, percent edge probes (-0, 0.25, 0.25+eps).
//  C. seededPending re-stamp - whether any crafted nowMs window can land
//     a seeded head early in the field epoch, or buy free time.
//  D. R19-COR-1 flipped deny pins - whether a crafted save still mints
//     via the epoch-flip shape, and whether any read path pays the RAW
//     expires past the stored clamp.
//
// Seam-level reachability runs through validateGameSaveShape +
// player.restoreFromSave. Mechanism-level repros exercise
// advanceWorkerLanes / settleProductionOffline directly to document
// exactly what the guard covers (and the residue it does not) should a
// feed ever bypass the shape gate.
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

const FOREST = THANH_VAN_PRODUCTION_SITES[0]!.siteId

describe('fixpoint r20 AUT - r19 adjudication batch repros', () => {
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
  // A1 (surface 1) - preserve-then-persist leak: when the widened guard
  // trips, settleProductionOffline re-persists `result.pending` verbatim
  // into state.workerCycles (ProductionOffline.ts:186-194). A crafted
  // NaN-stamped pending entry would be re-saved verbatim - AND the whole
  // early return freezes every honest sibling lane (its due was past).
  // Mechanism-level repro: the shape gate rejects this array upstream
  // (A3 pins that), so this documents defense-in-depth semantics, not a
  // live seam.
  // --------------------------------------------------------------------
  it('A1 guard trip re-persists the crafted pending verbatim and freezes the honest lane', () => {
    const honest = makeCycle(FOREST, 100_000, 200_000)
    const crafted: ProductionCycle = {
      ...makeCycle(FOREST, 300_000, 400_000),
      completesAtMs: Number.NaN,
    }
    const state = makeState(FOREST, {
      autoRestart: true,
      workerCycles: [honest, crafted],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      900_000,
      { workerCapacity: 3, offlineSinceMs: 500_000, rng: () => 0.5 },
    )

    // The honest head was due at 200_000 << settleNow - without the
    // crafted sibling it would have settled plus respawned; the guard's
    // zero-advance early return freezes it.
    expect(settled).toBe(0)
    // Preserve-then-persist: the crafted record survives verbatim into
    // the re-persisted state (a NaN stamp would be re-saved).
    const persisted = state.workerCycles ?? []
    expect(persisted).toHaveLength(2)
    expect(persisted[1]!.cycleId).toBe(crafted.cycleId)
    expect(Number.isNaN(persisted[1]!.completesAtMs)).toBe(true)
    expect(persisted[0]!.cycleId).toBe(honest.cycleId)
  })

  // --------------------------------------------------------------------
  // A2 (surface 1) - was: the widened guard checked FINITENESS only. A
  // finite reversed-span record (startedAtMs > completesAtMs) used to
  // pass it: the walk computes headCostMs = max(0, due - start) = 0,
  // grants the saved cycle, and respawns from `due` - so a crafted head
  // completed at ZERO budget cost (one free grant per crafted entry).
  // r20 adjudication FIXED: the guard now also rejects
  // completesAtMs <= startedAtMs, mirroring the validator's F-A11-4
  // ordering pin - this test pins the DENY semantics.
  // --------------------------------------------------------------------
  it('A2 finite reversed-span pending trips the ordering guard - zero-advance (r20 fix)', () => {
    const crafted = makeCycle('audit_lane', 100_000, 50_000)
    const result = advanceWorkerLanes({
      siteId: 'audit_lane',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [crafted],
      slots: 1,
      nowMs: 1_000_000,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 10_000_000,
      rng: () => 0.5,
    })

    // PINNED DENY (r20 fix): zero-advance - no free grant, no budget
    // consumed, the crafted entry preserved verbatim for re-persist.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toEqual([crafted])
    expect(result.consumedBudgetMs).toBe(0)
    expect(result.forfeited).toBe(0)
  })

  // --------------------------------------------------------------------
  // A3 (surface 1) - seam-level reachability: every crafted workerCycles
  // shape that could reach the guard is rejected by
  // validateGameSaveShape before any restore/settle runs. All feeds
  // (LocalCloudSaveService.load/inspectLocalSave, Supabase load/import,
  // recoveryApi, useAppLifecycle boot) gate on the validator.
  // --------------------------------------------------------------------
  it('A3 validator rejects every pending shape that could reach the guard', () => {
    const siteEntry = {
      siteId: FOREST,
      level: 1,
      autoRestart: true,
      workerCycles: [makeCycle(FOREST, 100_000, 200_000)],
    }

    const variants: Array<[string, unknown]> = [
      ['completesAtMs null', { ...siteEntry, workerCycles: [{ ...siteEntry.workerCycles[0], completesAtMs: null }] }],
      ['completesAtMs string', { ...siteEntry, workerCycles: [{ ...siteEntry.workerCycles[0], completesAtMs: 'x' }] }],
      ['startedAtMs missing', { ...siteEntry, workerCycles: [{ cycleId: 'c', siteId: FOREST, collectionRealmId: 'mortal', siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 1, completesAtMs: 200_000 }] }],
      ['reversed span', { ...siteEntry, workerCycles: [{ ...siteEntry.workerCycles[0], startedAtMs: 200_000, completesAtMs: 100_000 }] }],
      ['span mismatch', { ...siteEntry, workerCycles: [{ ...siteEntry.workerCycles[0], completesAtMs: 250_000 }] }],
      ['non-object entry', { ...siteEntry, workerCycles: [null] }],
    ]

    for (const [label, site] of variants) {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = currentMs - 60_000
      save.productionSites = [site]
      const validation = validateGameSaveShape(save)
      expect(validation.ok, `variant should be rejected: ${label}`).toBe(false)
    }
  })

  // --------------------------------------------------------------------
  // A4 (surface 1) - a non-object pending entry reaches `cycle.completesAtMs`
  // inside the guard predicate and throws; through restoreGameSession the
  // throw aborts the restore (deny), never mints.
  // --------------------------------------------------------------------
  it('A4 non-object pending entry throws inside the guard (deny, no mint)', () => {
    expect(() =>
      advanceWorkerLanes({
        siteId: 'audit_lane',
        collectionRealmId: 'mortal',
        siteLevel: 1,
        baseSeconds: 100,
        cycleMs: 100_000,
        pending: [null as unknown as ProductionCycle],
        slots: 1,
        nowMs: 1_000_000,
        emptyLaneStartMs: 0,
        advanceMode: 'deadline',
        budgetMs: 1_000_000,
        rng: () => 0.5,
      }),
    ).toThrow()
  })

  // --------------------------------------------------------------------
  // B1 (surface 2) - expires == lastSavedAt: the dead arm's `<=` routes
  // it to min(authorityNow, Date.now()) = currentMs; the payout probe
  // `expires > windowStart` fails identically -> flat pay, zero buffed
  // seconds. No off-by-one revive: marker-exact death is dead in both
  // domains (validator percent probe and restore percent probe sample
  // the same raw domain at lastSavedAt).
  // --------------------------------------------------------------------
  it('B1 expires == lastSavedAt stores dead at its own stamp (min of raw and dead bound) and pays flat', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs - 60_000
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: lastSavedAt - 86_400_000, expiresAtMs: lastSavedAt }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return
    // The marker-exact record does NOT feed the cps bound - the
    // validator's percentAtSave probe treats it dead.
    const player = usePlayerStore()
    const result = player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: currentMs - 120_000,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    // Dead arm: min(expires, min(authorityNow, Date.now())) - the record
    // keeps its own marker-exact stamp (already < field-now, dead by
    // the strict `expires > now` liveness in every reader).
    expect(stored!.expiresAtMs).toBe(lastSavedAt)
    expect(result.elapsedSeconds).toBe(120)
    expect(result.cultivation).toBe(1200)
  })

  // --------------------------------------------------------------------
  // B2 (surface 2) - validator-ceiling expiry: expires =
  // lastSavedAt + 24h + 7d is the widest admitted TLT shape. Storage
  // clamps at min(lastSavedAt, authorityNow) + 24h - never the raw
  // stamp. For a fresh save that bound is lastSavedAt + 24h.
  // --------------------------------------------------------------------
  it('B2 widest admitted TLT expiry clamps at lastSavedAt + 24h, never raw', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs - 60_000
    const expiresAtMs = lastSavedAt + 86_400_000 + 7 * 86_400_000
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: lastSavedAt - 1_000, expiresAtMs }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    expect(stored!.expiresAtMs).toBe(lastSavedAt + 86_400_000)
  })

  // --------------------------------------------------------------------
  // B3 (surface 2) - expires == lastSavedAt + 1ms: the live arm engages
  // and stores exactly its own stamp (inside provenance + 24h). The
  // crafted +1 survives the marker - bounded by its own width; the
  // payout domain samples the same strict `>` so it buys at most 1ms
  // of buffed window that its own claim already paid for in cps.
  // --------------------------------------------------------------------
  it('B3 expires == lastSavedAt + 1 stores exactly its own stamp (self-bounded revive)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs - 60_000
    const expiresAtMs = lastSavedAt + 1
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: lastSavedAt - 86_400_000, expiresAtMs }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    expect(stored!.expiresAtMs).toBe(expiresAtMs)
  })

  // --------------------------------------------------------------------
  // B4 (surface 2) - percent edge probes at the validator:
  //   -0   -> `percent <= 0` rejects (the writer only mints (0, 0.25]).
  //   0.25 -> admitted (exact authored ceiling).
  //   0.25 + eps -> rejected.
  //   NaN  -> non-finite -> rejected.
  //   The read-side filter is the same (0, 0.25] interval - parity.
  // --------------------------------------------------------------------
  it('B4 cultivationSpeedPercent edge probes: -0/NaN/0.25+eps rejected, 0.25 admitted', () => {
    const lastSavedAt = currentMs - 60_000
    const make = (percent: unknown) => {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = lastSavedAt
      p.persistentTimedEffects = [
        tltRecord({
          appliedAtMs: lastSavedAt - 1_000,
          expiresAtMs: lastSavedAt + 3_600_000,
          cultivationSpeedPercent: percent,
        }),
      ] as never
      return validateGameSaveShape(save)
    }

    expect(make(-0).ok).toBe(false)
    expect(make(Number.NaN).ok).toBe(false)
    expect(make(0.25 + Number.EPSILON).ok).toBe(false)
    expect(make(0.25).ok).toBe(true)
    expect(make(Number.MIN_VALUE).ok).toBe(true)
  })

  // --------------------------------------------------------------------
  // B5 (surface 2) - non-finite lastSavedAt: every `!isFinite
  // (saveLastSavedAtMs)` arm in boundTimedEffectClocks/payoutExpiresAtMs
  // falls back to raw stamps, but the shape gate requires a finite
  // marker for EVERY load path (saveShapeValidation.ts:2297) - the
  // fallback arms are unreachable through validated restores.
  // --------------------------------------------------------------------
  it('B5 non-finite lastSavedAt rejected by the shape gate on every seam', () => {
    for (const marker of [null, 'x', undefined, Number.NaN]) {
      const save = validSave()
      const p = save.player as PlayerData
      ;(p as unknown as Record<string, unknown>).lastSavedAt = marker
      expect(validateGameSaveShape(save).ok, `marker ${String(marker)}`).toBe(false)
    }
  })

  // --------------------------------------------------------------------
  // B6 (surface 2) - non-finite expiresAtMs rejected at the gate: the
  // `!isFinite -> raw expires` arm of boundTimedEffectClocks /
  // payoutExpiresAtMs is unreachable (Infinity would ride the whole
  // split window at +25% if it ever landed - pinned unreachable).
  // --------------------------------------------------------------------
  it('B6 non-finite expiresAtMs rejected at the shape gate', () => {
    const lastSavedAt = currentMs - 60_000
    for (const expires of [Number.POSITIVE_INFINITY, Number.NaN, null]) {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = lastSavedAt
      p.persistentTimedEffects = [
        tltRecord({
          appliedAtMs: lastSavedAt - 1_000,
          expiresAtMs: expires,
        }),
      ] as never
      expect(validateGameSaveShape(save).ok, `expires ${String(expires)}`).toBe(false)
    }
  })

  // --------------------------------------------------------------------
  // C1 (surface 3) - THE kill invariant: a seeded pending head always
  // lands in (max(settleNow, Date.now()), max + cycleMs] - never early
  // in the field epoch, never beyond one cycle of defer. Chain dues
  // step by exactly cycleMs from a seed <= settleNow, so the first due
  // past settleNow sits inside (settleNow, settleNow + cycleMs]; the
  // re-stamp adds max(0, Date.now() - settleNow) - pushing the head to
  // (Date.now(), Date.now() + cycleMs] under positive skew and leaving
  // it (deferred) under negative skew.
  // --------------------------------------------------------------------
  it('C1 seeded heads always land in (max(settleNow, Date.now()), +cycleMs] for any skew', () => {
    const cases: Array<{ label: string; settleNow: number; fieldNow: number; since: number }> = [
      // server-now under client clock (fast field clock): positive skew
      { label: 'field ahead +200s', settleNow: 800_000, fieldNow: 1_000_000, since: 400_000 },
      // client clock slow / server ahead: negative skew -> shift 0
      { label: 'field behind -200s', settleNow: 1_200_000, fieldNow: 1_000_000, since: 800_000 },
      // honest: settleNow == Date.now() (the local/legacy identity)
      { label: 'no skew', settleNow: 1_000_000, fieldNow: 1_000_000, since: 600_000 },
      // crafted deep-past window under a fast clock: 30d skew
      {
        label: 'deep-past +30d skew',
        settleNow: 800_000,
        fieldNow: 800_000 + 30 * 86_400_000,
        since: 0,
      },
    ]

    const cycleMs = 100_000
    for (const { label, settleNow, fieldNow, since } of cases) {
      vi.mocked(Date.now).mockReturnValue(fieldNow)
      const state = makeState(FOREST, { autoRestart: true })
      const deps = createDeps(new Map([[state.siteId, state]]))

      settleProductionOffline(
        deps,
        new MaterialBag(),
        new MaterialRegistry(),
        'mortal',
        settleNow,
        { workerCapacity: 1, offlineSinceMs: since, rng: () => 0.5 },
      )

      const heads = state.workerCycles ?? []
      const bound = Math.max(settleNow, fieldNow)
      expect(heads.length, label).toBe(1)
      for (const head of heads) {
        expect(
          head.completesAtMs > bound && head.completesAtMs <= bound + cycleMs,
          `${label}: head ${head.completesAtMs} outside (${bound}, ${bound + cycleMs}]`,
        ).toBe(true)
      }
    }
  })

  // --------------------------------------------------------------------
  // C2 (surface 3) - crafted narrow window: since just below settleNow
  // seeds dues that never reach settleNow - zero completions, pending
  // head lands past now in the field epoch too. A crafted window can
  // only shrink paid width, never widen it.
  // --------------------------------------------------------------------
  it('C2 crafted narrow window pays zero and still lands the head past field-now', () => {
    vi.mocked(Date.now).mockReturnValue(1_000_000)
    const state = makeState(FOREST, { autoRestart: true })
    const deps = createDeps(new Map([[state.siteId, state]]))

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      1_000_000,
      { workerCapacity: 1, offlineSinceMs: 990_000, rng: () => 0.5 },
    )

    expect(settled).toBe(0)
    const heads = state.workerCycles ?? []
    expect(heads).toHaveLength(1)
    expect(heads[0]!.completesAtMs).toBe(1_090_000) // since + cycleMs
    expect(heads[0]!.completesAtMs).toBeGreaterThan(1_000_000)
  })

  // --------------------------------------------------------------------
  // C3 (surface 3) - the local/legacy path: with no timeAuthority the
  // restore computes settleNow = min(lastSavedAt + elapsed, Date.now())
  // and elapsed = max(0, Date.now() - lastSavedAt), so settleNow is
  // ALWAYS exactly Date.now() -> shift is 0 -> heads land in
  // (Date.now(), Date.now() + cycleMs]. The "Date.now() honest but
  // nowMs under the client" shape cannot arise in local mode.
  // --------------------------------------------------------------------
  it('C3 legacy path: settleNow == Date.now() makes the shift identically zero', () => {
    vi.mocked(Date.now).mockReturnValue(1_000_000)
    const state = makeState(FOREST, { autoRestart: true })
    const deps = createDeps(new Map([[state.siteId, state]]))

    // settleNow = Date.now() (what the legacy path computes), since =
    // lastSavedAt deep past.
    settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      Date.now(),
      { workerCapacity: 1, offlineSinceMs: 400_000, rng: () => 0.5 },
    )

    const heads = state.workerCycles ?? []
    expect(heads).toHaveLength(1)
    expect(heads[0]!.completesAtMs).toBe(1_100_000) // Date.now() + cycleMs
    expect(heads[0]!.startedAtMs).toBe(1_000_000)
  })

  // --------------------------------------------------------------------
  // C4 (surface 3) - saved-lane heads are NEVER seed-rooted: a crafted
  // past-due head in payload stamps pays once at settle (bounded <= 1
  // cycle per saved lane, workerCycles.length <= 3 under beta) and the
  // successor keeps the lane's own deadline - the re-stamp does not
  // rescue it. Saved-chain successors settle against nowMs, not
  // Date.now(): under positive skew their pending head carries a
  // pre-Date.now() stamp - pays once at next tick (documented residual).
  // --------------------------------------------------------------------
  it('C4 saved-lane crafted head pays once, successor keeps raw payload stamp (bounded residual)', () => {
    vi.mocked(Date.now).mockReturnValue(1_000_000)
    const crafted = makeCycle(FOREST, 300_000, 450_000) // due in payload epoch
    const state = makeState(FOREST, {
      autoRestart: true,
      workerCycles: [crafted],
    })
    const deps = createDeps(new Map([[state.siteId, state]]))

    const settled = settleProductionOffline(
      deps,
      new MaterialBag(),
      new MaterialRegistry(),
      'mortal',
      800_000,
      { workerCapacity: 1, offlineSinceMs: 500_000, rng: () => 0.5 },
    )

    // head due 450k -> completes; successors at 550k,650k,750k due <=
    // 800k -> completes; next due 850k -> pending, chain-rooted at the
    // SAVED head's due -> NOT seeded -> keeps raw stamp 850k (ahead of
    // settleNow, behind Date.now() -> next tick pays it once, bounded).
    expect(settled).toBe(4)
    const heads = state.workerCycles ?? []
    expect(heads).toHaveLength(1)
    expect(heads[0]!.completesAtMs).toBe(850_000) // raw - unshifted
    expect(heads[0]!.completesAtMs).toBeLessThan(1_000_000)
  })

  // --------------------------------------------------------------------
  // D1 (surface 4) - epoch-flip MINT attempt (the R19-COR-1 crafted
  // twin): forged future marker + expires in (Date.now(), lastSavedAt]
  // - live on the field clock, dead in marker epoch. Validator admits
  // (expires <= lastSavedAt + 24h + 7d). Both consumers deny: stored
  // clamps at min(authorityNow, Date.now()), payout pays flat.
  // --------------------------------------------------------------------
  it('D1 epoch-flip mint attempt: admitted but stored dead, payout flat (deny holds)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs + 30 * 86_400_000 // forged future marker
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({
        appliedAtMs: currentMs - 10 * 3_600_000,
        // field-live, marker-dead: the whole mint shape
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

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    // Stored dead at min(currentMs, Date.now()) - not the raw +14h.
    expect(stored!.expiresAtMs).toBe(currentMs)
    expect(result.cultivation).toBe(1200)
  })

  // --------------------------------------------------------------------
  // D2 (surface 4) - forged future marker + validator-ceiling expires:
  // provenance clamps at min(lastSavedAt, authorityNow) = authorityNow
  // -> stored = authorityNow + 24h, NOT the raw +37d stamp. The clamp
  // is anchored to the SERVER time, so forging the marker forward can
  // never move the bound past authorityNow + duration.
  // --------------------------------------------------------------------
  it('D2 forged future marker + ceiling expires clamps at authorityNow + 24h', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs + 30 * 86_400_000
    const expiresAtMs = lastSavedAt + 86_400_000 + 7 * 86_400_000
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: currentMs - 1_000, expiresAtMs }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: currentMs - 120_000,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    expect(stored!.expiresAtMs).toBe(currentMs + 86_400_000)
    // The raw claim was +37d past currentMs - stored bound is +24h.
    expect(stored!.expiresAtMs).toBeLessThan(expiresAtMs)
  })

  // --------------------------------------------------------------------
  // D3 (surface 4) - the honest-width pin: a fresh marker + ceiling
  // expires pays +25% over the window (the claim's authorized width) -
  // 120 x 10 x 1.25 = 1500, bounded by min(elapsed, expires - start,
  // lastSavedAt + 24h). Nothing reads the raw +7d tail.
  // --------------------------------------------------------------------
  it('D3 fresh marker + ceiling expires pays exactly the authorized buffed width', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs - 60_000
    const expiresAtMs = lastSavedAt + 86_400_000 + 7 * 86_400_000
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: lastSavedAt - 1_000, expiresAtMs }),
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

    // Window [lastSavedAt, lastSavedAt + 120s]: the record is live for
    // the whole window at its authored +25% - 120 x 10 x 1.25 = 1500.
    // The unbounded raw tail adds nothing beyond the stored clamp.
    expect(result.elapsedSeconds).toBe(120)
    expect(result.cultivation).toBe(1500)
  })

  // --------------------------------------------------------------------
  // D4 (surface 4) - SUPERSEDED residual pin, now a deny pin (r22-AUT-1):
  // the "admitted and stored raw" classification was wrong for an
  // EXPIRY field - parking it minted ~285M years of regen (grant
  // direction). boundTimedEffectClocks now bounds stackable expiries
  // like every sibling: a crafted 1e15 restores clamped at
  // provenance + 24h, the mint dead. Forge ceiling pins unchanged:
  // ONE record per effectGroup (dedup), one modifier at <= 1.5x
  // authored rate, realm-earnability gated, dormant families rejected.
  // --------------------------------------------------------------------
  it('D4 stackable regen forged 1e15 expires: admitted, restore-clamped to provenance+24h (r22 fix)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.realmId = 'qi_refining' // mp_regen family dormant at mortal
    p.realmLevel = 1
    p.cultivation = 0
    p.breakthroughGrade = 1
    save.techniques = [fiveElementsTechnique()]
    const lastSavedAt = currentMs - 60_000
    p.lastSavedAt = lastSavedAt
    p.persistentTimedEffects = [
      {
        id: 'fx-regen',
        sourceItemId: 'hoi_linh_dan_qi_refining',
        effectGroup: 'hoi_linh_dan',
        durationStackable: true,
        appliedAtMs: lastSavedAt - 1_000,
        expiresAtMs: 1e15,
        modifiers: [regenModifier('hoi_linh_dan_qi_refining', 4)],
      },
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'hoi_linh_dan',
    )
    expect(stored).toBeDefined()
    // The crafted deadline no longer survives: restore clamps it at
    // provenance + TU_LINH_TRAN_DURATION_MS (lastSavedAt wins min here),
    // so the buff dies inside one authored window, not ~285M years.
    expect(stored!.expiresAtMs).toBe(lastSavedAt + 24 * 3_600_000)
    expect(stored!.durationStackable).toBe(true)
  })

  // --------------------------------------------------------------------
  // D4b - the residual's ceiling pins: dormant-family source rejected,
  // over-ceiling flat rejected, second same-group record rejected,
  // non-stackable claim rejected (authored regen is stackable:true).
  // --------------------------------------------------------------------
  it('D4b regen residual ceiling: dormant/over-flat/dup-group/non-stackable all rejected', () => {
    const base = () => {
      const save = validSave()
      const p = save.player as PlayerData
      p.realmId = 'qi_refining'
      p.realmLevel = 1
      p.cultivation = 0
      p.breakthroughGrade = 1
      save.techniques = [fiveElementsTechnique()]
      p.lastSavedAt = currentMs - 60_000
      return { save, p }
    }
    const regen = (overrides: Record<string, unknown>) => ({
      id: 'fx-regen',
      sourceItemId: 'hoi_linh_dan_qi_refining',
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      appliedAtMs: currentMs - 61_000,
      expiresAtMs: currentMs + 3_600_000,
      modifiers: [regenModifier('hoi_linh_dan_qi_refining', 4)],
      ...overrides,
    })

    // dormant family at any realm (hoi_xuan_dan retired)
    {
      const { save, p } = base()
      p.persistentTimedEffects = [
        regen({
          sourceItemId: 'hoi_xuan_dan_qi_refining',
          effectGroup: 'hoi_xuan_dan',
          modifiers: [regenModifier('hoi_xuan_dan_qi_refining', 4)],
        }),
      ] as never
      expect(validateGameSaveShape(save).ok, 'dormant family').toBe(false)
    }
    // over-ceiling flat: authored mpPerSecond(qi_refining) = round(2*1.7)
    // = 3 -> maxFlat = 4.5
    {
      const { save, p } = base()
      p.persistentTimedEffects = [
        regen({ modifiers: [regenModifier('hoi_linh_dan_qi_refining', 5)] }),
      ] as never
      expect(validateGameSaveShape(save).ok, 'flat > 1.5x authored').toBe(false)
    }
    // duplicate effectGroup
    {
      const { save, p } = base()
      p.persistentTimedEffects = [regen({}), regen({ id: 'fx-regen-2' })] as never
      expect(validateGameSaveShape(save).ok, 'duplicate group').toBe(false)
    }
    // non-stackable claim on a stackable-authored regen
    {
      const { save, p } = base()
      p.persistentTimedEffects = [regen({ durationStackable: false })] as never
      expect(validateGameSaveShape(save).ok, 'non-stackable claim').toBe(false)
    }
    // realm-earnability: pill above save realm rejected
    {
      const { save, p } = base()
      p.persistentTimedEffects = [
        regen({ sourceItemId: 'hoi_linh_dan_tribulation' }),
      ] as never
      expect(validateGameSaveShape(save).ok, 'pill realm > save realm').toBe(false)
    }
  })
})
