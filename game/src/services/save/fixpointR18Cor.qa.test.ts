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
import type { GameSave } from './SaveSystem'

// ============================================================================
// QA repro - fixpoint r18 COR wave (blind audit of commit cef2af9e, the r17
// adjudication batch).
//
// R18-COR-1 - the r17-COR-B1 duration bound binds at `appliedAtMs`, but
// applyTimedEffect's non-stackable merge policy NEVER re-stamps appliedAtMs
// on refresh (GameManagerPersistentEffectOps.ts:307-352 - only expiresAtMs
// moves forward). The validator documents the honest consequence: "an
// honest repeat purchase legitimately produces a span beyond
// TU_LINH_TRAN_DURATION_MS" (saveShapeValidation.ts ~1556). Every honest
// TLT chain older than one duration therefore has appliedAtMs + 24h in the
// DEEP PAST while expiresAtMs is live past the save marker - and both r17
// bounds (stored copy min(appliedAt, authorityNow) + 24h; payout copy
// min(appliedAt, lastSavedAt) + 24h) land in the deep past too, killing a
// buff the player honestly owns: the stored buff reads dead at restore,
// and the offline window pays the unbuffed rate. That is a strict
// honest-regression vs the pre-r17 bound at skew = 0 - the exact property
// the wave was told to preserve.
//
// R18-COR-2 - the r17-AUT-1 O(1) budget-exhaustion jump only fires at
// `budgetLeftMs <= 0` (WorkerLaneAdvance.ts:195). Whenever the completed
// cost sum leaves a leftover in (0, cycleMs) - the common case for any
// cycle duration that does not evenly divide the cap, for a saved head
// priced below cycleMs, or for multi-site budget residue - every
// remaining due forfeits ONE PER LOOP ITERATION: the unbounded
// window-depth walk the fix was meant to close is still live.
// ============================================================================

let currentMs = 1_725_160_000_000

function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 12,
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

describe('fixpoint r18 COR - r17 adjudication batch repros', () => {
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
  // R18-COR-1(a): an honest refreshed (rebuy) TLT record - admitted by
  // the validator - gets its STORED expiry clamped to
  // first-application + 24h, so a live buff reads dead at restore.
  // --------------------------------------------------------------------
  it('honest TLT rebuy: validator admits the chain, restore kills its live expiry (skew=0)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const lastSavedAt = currentMs - 30_000
    // Chain bought 20 days ago, honestly re-bought 20h before the save:
    // applyTimedEffect kept appliedAtMs at FIRST apply and extended only
    // expiresAtMs -> {appliedAt: save-20d, expires: save+4h} is the true
    // honest record shape (validator comment admits spans > 24h).
    const firstApply = lastSavedAt - 20 * 86_400_000
    const refreshedExpires = lastSavedAt + 4 * 3_600_000 // = lastBuy + 24h
    p.lastSavedAt = lastSavedAt
    p.cultivationPerSecond = 12.5 // 10 x 1.25 buffed snapshot at save
    p.persistentTimedEffects = [
      tltRecord({ appliedAtMs: firstApply, expiresAtMs: refreshedExpires }),
    ] as never

    const validation = validateGameSaveShape(save)
    // The honest refreshed shape passes every writer bound.
    expect(validation.ok).toBe(true)
    if (!validation.ok) return

    const player = usePlayerStore()
    player.restoreFromSave(validation.normalizedSave as GameSave, {
      kind: 'cold-boot',
      sinceMs: currentMs - 60_000,
      untilMs: currentMs,
    })

    // HONEST: expiresAtMs is the player's true deadline - the buff must
    // survive restore live until save + 4h.
    // OBSERVED (r17): stored expiry = min(firstApply, authorityNow) + 24h
    // = lastSavedAt - 19d -> the record is dead before it was even saved.
    const stored = player.persistentTimedEffects.find(
      (e) => e.effectGroup === 'tu_linh_tran',
    )
    expect(stored).toBeDefined()
    expect(stored!.expiresAtMs).toBe(refreshedExpires)
  })

  // --------------------------------------------------------------------
  // R18-COR-1(b): same record through the offline payout - the buffed
  // segment is erased even though the validator probe reads it live and
  // the cps snapshot legitimately folded +25%.
  // --------------------------------------------------------------------
  it('honest TLT rebuy: offline payout pays the flat unbuffed rate through the whole window', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 30_000
    const save = buildMinimalSave({
      cultivationPerSecond: 12.5,
      lastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: lastSavedAt - 20 * 86_400_000,
          expiresAtMs: lastSavedAt + 4 * 3_600_000,
        }),
      ],
    })

    const result = player.restoreFromSave(save)

    expect(result.elapsedSeconds).toBe(30)
    // HONEST: expires > lastSavedAt at the marker -> the whole 30s window
    // is boosted: 30s x (12.5/1.25) x 1.25 = 375. The r14 bound
    // (min(lastSavedAt, authorityNow) + 24h) preserved this tail.
    // OBSERVED (r17): payout bound = min(appliedAt, lastSavedAt) + 24h
    // = save - 19d -> dead through the window -> pays 30s x 10 = 300.
    expect(result.cultivation).toBe(375)
  })

  // --------------------------------------------------------------------
  // R18-COR-2: the O(1) 'jump past exhausted-budget dues' only fires at
  // budgetLeftMs <= 0. A leftover in (0, cycleMs) - reached whenever
  // cycleMs does not divide the cap - leaves the unbounded per-due
  // forfeit walk live (the r17-AUT-1 defect class).
  // Deterministic evidence: count loop iterations via Array.shift.
  // --------------------------------------------------------------------
  it('deadline settle walks every leftover-budget due one-by-one when budget leftover > 0', () => {
    // Deterministic iteration counter: lanes.shift() runs once per
    // processed due (direct patch - a vitest spy on Array.prototype
    // recurses through its own call-tracking internals). Instrumented
    // raw: the 200M window yields exactly 2_857 shifts = 514 completions
    // + 2_343 one-by-one forfeits.
    const originalShift = Array.prototype.shift
    const calls: number[] = []
    let counting = false
    let shifts = 0
    Array.prototype.shift = function (this: unknown[]) {
      if (counting) shifts += 1
      return originalShift.call(this)
    }

    const run = (nowMs: number) => {
      // cycleMs = 70s does not divide the 36_000_000ms cap: 514
      // completions consume 35_980_000, leaving budgetLeft = 20_000ms in
      // (0, cycleMs). The jump guard requires <= 0, so every remaining
      // due forfeits in its own loop iteration.
      shifts = 0
      counting = true
      const result = advanceWorkerLanes({
        siteId: 'audit_lane',
        collectionRealmId: 'mortal',
        siteLevel: 1,
        baseSeconds: 70,
        cycleMs: 70_000,
        pending: [],
        slots: 1,
        nowMs,
        emptyLaneStartMs: 0,
        advanceMode: 'deadline',
        budgetMs: 36_000_000,
        rng: () => 0.5,
      })
      counting = false
      calls.push(shifts)
      return result
    }

    try {
      const shallow = run(100_000_000) // dues = floor(1e8/7e4) = 1_428
      const deep = run(200_000_000) // dues = 2_857

      expect(shallow.completed).toHaveLength(514)
      expect(deep.completed).toHaveLength(514)
      expect(deep.forfeited).toBe(2_343)

      // The settle RESULTS are right - the evidence is the walk: with a
      // working post-budget jump both calls process ~515 dues in O(1)
      // (514 completions + 1 jump) regardless of window depth. r17
      // instead iterates once per due - raw instrumentation shows
      // exactly 2_857 shifts for the deep window (= dues count); inside
      // vitest a constant +515 (one per buildProductionCycle) rides on
      // top, so the DELTA is the clean invariant: a correct fix keeps it
      // ~0 while r17 pays +1_429 extra iterations for 2x window depth.
      const [shallowCalls, deepCalls] = calls
      expect(shallowCalls).toBeLessThanOrEqual(600) // r17: 1_943
      expect(deepCalls).toBeLessThanOrEqual(600) // r17: ~3_372
      expect(deepCalls! - shallowCalls!).toBeLessThanOrEqual(100) // r17: +1_429
    } finally {
      Array.prototype.shift = originalShift
    }
  })
})
