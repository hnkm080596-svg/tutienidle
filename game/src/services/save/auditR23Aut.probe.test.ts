// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { spawnSync } from 'node:child_process'
// @ts-expect-error The project intentionally omits Node ambient types; Vitest supplies this at runtime.
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { PlayerData } from '../../core/player/Player'
import type { PersistentTimedEffect } from '../../core/player/PersistentTimedEffect'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'
import { TU_LINH_TRAN_DURATION_MS } from '../../core/economy/TuLinhTranBalance'
import { accrueCultivationInsight } from '../../core/cultivation/CultivationInsight'
import { validateGameSaveShape } from './saveShapeValidation'
import { importSaveRaw } from './SaveSystem'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import type { GameSave } from './SaveSystem'
import { advanceWorkerLanes } from '../../core/production/WorkerLaneAdvance'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  PRODUCTION_OFFLINE_CAP_SECONDS,
} from '../../core/production/ProductionBalance'
import { pills } from '../../data/pill/pills'

// ============================================================================
// QA repro - fixpoint r23 AUT wave (blind audit of commit da0d553d, the
// r22 batch: |x| < 2^52 admission, stackable exemption removed from BOTH
// restore clamps, writer clamp at 2^52-1, capacity cap, O(1) insight).
//
// Arms assigned this wave:
//  (a) writer clamp edge - max(Date.now(), old) with negative-huge old or
//      crafted duration extraction: NO stamp < -2^52 and no NaN mints -
//      duration comes from the incoming code-stamped effect, old is
//      max()-floored at Date.now(). Probes pin the posture.
//  (b) restore clamp on stackable - both boundTimedEffectClocks (live
//      copy) and payoutExpiresAtMs (payout copy) clamp identically;
//      appliedAt > expires orderings stay dead-arm; payout/restore
//      anchor mismatch (payload epoch vs provenance) is indistinguishable
//      inside the authorized window. Probes pin the posture.
//  (c) 2^52-admitted values in float derivations: derived cursors keep
//      ~2x margin inside the mechanism's 2^53 line; Date.parse-range
//      authority (untilMs up to +/-8.64e15) still lands under the guard
//      or trips it into deny. Probes pin the posture.
//  (d) non-save feeds: importSaveRaw / recovery run the identical
//      validateGameSaveShape gate; advanceWorkerLanes' mechanism guard
//      covers the runtime-API surface the admission bound cannot reach.
//  (e) insight O(1) jump: in-domain (acc < threshold, gained bounded)
//      floor-division is bit-identical to the retired loop; the
//      non-finite-poison residual is unreachable through any admission
//      or runtime feed (gained is always a real cultivation delta).
// ============================================================================

declare const process: { env: Record<string, string | undefined> }

const PILL_ID = 'hoi_linh_dan_qi_refining'
const authored = pills.find((pill) => pill.id === PILL_ID)
const authoredRegen = authored?.effects.find((effect) => effect.type === 'regen')
const AUTHORED_DURATION_S = authoredRegen?.durationSeconds ?? 75
const AUTHORED_MAX_FLAT = (authoredRegen?.mpPerSecond ?? 0) * 1.5
const TWO_POW_52 = 2 ** 52

function validSave(): Record<string, unknown> {
  const p = createDefaultPlayer()
  p.realmId = 'qi_refining'
  p.realmLevel = 1
  p.cultivation = 0
  p.breakthroughGrade = 1
  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: [{ id: 'thien_hoa_cong' }],
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

function craftedStackableEffect(
  expiresAtMs: number,
  appliedAtMs = 1_000,
): PersistentTimedEffect {
  return {
    id: 'fx-craft',
    sourceItemId: PILL_ID,
    appliedAtMs,
    expiresAtMs,
    effectGroup: 'hoi_linh_dan',
    durationStackable: true,
    modifiers: [
      {
        id: 'm1',
        sourceId: 'fx-craft',
        sourceType: 'pill',
        stat: 'manaRegenPerTurn',
        flat: AUTHORED_MAX_FLAT,
        domain: 'spell',
      },
    ],
  }
}

function saveWithEffect(
  expiresAtMs: number,
  appliedAtMs = 1_000,
  lastSavedAt = 1_760_000_000_000,
): Record<string, unknown> {
  const save = validSave()
  const p = save.player as PlayerData
  p.lastSavedAt = lastSavedAt
  p.persistentTimedEffects = [craftedStackableEffect(expiresAtMs, appliedAtMs)]
  return save
}

const gameManager = new GameManager()

describe('fixpoint r23 AUT - stackable/bound/insight residual audit (da0d553d)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    lockBetaFeaturesForTests()
    lockBetaWaysForTests()
    lockBetaTalentsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // ARM (a) - writer clamp edge. The clamp reads `duration` off the
  // INCOMING effect (always code-stamped: Date.now() + authored
  // seconds), then max() floors `old` at Date.now() - a negative-huge
  // persisted expiry or a zero/negative crafted duration can neither
  // mint a stamp < -2^52 nor produce NaN.
  // ------------------------------------------------------------------
  it('A1 negative-huge persisted expiry + honest re-drink re-anchors at now+dur (max floor denies)', () => {
    const player = validSave().player as PlayerData
    const now = 1_760_000_000_000
    // Deep-past admitted stamp in live state (a record the dead-arm
    // clamp passed through verbatim).
    player.persistentTimedEffects = [craftedStackableEffect(-(TWO_POW_52 - 1), -(TWO_POW_52 - 1))]

    vi.spyOn(Date, 'now').mockReturnValue(now)
    gameManager.effectOps.applyTimedEffect(player, {
      id: `pill-regen:${PILL_ID}:${now}`,
      sourceItemId: PILL_ID,
      appliedAtMs: now,
      expiresAtMs: now + AUTHORED_DURATION_S * 1000,
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      modifiers: [],
    })

    const rewritten = player.persistentTimedEffects[0]!
    // max(Date.now(), -4.5e15) = Date.now() -> honest refresh stamp.
    expect(rewritten.expiresAtMs).toBe(now + AUTHORED_DURATION_S * 1000)
    expect(Number.isFinite(rewritten.expiresAtMs)).toBe(true)
  })

  it('A2 zero/negative crafted incoming duration yields duration=0 - expiry can only hold or extend past now', () => {
    const player = validSave().player as PlayerData
    const now = 1_760_000_000_000
    player.persistentTimedEffects = [craftedStackableEffect(now + 5_000, 1_000)]

    vi.spyOn(Date, 'now').mockReturnValue(now)
    // Crafted incoming pair where expires < appliedAt (duration arm
    // floors at 0) - the write can never drag the expiry below now.
    gameManager.effectOps.applyTimedEffect(player, {
      id: `pill-regen:${PILL_ID}:${now}`,
      sourceItemId: PILL_ID,
      appliedAtMs: now + 9_999_999,
      expiresAtMs: now - 9_999_999,
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      modifiers: [],
    })

    const rewritten = player.persistentTimedEffects[0]!
    expect(rewritten.expiresAtMs).toBe(now + 5_000)
  })

  it('A3 hardening note (unreachable): Math.min propagates NaN if duration were NaN - no feed can build it', () => {
    const player = validSave().player as PlayerData
    const now = 1_760_000_000_000
    player.persistentTimedEffects = [craftedStackableEffect(now + 5_000, 1_000)]

    vi.spyOn(Date, 'now').mockReturnValue(now)
    // A NaN incoming stamp is unproducible by every caller (PillSystem
    // stamps Date.now() + authored durationSeconds, TLT/Kiep Thuong the
    // same) - this documents what the writer WOULD emit if one existed:
    // Math.min(2**52-1, NaN) = NaN, which then wedges the next
    // write-time validation. Same latent-hardening class r22 recorded.
    gameManager.effectOps.applyTimedEffect(player, {
      id: `pill-regen:${PILL_ID}:${now}`,
      sourceItemId: PILL_ID,
      appliedAtMs: Number.NaN,
      expiresAtMs: Number.NaN,
      effectGroup: 'hoi_linh_dan',
      durationStackable: true,
      modifiers: [],
    })

    expect(Number.isNaN(player.persistentTimedEffects[0]!.expiresAtMs)).toBe(true)
  })

  it('A4 non-stackable arm cannot push a sub-pin stamp out of domain (max, not add)', () => {
    const player = validSave().player as PlayerData
    const now = 1_760_000_000_000
    // Parked near-bound expiry admitted inside |x| < 2^52.
    player.persistentTimedEffects = [
      {
        id: 'fx-tlt',
        sourceItemId: 'tu_linh_tran',
        appliedAtMs: 1_000,
        expiresAtMs: TWO_POW_52 - 1,
        effectGroup: 'tu_linh_tran',
        cultivationSpeedPercent: 0.25,
        modifiers: [],
      },
    ]

    vi.spyOn(Date, 'now').mockReturnValue(now)
    gameManager.effectOps.applyTimedEffect(player, {
      id: 'tu_linh_tran',
      sourceItemId: 'tu_linh_tran',
      appliedAtMs: now,
      expiresAtMs: now + TU_LINH_TRAN_DURATION_MS,
      effectGroup: 'tu_linh_tran',
      cultivationSpeedPercent: 0.25,
      modifiers: [],
    })

    const rewritten = player.persistentTimedEffects[0]!
    // max() only - the parked stamp survives in-domain and the save
    // still validates (deny-direction park, accepted residual).
    expect(rewritten.expiresAtMs).toBe(TWO_POW_52 - 1)
  })

  // ------------------------------------------------------------------
  // ARM (b) - restore clamp on stackable: every reader sees a clamped
  // copy. boundTimedEffectClocks owns the live array;
  // payoutExpiresAtMs owns the payout read; the dead arm
  // (expires <= lastSavedAt) clamps at the field clock, the live arm at
  // provenance + 24h - stackable records take both arms like every
  // class (r22 fix posture re-pinned).
  // ------------------------------------------------------------------
  it('B1 far-future stackable expiry clamps on BOTH copies - no reader escapes', () => {
    const playerStore = usePlayerStore()
    const lastSavedAt = 1_760_000_000_000
    const expires = lastSavedAt + 30 * 86_400_000 // +30d: sub-pin, way past class window
    const save = saveWithEffect(expires, 1_000, lastSavedAt)
    expect(validateGameSaveShape(save).ok).toBe(true)

    playerStore.restoreFromSave(save as unknown as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: lastSavedAt + 60_000,
    })

    // Live copy: clamped at provenance(lastSavedAt) + 24h.
    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(lastSavedAt + TU_LINH_TRAN_DURATION_MS)

    // Payout copy runs inside restoreFromSave's offline grant; assert
    // no segment past the bound would pay: at lastSavedAt + 25h the
    // record reads dead on the live path too.
    const live = gameManager.effectOps.getActiveTimedModifiers(
      playerStore.$state as PlayerData,
      lastSavedAt + TU_LINH_TRAN_DURATION_MS + 1,
    )
    expect(live.some((modifier) => modifier.stat === 'manaRegenPerTurn')).toBe(false)
  })

  it('B2 appliedAt > expires ordering (unpinned on regen) restores dead - no mint', () => {
    const playerStore = usePlayerStore()
    const lastSavedAt = 1_760_000_000_000
    // Reversed pair admitted: appliedAt <= lastSavedAt is the only
    // ordering pin on regen records; expires < appliedAt is legal.
    const save = saveWithEffect(2_000, 1_500_000_000_000, lastSavedAt)
    expect(validateGameSaveShape(save).ok).toBe(true)

    playerStore.restoreFromSave(save as unknown as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: lastSavedAt + 60_000,
    })

    // expires <= lastSavedAt -> dead arm -> clamped at
    // min(expires, now) = 2000 - dead at every epoch.
    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBe(2_000)
    expect(stored.appliedAtMs).toBe(1_500_000_000_000)
    const live = gameManager.effectOps.getActiveTimedModifiers(
      playerStore.$state as PlayerData,
      lastSavedAt,
    )
    expect(live.length).toBe(0)
  })

  it('B3 deep-past lastSavedAt anchors: a crafted live claim in the payload epoch still restores dead', () => {
    const playerStore = usePlayerStore()
    const lastSavedAt = -4e15 // admitted (< 2^52), epoch deeply negative
    // expires > lastSavedAt -> "live" arm in payload epoch; provenance
    // = min(-4e15, authorityNow) = -4e15 -> bound = -4e15 + 24h: dead.
    const save = saveWithEffect(lastSavedAt + 1_000, lastSavedAt - 2_000, lastSavedAt)
    expect(validateGameSaveShape(save).ok).toBe(true)

    playerStore.restoreFromSave(save as unknown as GameSave, {
      kind: 'cold-boot',
      sinceMs: lastSavedAt,
      untilMs: lastSavedAt + 60_000,
    })

    const stored = playerStore.persistentTimedEffects[0]!
    expect(stored.expiresAtMs).toBeLessThan(0)
    expect(stored.expiresAtMs).toBeGreaterThanOrEqual(lastSavedAt)
    const live = gameManager.effectOps.getActiveTimedModifiers(
      playerStore.$state as PlayerData,
      Date.now(),
    )
    expect(live.length).toBe(0)
  })

  it('B4 far-future lastSavedAt + live-epoch expiry clamps at provenance+24h (<= authored window)', () => {
    const playerStore = usePlayerStore()
    const lastSavedAt = 4e15 // admitted (< 2^52), epoch far future
    const expires = lastSavedAt + 1_000 // live arm (> lastSavedAt)
    const save = saveWithEffect(expires, 1_000, lastSavedAt)
    expect(validateGameSaveShape(save).ok).toBe(true)

    const now = 1_760_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)

    // Legacy (undefined) authority: provenance = min(4e15, now) = now.
    playerStore.restoreFromSave(save as unknown as GameSave)

    const stored = playerStore.persistentTimedEffects[0]!
    // Live bound = provenance + 24h = now + 24h - the mint is the
    // authored class window at most, never the claimed 4e15 span.
    expect(stored.expiresAtMs).toBeLessThanOrEqual(now + TU_LINH_TRAN_DURATION_MS)
    expect(stored.expiresAtMs).toBeGreaterThan(now)
  })

  // ------------------------------------------------------------------
  // ARM (c) - 2^52-admitted values feeding float derivations beyond
  // offlineSinceMs: mechanism-level derivations keep real margin.
  // ------------------------------------------------------------------
  it('C1 authority-clock edge: Date.parse-range untilMs (8.6e15) still trips the mechanism guard into deny', () => {
    // untilMs comes through Date.parse - bounded at +/-8.64e15, inside
    // the mechanism's |x| < 2^53 line (9.007e15). A value just over the
    // line trips the guard into zero-advance (deny, not wedge).
    const overLine = 9.1e15
    const denied = advanceWorkerLanes({
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: 100,
      cycleMs: 100_000,
      pending: [],
      slots: 1,
      nowMs: overLine,
      emptyLaneStartMs: -4e15,
      advanceMode: 'deadline',
      budgetMs: PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    })
    expect(denied.completed.length).toBe(0)

    // A Date.parse-range until under the guard still settles - and the
    // budget, not the clock, bounds the mint.
    const underLine = 8.6e15
    const settled = advanceWorkerLanes({
      siteId: 'probe',
      collectionRealmId: 'mortal',
      siteLevel: 1,
      baseSeconds: CYCLE_BASE_SECONDS_BY_REALM['mortal']!,
      cycleMs: 100_000,
      pending: [],
      slots: 1,
      nowMs: underLine,
      emptyLaneStartMs: -4e15,
      advanceMode: 'deadline',
      budgetMs: PRODUCTION_OFFLINE_CAP_SECONDS * 1000,
    })
    expect(settled.completed.length).toBeLessThanOrEqual(
      Math.ceil((PRODUCTION_OFFLINE_CAP_SECONDS * 1000) / 100_000) + 1,
    )
  })

  it('C2 near-bound admitted cursors still advance the smallest authored deltas (no float absorb)', () => {
    const edge = TWO_POW_52 - 1
    // ULP at [2^51, 2^52) is 1 - every authored ms delta advances.
    expect(edge + 22_000).toBeGreaterThan(edge)
    expect(edge + 75_000).toBeGreaterThan(edge)
    // A persisted expiry at the bound minus an honest appliedAt keeps
    // a POSITIVE span (writer duration extraction cannot sign-flip).
    expect(edge - 1_000).toBeGreaterThan(0)
  })

  it('C3 capacity + pity/kill counter pins: capacity bounded, honest-shape counters unbounded (documented residual)', () => {
    const withCapacity = (capacity: number) => {
      const save = validSave()
      ;(save.player as PlayerData).autoWorkerCapacity = capacity
      // F-W-16: capacity > 0 requires the chi_hien_quan witness.
      save.buildings = [
        { instanceId: 'r23_b1', buildingId: 'chi_hien_quan', level: 1, lastCollectedAt: 0 },
      ]
      return validateGameSaveShape(save).ok
    }
    expect(withCapacity(65_537)).toBe(false)
    expect(withCapacity(65_536)).toBe(true)

    // Accepted residual classes re-verified at this tip: honest-shape
    // counters the gate cannot bound (pity, kills, currencies) admit
    // crafted values but pay only their authored bounded outcome.
    const pity = validSave()
    ;(pity.player as PlayerData).companionPullsSinceRare = 1e18
    expect(validateGameSaveShape(pity).ok).toBe(true)

    const kills = validSave()
    ;(kills.player as PlayerData).hiddenBeastKills = { huyet_mong: 1e9 }
    expect(validateGameSaveShape(kills).ok).toBe(true)
  })

  // ------------------------------------------------------------------
  // ARM (d) - non-save feeds reach mechanism guards only through
  // validated gates: importSaveRaw runs the same admission; the
  // worker-lane mechanism re-guards its own params.
  // ------------------------------------------------------------------
  it('D1 importSaveRaw applies the same admission gate (no bypass)', () => {
    const bad = saveWithEffect(9e15)
    const raw = JSON.stringify(bad)
    // Import path -> same validateGameSaveShape - a crafted expiry is
    // rejected identically to a disk save.
    expect(importSaveRaw(raw)).toBe(false)
  })

  // ------------------------------------------------------------------
  // ARM (e) - the O(1) insight jump is bit-identical to the retired
  // loop inside the reachable domain; the non-finite-poison path is
  // unreachable through any save or runtime feed.
  // ------------------------------------------------------------------
  it('E1 floor-division equals the retired while-loop across the reachable domain', () => {
    // Reachable domain: acc < threshold at admission, gained bounded by
    // the cps claim (<= ~1e11 per call). Scan the domain edge to edge.
    const threshold = 2_000
    const cases: Array<[number, number]> = [
      [0, 1],
      [1_999, 1],
      [1_999, 1_999],
      [1_999, 2_000],
      [0, 1e9],
      [1_999, 1e11],
      [500, 4_500.5], // fractional gain
      [0, threshold * 10 - 1],
    ]
    for (const [startAcc, gained] of cases) {
      const player = createDefaultPlayer()
      player.selectedTalentIds = ['ngo_dao']
      player.cultivationInsightAccumulator = startAcc
      accrueCultivationInsight(player, gained)

      // Reference: the retired while-loop semantics on the same inputs.
      let refAcc = startAcc + gained
      let refSteps = 0
      while (refAcc >= threshold) {
        refAcc -= threshold
        refSteps += 1
      }
      expect(player.cultivationInsightAccumulator).toBe(refAcc)
      expect(player.skillInsight).toBe(refSteps)
      expect(player.totalSkillInsightGained).toBe(refSteps)
    }
  })

  it('E2 non-finite acc poison: guard returns without reset - latent nit, unreachable via save', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao']
    player.cultivationInsightAccumulator = 0
    // gained = Infinity is unproducible through either caller (tick
    // gained is a real cultivation delta; offline gained the same).
    // The mechanism documents the latent state: acc stays poisoned,
    // every later accrual is a no-op, and the NEXT write-time
    // validation rejects the save - self-wedge if ever reached.
    accrueCultivationInsight(player, Number.POSITIVE_INFINITY)
    expect(player.cultivationInsightAccumulator).toBe(Number.POSITIVE_INFINITY)

    const save = validSave()
    ;(save.player as PlayerData).cultivationInsightAccumulator = Number.POSITIVE_INFINITY
    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})
