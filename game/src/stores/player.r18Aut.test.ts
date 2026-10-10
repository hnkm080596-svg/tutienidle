import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'

// QA r18-AUT (audit commit cef2af9e) - adversarial repro for the r17-COR-B1
// "claim's own duration" bound. Fixture mirrors buildMinimalSave in
// player.restoreFromSave.test.ts (shape-sufficient, KHONG qua validator).
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

const HOUR_MS = 3_600_000

describe('player.restoreFromSave - r18-AUT adversarial (cef2af9e)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // R18-AUT-1: r17-COR-B1 bound every non-stackable live claim at
  // appliedAt + TU_LINH_TRAN_DURATION_MS. applyTimedEffect keeps
  // appliedAtMs at the FIRST application while each rebuy max-extends
  // expiresAtMs (GameManagerPersistentEffectOps.applyTimedEffect,
  // existing.expiresAtMs = max(existing, new)) - so the honest shape of
  // a refreshed Tu Linh Tran is {appliedAt = firstBuy, expires =
  // lastBuy + 24h}, a span legitimately LONGER than one duration. The
  // shape validator documents exactly this honest class (r13-COR-1:
  // "an honest repeat purchase legitimately produces a span beyond
  // TU_LINH_TRAN_DURATION_MS"; only expires < appliedAt and expires >
  // lastSavedAt + 24h + 7d are impossible). The r17 bound clamps the
  // stored stamp to firstBuy + 24h - deleting a live PAID buff and
  // stripping the same tail from the offline payout.
  it('R18-AUT-1: honest TLT refresh chain keeps its paid tail (stored + payout)', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 20_000
    const firstBuyAt = lastSavedAt - 30 * HOUR_MS
    const lastRebuyAt = lastSavedAt - 2 * HOUR_MS

    const save = buildMinimalSave({
      cultivationPerSecond: 12.5, // honest buffed snapshot (10 x 1.25)
      lastSavedAt,
      persistentTimedEffects: [
        {
          id: 'fx-tlt-chain',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          // Honest refresh-chain shape: applied 30h ago, rebought 2h
          // before the save -> expires = lastRebuy + 24h = save + 22h.
          // Passes every validator pin: appliedAt <= lastSavedAt,
          // expires >= appliedAt, expires <= lastSavedAt + 24h + 7d.
          appliedAtMs: firstBuyAt,
          expiresAtMs: lastRebuyAt + 24 * HOUR_MS,
          cultivationSpeedPercent: 0.25,
          modifiers: [],
        },
      ],
    })

    const result = player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    // Honest outcome: the stored deadline is the paid expiry
    // (lastRebuy + 24h) - the buff stays live 22h past the save.
    expect(effect.expiresAtMs).toBe(lastRebuyAt + 24 * HOUR_MS)

    // Honest payout: 20s window fully buffed at 12.5/s unbuffed-back
    // -> 10 * (1 + 0.25) * 20 = 250. Truncated bound pays 10 * 20 = 200.
    expect(result.cultivation).toBe(250)
  })

  // Same chain, minimal window so the stored-buff death is the whole
  // signal: the clamped stamp lands in the past and tickTimedEffects
  // reaps the record on the next tick.
  it('R18-AUT-1b: stored clamp must not move a live paid buff into the past', () => {
    const player = usePlayerStore()
    const lastSavedAt = currentMs - 1_000
    const firstBuyAt = lastSavedAt - 26 * HOUR_MS

    const save = buildMinimalSave({
      lastSavedAt,
      persistentTimedEffects: [
        {
          id: 'fx-tlt-chain-2',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: firstBuyAt,
          expiresAtMs: lastSavedAt + 2 * HOUR_MS, // rebought 22h ago
          cultivationSpeedPercent: 0.25,
          modifiers: [],
        },
      ],
    })

    player.restoreFromSave(save)

    const effect = player.persistentTimedEffects[0]!
    // appliedAt + 24h lands 2h BEFORE the save marker - the r17 bound
    // drags a live 2h-remaining buff to dead-at-boot.
    expect(effect.expiresAtMs).toBeGreaterThan(currentMs)
    expect(effect.expiresAtMs).toBe(lastSavedAt + 2 * HOUR_MS)
  })
})
