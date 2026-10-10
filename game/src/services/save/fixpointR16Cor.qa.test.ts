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
import type { GameSave } from './SaveSystem'

// ============================================================================
// QA repro - fixpoint r16 COR wave (blind audit of commit ed0f57e9, the r15
// adjudication batch). Two CONFIRMED mint-class defects inside the r15
// "payload epoch" re-expression of the offline cultivation window.
//
// The offline interval is BY DEFINITION the span AFTER the save instant: the
// player saved at `lastSavedAt` (payload epoch) and came back `elapsed`
// seconds later. The adjudication doc itself states the invariant
// "expires <= lastSavedAt" = payload-dead = honestly dead at save time -
// such a record must contribute ZERO cultivation boost to the offline span.
//
// r15 instead computes the epoch shift against the window END
// (`clockSkewMs = max(0, lastSavedAt - authorityNowMs)`) instead of the
// window START. The shifted window therefore lands
//   [lastSavedAt - elapsed, lastSavedAt]   (ends AT the save marker)
// instead of
//   [lastSavedAt, lastSavedAt + elapsed]   (starts AT the save marker).
//
// Every expectation below encodes the honest math (or the documented
// bounded-deny residual where an honest position is unprovable). These
// cases FAILED on ed0f57e9 and now pin the r16 adjudication fix.
// ============================================================================

let currentMs = 1_725_160_000_000

// Same minimal GameSave pattern as player.restoreFromSave.test.ts - the
// action reads save.player only. Mortal realmLevel 12 gives a 7200 required
// budget so the mint is not hidden by the mortal L1 cap (600).
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
      meridian: { progress: {} },
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

// Full-shape save for the validator seam (same shape as
// tests/architecture/betaWriterBoundsTc8.qa.test.ts's validSave()).
function validSave(): Record<string, unknown> {
  const p = createDefaultPlayer()
  p.realmLevel = 12 // mortal - required 7200 keeps the mint visible
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

describe('fixpoint r16 COR - r15 payload-epoch window repros', () => {
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
  // R16-COR-1 - window anchored backward: dead-at-save records mint.
  // ------------------------------------------------------------------
  it('buff chet 250s TRUOC save (dong ho nhanh) phai tra 0% boost - dang mint 25%', () => {
    const player = usePlayerStore()
    // Client clock 10 days fast: every stamp lives in the payload epoch.
    // The TLT record died 250s BEFORE the save marker - honestly it was
    // dead for the ENTIRE offline span and owes 0% boost.
    const fastSavedAt = currentMs + 10 * 86_400_000
    const save = buildMinimalSave({
      cultivationPerSecond: 1, // dead at save -> honest base snapshot
      lastSavedAt: fastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: fastSavedAt - 3_600_000,
          expiresAtMs: fastSavedAt - 250_000, // dead 250s before save
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs - 500_000,
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(500)
    // HONEST: expires <= lastSavedAt -> dead for the whole offline span
    // -> 500s x 1.0 = 500.
    // OBSERVED (defect): the backward window [lastSavedAt - 500s,
    // lastSavedAt] contains the death -> pays 250s x 1.25 + 250s x 1.0
    // = 562.5 (the existing r15-COR-B pin at
    // player.restoreFromSave.test.ts:375 encodes this same mint as
    // "honest").
    expect(result.cultivation).toBe(500)
  })

  it('save marker inside window (skew < elapsed): dead record mints the skew band', () => {
    const player = usePlayerStore()
    // Client clock 400s fast but elapsed 500s: lastSavedAt lands INSIDE
    // the authority window [until - 500s, until], so clockSkewMs = 0 and
    // the window is never shifted into the payload epoch at all.
    // Honest: record dead at realSave - 100s (400s before save in real
    // time) -> 0% boost. The record's payload stamp sits inside the
    // un-shifted window -> mints.
    const save = buildMinimalSave({
      cultivationPerSecond: 1,
      lastSavedAt: currentMs - 100_000, // inside [since, until]
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: currentMs - 400_000,
          expiresAtMs: currentMs - 300_000, // dead 200s before save marker
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs - 500_000,
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(500)
    // HONEST: expires < lastSavedAt -> dead at save -> 500 x 1.0 = 500.
    // OBSERVED (defect): segment [until-500s, until-300s) counts the
    // payload stamp live -> 200s x 1.25 + 300s x 1.0 = 550 (+50 minted).
    expect(result.cultivation).toBe(500)
  })

  // ------------------------------------------------------------------
  // R16-COR-2 - live claim pays the FULL elapsed regardless of the real
  // remaining life (the death can never land inside a window that ends
  // at the save marker).
  // ------------------------------------------------------------------
  it('buff con 60s that su (live claim) phai tra 60s buff + 440s base - dang tra full x1.25', () => {
    const player = usePlayerStore()
    const fastSavedAt = currentMs + 10 * 86_400_000
    const save = buildMinimalSave({
      // Buff honestly live at save -> honest snapshot folds +25%.
      cultivationPerSecond: 12.5,
      lastSavedAt: fastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: fastSavedAt - 3_600_000,
          expiresAtMs: fastSavedAt + 60_000, // dies 60s into the offline span
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs - 500_000,
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(500)
    // FIXED shape: unbuffed = 12.5/1.25 = 10; the live claim's payout
    // bound is the payload-epoch honest-max (lastSavedAt+24h) so the
    // honest 60s tail pays at the live rate ->
    // 60s x 12.5 + 440s x 10 = 5150. r17-COR-B1 removed the residual
    // authority-epoch bound that used to cut the tail under skew.
    expect(result.cultivation).toBe(5150)
  })

  // ------------------------------------------------------------------
  // R16-COR-3 - validator <-> restore probe divergence: the r15-AUT-1
  // bound probes RAW expiresAtMs at lastSavedAt, but restore's
  // percentAtSave probes the CLAMPED payoutExpiresAtMs. Under skew >
  // 24h a live claim reads live for the bound (admits cps = BASE x
  // 1.25) yet reads dead for the divide (unbuffed = claim, not
  // claim/1.25). The r15-AUT-1 invariant "claim <= BASE(1+p) =>
  // unbuffed <= BASE" is broken: the admitted boosted claim is paid
  // FLAT across the authorized window.
  // ------------------------------------------------------------------
  it('crafted skew>24h save: validator admits cps 12.5 qua probe live, restore tra flat 12.5 (khong chia unbuff)', () => {
    const save = validSave()
    const p = save.player as PlayerData
    const forgedSavedAt = currentMs + 25 * 3_600_000 // 25h future = skew > 24h
    p.lastSavedAt = forgedSavedAt
    p.cultivationPerSecond = 12.5 // BASE(10) x (1 + 0.25) - only admissible if TLT probes live
    p.persistentTimedEffects = [
      {
        id: 'fx-tlt',
        sourceItemId: 'tu_linh_tran',
        effectGroup: 'tu_linh_tran',
        appliedAtMs: forgedSavedAt - 1_000,
        expiresAtMs: forgedSavedAt + 60_000, // live claim: 60s past save marker
        cultivationSpeedPercent: 0.25,
        modifiers: [],
      },
    ] as never

    const validation = validateGameSaveShape(save)

    // The crafted shape passes the r15 writer-bound gates: appliedAt <=
    // lastSavedAt, expires >= appliedAt, expires <= lastSavedAt + 24h +
    // 7d, percent 0.25, non-stackable, group/source pinned. The probe
    // reads expires RAW > lastSavedAt -> live -> bound = 12.5 admitted.
    expect(validation.ok).toBe(true)
    if (!validation.ok) return
    const normalized = validation.normalizedSave as GameSave
    expect(normalized.player.cultivationPerSecond).toBe(12.5)

    const player = usePlayerStore()
    const result = player.restoreFromSave(normalized, {
      kind: 'cold-boot',
      sinceMs: currentMs - 500_000,
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(500)
    // FIXED shape: the sample reads the RAW payload stamps at
    // lastSavedAt (same probe as the validator) -> live -> unbuffed =
    // 12.5/1.25 = 10; the claim's payload-epoch bound keeps the 60s
    // tail -> 60s x 12.5 + 440s x 10 = 5150. The r15-AUT-1 invariant
    // holds: the admitted boost is paid un-divided nowhere (pre-fix
    // paid 6250 flat).
    expect(result.cultivation).toBe(5150)
  })

  // ------------------------------------------------------------------
  // R16-AUT-1/-2 - a record dead exactly at the save marker owes 0%:
  // the boundary must sit at the window START, not its end.
  // ------------------------------------------------------------------
  it('record chet DUNG tai moc save (expires == lastSavedAt) tra 0% - dang mint ca window', () => {
    const player = usePlayerStore()
    const fastSavedAt = currentMs + 10 * 86_400_000
    const save = buildMinimalSave({
      cultivationPerSecond: 1,
      lastSavedAt: fastSavedAt,
      persistentTimedEffects: [
        tltRecord({
          appliedAtMs: fastSavedAt - 3_600_000,
          expiresAtMs: fastSavedAt, // dead exactly AT the save marker
        }),
      ],
    })

    const result = player.restoreFromSave(save, {
      kind: 'cold-boot',
      sinceMs: currentMs - 500_000,
      untilMs: currentMs,
    })

    expect(result.elapsedSeconds).toBe(500)
    // HONEST: expires <= lastSavedAt -> dead at save -> 500 x 1.0 = 500.
    // The backward window minted the whole span at x1.25 = 625.
    expect(result.cultivation).toBe(500)
  })
})
