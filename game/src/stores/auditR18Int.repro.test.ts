// AUDIT REPRO (r18-INT, audit-only - not part of the suite's pins).
// r17-COR-B1 bound regression: applyTimedEffect's non-stackable merge
// keeps appliedAtMs at the FIRST application and max-extends
// expiresAtMs on rebuy, so an honest repeat purchase legitimately
// produces expires - appliedAt > TU_LINH_TRAN_DURATION_MS (the shape
// validator's own comment calls out as honest). The new duration bound
// min(appliedAt, ...) + duration kills such a record outright.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'

function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 4,
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
    bodyProgression: { body_refinement: { completedTiers: 0, currentTierProgress: 0 }, meridian: { progress: {} } },
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

let currentMs = 1_725_160_000_000

describe('r18-INT repro - r17 duration bound vs honest rebuy chain', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Honest shape: TLT bought 30h ago (appliedAt), re-bought ~1h ago so
  // expires = lastRebuy + 24h = now + 23h. Span = 53h > 24h - honest
  // under applyTimedEffect's merge, admitted by the validator (+7d
  // allowance). r17 stored bound min(appliedAt, authorityNow)+24h
  // clamps expires to appliedAt+24h = 6h in the PAST -> live buff dies.
  it('STORED: honest rebuy chain buff survives restore (fails on r17)', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 100_000
    const save = buildMinimalSave({
      lastSavedAt,
      cultivationPerSecond: 4,
      persistentTimedEffects: [
        {
          id: 'tlt1',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: currentMs - 30 * 3_600_000, // 30h ago (first buy)
          expiresAtMs: currentMs + 23 * 3_600_000, // rebuy ~1h ago -> +24h
          cultivationSpeedPercent: 0.25,
          modifiers: [],
        },
      ],
    })

    player.restoreFromSave(save)

    const stored = player.persistentTimedEffects.find((e) => e.effectGroup === 'tu_linh_tran')
    // Honest: the buff still has ~23h of real life left.
    expect(stored?.expiresAtMs).toBeGreaterThan(currentMs)
  })

  // Same shape through the payout copy: the offline window should pay
  // the live rate for its whole width, but the payout bound
  // min(appliedAt, lastSavedAt)+24h dies before the window starts.
  it('PAYOUT: honest rebuy chain pays the buffed rate (fails on r17)', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 100_000
    const save = buildMinimalSave({
      lastSavedAt,
      // Snapshot folds the +25% buff: base 3.2 x 1.25 = 4.
      cultivationPerSecond: 4,
      persistentTimedEffects: [
        {
          id: 'tlt1',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: currentMs - 30 * 3_600_000,
          expiresAtMs: currentMs + 23 * 3_600_000,
          cultivationSpeedPercent: 0.25,
          modifiers: [],
        },
      ],
    })

    const result = player.restoreFromSave(save)

    expect(result.elapsedSeconds).toBe(100)
    // Honest: 100s x buffed 4/s = 400. r17 pays flat 100s x 3.2 = 320.
    expect(result.cultivation).toBe(400)
  })
})
