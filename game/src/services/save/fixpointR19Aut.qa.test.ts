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
import type { ProductionCycle, ProductionSiteState } from '../../core/production/ProductionTypes'
import type { MaterialBag } from '../../core/material/MaterialBag'
import type { MaterialRegistry } from '../../core/material/MaterialRegistry'
import type { GameSave } from './SaveSystem'

// ============================================================================
// QA repro - fixpoint r19 AUT wave (blind audit of commit 8f60f30c, the r18
// adjudication batch). Threat model: a malicious client forges save payloads
// and device clock; the validator admits only bounded shapes. Attack the r18
// surfaces for residual mint paths:
//   1. TLT claim bound min(expires, lastSavedAt+24h) / min(expires,
//      min(lastSavedAt, authorityNow)+24h) - crafted appliedAt/expiresAt/
//      lastSavedAt triples trying to mint buff time past authorityNow+24h or
//      widen the payout past the authorized window.
//   2. WorkerLaneAdvance jump guard headCostMs > budgetLeftMs && cycleMs >
//      budgetLeftMs - crafted lanes forcing unbounded iteration or skipped
//      forfeit.
//   3. seededPending re-stamp +max(0, Date.now()-nowMs) - client-anchored
//      offlineSinceMs trying to land seed-rooted heads before their honest
//      field-epoch deadline or survive unshifted.
//   4. restoreFromSave elapsed/window derivation + the dead arm.
// ============================================================================

let currentMs = 1_725_160_000_000

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const TLT_DUR_MS = 24 * HOUR_MS

function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 10,
    baseStats: {},
    modifiers: [],
    externalModifiers: [],
    spiritStone: 0,
    selectedTalentIds: [],
    hasSeenTutorial: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    nodeLevels: {},
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyProgression: {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
    },
    physiqueGrade: 'pham',
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],
    persistentTimedEffects: [],
    refinementPoints: 100,
    lastRefinementRegenAtMs: Date.now(),
    lastSavedAt: Date.now(),
  }

  return { player: { ...base, ...playerOverrides } } as unknown as GameSave
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

function laneCycle(overrides: Partial<ProductionCycle>): ProductionCycle {
  return {
    cycleId: 'c-forged',
    siteId: 'forge_site',
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 123,
    startedAtMs: 0,
    completesAtMs: 100_000,
    ...overrides,
  }
}

describe('fixpoint r19 AUT - r18 adjudication batch attack probes', () => {
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

  // ------------------------------------------------------------------
  // Surface 1 - TLT claim bound. Crafted triple probes.
  // ------------------------------------------------------------------

  it('T1: forged deep-past appliedAt + expires inside the live arm stays inside provenance+dur', () => {
    // Crafted triple: appliedAt deep past, expires = lastSavedAt + 22h.
    // The claim's own deadline is already inside the bound -> the store
    // keeps it verbatim (bounded, not widened).
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 60_000
    const expires = lastSavedAt + 22 * HOUR_MS

    const save = buildMinimalSave({
      cultivationPerSecond: 12.5,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({ appliedAtMs: lastSavedAt - 400 * DAY_MS, expiresAtMs: expires }),
      ],
    })

    player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(expires)
    expect(stored.expiresAtMs).toBeLessThanOrEqual(currentMs + TLT_DUR_MS)
    expect(stored.appliedAtMs).toBeLessThanOrEqual(currentMs)
  })

  it('T2: expires at the validator ceiling (lastSavedAt+24h+7d) clamps to provenance+dur, never past authorityNow+24h', () => {
    // Forged far-future deadline at the widest shape the gate admits.
    // Storage must cap at min(lastSavedAt, authorityNow) + 24h.
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 60_000
    const expires = lastSavedAt + TLT_DUR_MS + 7 * DAY_MS

    const save = buildMinimalSave({
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({ appliedAtMs: lastSavedAt - 30 * DAY_MS, expiresAtMs: expires }),
      ],
    })

    player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects[0]!
    // provenance = min(lastSavedAt, until) = lastSavedAt -> bound is
    // lastSavedAt + 24h. Under a stale save the clamp lands BELOW
    // authorityNow + 24h - the forged tail dies with the save's own
    // provenance, not at boot + 24h.
    expect(stored.expiresAtMs).toBe(lastSavedAt + TLT_DUR_MS)
    expect(stored.expiresAtMs).toBeLessThanOrEqual(currentMs + TLT_DUR_MS)
  })

  it('T3: forged-future lastSavedAt - the far-future claim stores at authorityNow + 24h max, never beyond', () => {
    // lastSavedAt forged 30d into the future; the live arm provenance
    // clamps at authorityNow, so the stored buff cannot outlive
    // authorityNow + 24h even though the claim asserts +30d.
    const player = usePlayerStore()
    const lastSavedAt = currentMs + 30 * DAY_MS

    const save = buildMinimalSave({
      cultivationPerSecond: 12.5,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - HOUR_MS,
          expiresAtMs: lastSavedAt + 23 * HOUR_MS,
        }),
      ],
    })

    player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs - HOUR_MS,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(currentMs + TLT_DUR_MS)
    // The claim's far-future stamp is the bound, not the record's.
    expect(stored.appliedAtMs).toBeLessThanOrEqual(currentMs)
  })

  it('T4: non-finite expiresAtMs / appliedAtMs are rejected by the shape gate', () => {
    for (const bad of [Number.POSITIVE_INFINITY, Number.NaN]) {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = currentMs - 60_000
      p.persistentTimedEffects = [
        tltRecord({ appliedAtMs: currentMs - 2 * HOUR_MS, expiresAtMs: bad }),
      ] as never

      const validation = validateGameSaveShape(save)
      expect(validation.ok).toBe(false)
    }
    for (const bad of [Number.POSITIVE_INFINITY, Number.NaN]) {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = currentMs - 60_000
      p.persistentTimedEffects = [
        tltRecord({ appliedAtMs: bad, expiresAtMs: currentMs + HOUR_MS }),
      ] as never

      const validation = validateGameSaveShape(save)
      expect(validation.ok).toBe(false)
    }
  })

  it('T5: durationStackable:true forged onto a TLT record is rejected (bound bypass closed)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = currentMs - 60_000
    p.persistentTimedEffects = [
      tltRecord({
        appliedAtMs: currentMs - 2 * HOUR_MS,
        expiresAtMs: currentMs + 365 * DAY_MS,
        durationStackable: true,
      }),
    ] as never

    const validation = validateGameSaveShape(save)
    expect(validation.ok).toBe(false)
  })

  it('T6: expires < appliedAt is rejected; appliedAt > lastSavedAt is rejected', () => {
    const save = validSave()
    const p = save.player as PlayerData
    p.lastSavedAt = currentMs - 60_000
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: currentMs, expiresAtMs: currentMs - HOUR_MS }),
    ] as never
    expect(validateGameSaveShape(save).ok).toBe(false)

    const save2 = validSave()
    const p2 = save2.player as PlayerData
    p2.lastSavedAt = currentMs - 60_000
    p2.persistentTimedEffects = [
      tltRecord({ appliedAtMs: currentMs - 30_000, expiresAtMs: currentMs + HOUR_MS }),
    ] as never
    expect(validateGameSaveShape(save2).ok).toBe(false)
  })

  it('T7: payout never exceeds the authorized window - a 1ms-live claim pays 1ms of buff, not the bound', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 30_000 // 30s window keeps the grant under the realm cap

    const save = buildMinimalSave({
      cultivationPerSecond: 12.5,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - 30 * DAY_MS,
          expiresAtMs: lastSavedAt + 1, // dies 1ms after the marker
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    // Window = 30s; the buff is live only for 1ms of it -> pays the
    // flat rate on ~the whole window: 10 x 29.999 + 12.5 x 0.001.
    // The claim cannot widen past authorized width.
    expect(result.elapsedSeconds).toBe(30)
    expect(result.cultivation).toBeCloseTo(300.0025, 3)
  })

  it('T8: crafted future-positioned marker (lastSavedAt > authorityNow) grants zero offline payout', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs + 30 * DAY_MS

    const save = buildMinimalSave({
      cultivationPerSecond: 12.5,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - HOUR_MS,
          expiresAtMs: lastSavedAt + 23 * HOUR_MS,
        }),
      ],
    })

    const result = player.restoreFromSave(save) // local semantics

    // elapsed = 0 (lastOnlineAt in the future) -> zero-width window.
    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('T9: dead-at-save record keeps 0% through the window under a slow device clock', () => {
    // Slow clock: Date.now() is 2h BEHIND the authority-now. A record
    // dead at the marker must not revive on either the stored copy
    // (clamps at Date.now()) or the payout copy (keeps its dead stamp).
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 40_000 // marker 40s behind field-now
    const authorityUntil = currentMs + 10_000 // server window ends 10s ahead

    const save = buildMinimalSave({
      cultivationPerSecond: 10,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - 25 * HOUR_MS,
          expiresAtMs: lastSavedAt - HOUR_MS, // dead before the save
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: authorityUntil,
    })

    const stored = player.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBeLessThanOrEqual(currentMs)
    // The dead record contributes no buffed segment: window pays flat
    // unbuffed for the authorized elapsed (50s -> 500).
    expect(result.elapsedSeconds).toBe(50)
    expect(result.cultivation).toBe(10 * 50)
  })

  // ------------------------------------------------------------------
  // Surface 2 - WorkerLaneAdvance jump guard / iteration bound.
  // ------------------------------------------------------------------

  it('W1: crafted huge-span saved head (span > 10h budget) jumps O(1), leaves head in (now, now+cycle]', () => {
    // A forged in-flight cycle whose claimed span exceeds the whole
    // budget: headCost > budgetLeft AND cycleMs > budgetLeft arms the
    // jump. Assert termination and the pending head position.
    const cycleMs = 656_100_000 // tribulation base ~7.6d - head + cycle both exceed the 10h cap
    const startMs = -1_000_000_000_000_000 // -1e15 deep past
    const head = laneCycle({
      collectionRealmId: 'tribulation',
      startedAtMs: startMs,
      completesAtMs: startMs + cycleMs,
    })

    const t0 = performance.now()
    const result = advanceWorkerLanes({
      siteId: 'forge_site',
      collectionRealmId: 'tribulation',
      siteLevel: 1,
      baseSeconds: 656_100,
      cycleMs,
      pending: [head],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
      rng: () => 0.5,
    })
    const wallMs = performance.now() - t0

    // The head's cost exceeds the budget -> forfeits (no grant); the
    // chain jumps in O(1) and re-inserts its pending head past nowMs.
    expect(result.completed).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
    const due = result.pending[0]!.completesAtMs
    expect(due).toBeGreaterThan(currentMs)
    expect(due).toBeLessThanOrEqual(currentMs + cycleMs)
    expect(wallMs).toBeLessThan(500)
    expect(Number.isFinite(result.forfeited)).toBe(true)
    expect(result.forfeited).toBeGreaterThanOrEqual(1)
  })

  it('W2: crafted deep-past saved head with affordable span completes once inside the cap - no extra forfeit skip', () => {
    // A saved head whose span fits the budget completes exactly once
    // (in-flight work) - parity with the per-iteration walk.
    const head = laneCycle({
      startedAtMs: -1_000_000_000_000_000,
      completesAtMs: -1_000_000_000_000_000 + 100_000,
    })

    const result = advanceWorkerLanes({
      siteId: 'forge_site',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [head],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: 0,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
      rng: () => 0.5,
    })

    // The saved head completes once (cost 100s <= budget); its chain
    // then settles under the same budget and the pending head lands in
    // (now, now+cycle].
    expect(result.completed).toHaveLength(360)
    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]!.completesAtMs).toBeGreaterThan(currentMs)
    expect(result.pending[0]!.completesAtMs).toBeLessThanOrEqual(currentMs + 100_000)
  })

  it('W3: zero-cycle site (cycleMs = 0) drains without unbounded iteration', () => {
    const head = laneCycle({
      startedAtMs: currentMs - 1_000_000,
      completesAtMs: currentMs - 500_000,
    })

    const t0 = performance.now()
    const result = advanceWorkerLanes({
      siteId: 'forge_site',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 0,
      cycleMs: 0,
      pending: [head],
      slots: 1,
      nowMs: currentMs,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
      rng: () => 0.5,
    })
    const wallMs = performance.now() - t0

    // canSpawn = false -> no respawn, no seeds: the single lane drains
    // in one iteration and grants its completion (cost <= budget).
    expect(result.completed).toHaveLength(1)
    expect(result.pending).toHaveLength(0)
    expect(wallMs).toBeLessThan(100)
  })

  it('W4: skippedDues jump on a -1e15 due is O(1) and lands the head in (now, now+cycle]', () => {
    // The extreme-epoch pin: dueMs = -1e15 with a 22s cycle gives
    // skippedDues ~4.5e10. Assert the jump lands the re-inserted head
    // deterministically and does not spin the loop.
    const cycleMs = 22_000
    const dueMs = -1_000_000_000_000_000
    const head = laneCycle({
      startedAtMs: dueMs - cycleMs,
      completesAtMs: dueMs,
    })

    const t0 = performance.now()
    const result = advanceWorkerLanes({
      siteId: 'forge_site',
      collectionRealmId: 'mortal',
      siteLevel: 9,
      baseSeconds: 100,
      cycleMs,
      pending: [head],
      slots: 1,
      nowMs: currentMs,
      emptyLaneStartMs: dueMs,
      advanceMode: 'deadline',
      budgetMs: 36_000_000,
      rng: () => 0.5,
    })
    const wallMs = performance.now() - t0

    expect(result.pending).toHaveLength(1)
    const due = result.pending[0]!.completesAtMs
    expect(due).toBeGreaterThan(currentMs)
    expect(due).toBeLessThanOrEqual(currentMs + cycleMs)
    expect(Number.isFinite(due)).toBe(true)
    expect(wallMs).toBeLessThan(500)
  })

  // ------------------------------------------------------------------
  // Surface 3 - seededPending field-epoch re-stamp.
  // ------------------------------------------------------------------

  it('S1: deep-past client anchor under a FAST clock - seeded pending heads shift into the field epoch, never land early', () => {
    // settle-now = authority until; Date.now() (field) runs 1h ahead.
    // A crafted deep-past offlineSinceMs seeds chains that walk under
    // the budget; every seed-rooted pending head must re-stamp to
    // (fieldNow, fieldNow + cycle] - none may persist at the settle
    // (server) epoch and pay early.
    const settleNowMs = currentMs - HOUR_MS // authority now (server)
    const fieldNowMs = currentMs // fast client clock reads settle+1h
    const cycleMs = 22_000

    const states = new Map<string, ProductionSiteState>([
      [
        'forge_site',
        {
          siteId: 'forge_site',
          level: 9,
          autoRestart: true,
          activeWorkerSlots: 0,
          workerCycles: [],
        },
      ],
    ])

    const granted: ProductionCycle[] = []
    settleProductionOffline(
      {
        states,
        getSiteDefinition: (siteId) =>
          siteId === 'forge_site'
            ? { siteId, maxLevel: 9 } as never
            : undefined,
        grantCycleRewards: (cycle) => {
          granted.push(cycle)
        },
      },
      {} as MaterialBag,
      {} as MaterialRegistry,
      'mortal',
      settleNowMs,
      {
        workerCapacity: 1,
        offlineSinceMs: 0, // crafted deep-past anchor (forged lastSavedAt)
        rng: () => 0.5,
      },
    )

    const persisted = states.get('forge_site')!.workerCycles!
    expect(persisted.length).toBeGreaterThan(0)
    for (const head of persisted) {
      // Every seed-rooted pending head was re-stamped into the field
      // epoch: its deadline sits strictly after field-now - no early
      // pay possible at the next tickWorkers.
      expect(head.completesAtMs).toBeGreaterThan(fieldNowMs)
      expect(head.completesAtMs).toBeLessThanOrEqual(fieldNowMs + cycleMs)
      expect(head.startedAtMs).toBeGreaterThan(fieldNowMs - cycleMs)
    }
    // Completions stay budget-bounded (~36e6 / 22s = ~1636/lane).
    expect(granted.length).toBeLessThanOrEqual(2_000)
    expect(granted.length).toBeGreaterThan(0)
  })

  it('S2: slow device clock - seeded pending heads persist unshifted at the settle epoch (bounded underpay, never early)', () => {
    // Date.now() is BEHIND the settle-now -> shift = 0; the seeded head
    // keeps its authority-epoch deadline which reads FUTURE in field
    // time. Deny direction only.
    const settleNowMs = currentMs + HOUR_MS // authority ahead of field
    const cycleMs = 22_000

    const states = new Map<string, ProductionSiteState>([
      [
        'forge_site',
        {
          siteId: 'forge_site',
          level: 9,
          autoRestart: true,
          activeWorkerSlots: 0,
          workerCycles: [],
        },
      ],
    ])

    settleProductionOffline(
      {
        states,
        getSiteDefinition: (siteId) =>
          siteId === 'forge_site' ? ({ siteId, maxLevel: 9 } as never) : undefined,
        grantCycleRewards: () => {},
      },
      {} as MaterialBag,
      {} as MaterialRegistry,
      'mortal',
      settleNowMs,
      {
        workerCapacity: 1,
        offlineSinceMs: settleNowMs - HOUR_MS,
        rng: () => 0.5,
      },
    )

    const persisted = states.get('forge_site')!.workerCycles!
    for (const head of persisted) {
      // Unshifted: the stamp stays in the settle epoch - strictly
      // greater than field-now, so it cannot pay early either.
      expect(head.completesAtMs).toBeGreaterThan(settleNowMs)
      expect(head.completesAtMs).toBeLessThanOrEqual(settleNowMs + cycleMs)
    }
  })

  it('S3: saved-lane heads keep their own deadlines past the re-stamp (bounded residual)', () => {
    // A SAVED lane's surviving head is not seed-rooted -> it persists
    // with its own payload deadline. The only early-pay it can claim
    // is already inside the settle (due <= settleNow completes under
    // the budget); a deadline past settleNow persists verbatim.
    const settleNowMs = currentMs - HOUR_MS
    const savedHead = laneCycle({
      cycleId: 'c-saved',
      siteId: 'forge_site',
      startedAtMs: settleNowMs - 50_000,
      completesAtMs: settleNowMs + 30_000, // in-flight past settle-now
    })

    const states = new Map<string, ProductionSiteState>([
      [
        'forge_site',
        {
          siteId: 'forge_site',
          level: 1,
          autoRestart: true,
          activeWorkerSlots: 0,
          workerCycles: [savedHead],
        },
      ],
    ])

    settleProductionOffline(
      {
        states,
        getSiteDefinition: (siteId) =>
          siteId === 'forge_site' ? ({ siteId, maxLevel: 9 } as never) : undefined,
        grantCycleRewards: () => {},
      },
      {} as MaterialBag,
      {} as MaterialRegistry,
      'mortal',
      settleNowMs,
      { workerCapacity: 1, offlineSinceMs: settleNowMs - HOUR_MS, rng: () => 0.5 },
    )

    const persisted = states.get('forge_site')!.workerCycles!
    // The saved head survived pending and was NOT re-stamped - its own
    // client-epoch deadline is preserved verbatim.
    const kept = persisted.find((c) => c.cycleId === 'c-saved')
    expect(kept).toBeDefined()
    expect(kept!.completesAtMs).toBe(settleNowMs + 30_000)
    expect(kept!.startedAtMs).toBe(settleNowMs - 50_000)
  })

  // ------------------------------------------------------------------
  // Surface 4 - restoreFromSave elapsed/window + payout bound probes.
  // ------------------------------------------------------------------

  it('R1: crafted lastSavedAt exactly at bounds - expires == lastSavedAt contributes zero buffed seconds', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 30_000 // 30s window stays under the realm cap

    const save = buildMinimalSave({
      cultivationPerSecond: 10,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - HOUR_MS,
          expiresAtMs: lastSavedAt, // dies exactly AT the marker
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    // expires > segmentStart required -> a marker-exact death emits no
    // buffed segment; whole window pays flat unbuffed (10/s).
    expect(result.elapsedSeconds).toBe(30)
    expect(result.cultivation).toBe(10 * 30)
  })

  it('R4: cps snapshot probe matches percentAtSave - marker-exact death admits only the flat rate, +1ms admits x1.25', () => {
    // The validator's liveTltPercent and restore's percentAtSave sample
    // the SAME raw domain at lastSavedAt: a claim dying AT the marker
    // is dead for both, so the folded-buff cps claim (12.5) clamps to
    // BASE (10) instead of riding the loosened x1.25 bound.
    const lastSavedAt = currentMs - 60_000

    const makeSave = (expiresAtMs: number) => {
      const save = validSave()
      const p = save.player as PlayerData
      p.lastSavedAt = lastSavedAt
      p.cultivationPerSecond = 12.5
      p.persistentTimedEffects = [
        tltRecord({ appliedAtMs: lastSavedAt - HOUR_MS, expiresAtMs }),
      ] as never
      return save
    }

    const deadAtMarker = validateGameSaveShape(makeSave(lastSavedAt))
    expect(deadAtMarker.ok).toBe(true)
    const livePastMarker = validateGameSaveShape(makeSave(lastSavedAt + 1))
    expect(livePastMarker.ok).toBe(true)
    if (!deadAtMarker.ok || !livePastMarker.ok) {
      throw new Error('fixture rejected by the shape gate')
    }

    // 1ms of liveness moves the admitted snapshot from 10 to 12.5 -
    // the same 1ms moves restore's un-buff divide identically, so no
    // crafted (percent, expires) pair can mint the loosened width.
    const deadNormalized = (
      deadAtMarker.normalizedSave as { player: PlayerData }
    ).player.cultivationPerSecond
    const liveNormalized = (
      livePastMarker.normalizedSave as { player: PlayerData }
    ).player.cultivationPerSecond
    expect(deadNormalized).toBe(10)
    expect(liveNormalized).toBeCloseTo(12.5, 9)

    // A 1e-9 live percent loosens the bound by only 1e-9 - the forged
    // micro-percent + micro-window shape (r15-AUT-1) stays defunct:
    // unbuffed = claim/(1+p) is pinned at BASE, not BASE x 1.25.
    const microSave = validSave()
    const mp = microSave.player as PlayerData
    mp.lastSavedAt = lastSavedAt
    mp.cultivationPerSecond = 12.5
    mp.persistentTimedEffects = [
      tltRecord({
        appliedAtMs: lastSavedAt - HOUR_MS,
        expiresAtMs: lastSavedAt + 1,
        cultivationSpeedPercent: 1e-9,
      }),
    ] as never
    const micro = validateGameSaveShape(microSave)
    expect(micro.ok).toBe(true)
    if (!micro.ok) {
      throw new Error('fixture rejected by the shape gate')
    }
    const microNormalized = (
      micro.normalizedSave as { player: PlayerData }
    ).player.cultivationPerSecond
    expect(microNormalized).toBeGreaterThan(10)
    expect(microNormalized).toBeLessThan(10.001)
  })

  it('R2: cold-boot with since > until collapses to zero width - no negative-window grant', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 60_000

    const save = buildMinimalSave({ cultivationPerSecond: 10, lastSavedAt })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs + HOUR_MS, // inverted authority window
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(0)
    expect(result.cultivation).toBe(0)
  })

  it('R3: stale save + live claim - stored buff caps at lastSavedAt+24h, not boot+24h (provenance bound holds)', () => {
    // The r14-AUT-2 direction: a stale save's forged far-future
    // deadline must clamp at the save's own provenance, not revive at
    // boot + 24h.
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 10 * DAY_MS

    const save = buildMinimalSave({
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - 2 * DAY_MS,
          expiresAtMs: lastSavedAt + TLT_DUR_MS + 7 * DAY_MS, // validator max shape
        }),
      ],
    })

    player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: currentMs,
    })

    const stored = player.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(lastSavedAt + TLT_DUR_MS)
    // Dead in the field epoch: tickTimedEffects would reap - never
    // mints live buff time past authorityNow + 24h.
    expect(stored.expiresAtMs).toBeLessThan(currentMs)
  })
})
