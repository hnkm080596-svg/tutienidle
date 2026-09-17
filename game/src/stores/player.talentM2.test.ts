import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'

// Talent v4 M2 (spec §4.3) — store-level hooks:
// - Hau Tich Bat Phat: cultivation ramp per realmLevel inside cultivate().
// - Ngo Dao: the insight_per_cultivation accumulator also settles the
//   OFFLINE cultivation grant inside restoreFromSave().
// - Hai Nap: the offline grant routes through addCultivation so the
//   overflow bank works offline too.
function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 10,
    cultivationOvercharge: 0,
    tribulationBonusStacks: 0,
    nodeFreePurchaseRecord: {},
    phaGiapCarryStacks: 0,
    phaGiapCarryRealmId: null,
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
    bodyRefinementCompletedTiers: 0,
    bodyRefinementCurrentTierProgress: 0,
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

describe('player store — talent v4 M2 (Hau Tich / Ngo Dao offline)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Hau Tich Bat Phat — tang 1 chain nua, tang sau tang nhanh dan', () => {
    const store = usePlayerStore()
    store.realmId = 'qi_refining'
    store.realmLevel = 1
    store.cultivation = 0
    store.selectedTalentIds = ['ho_tich_bat_phat']

    store.cultivate(100) // base 10/s * 100s = 1000, ramp t1 = x0.5 → 500

    expect(store.cultivation).toBe(500)
  })

  it('Hau Tich Bat Phat — tang 11 ramp x1.5, tang 12 ramp x1.6', () => {
    const store = usePlayerStore()
    store.realmId = 'qi_refining'
    store.selectedTalentIds = ['ho_tich_bat_phat']

    store.realmLevel = 11
    store.cultivation = 0
    store.cultivate(10) // 100 raw -> x1.5 = 150
    expect(store.cultivation).toBe(150)

    store.realmLevel = 12
    store.cultivation = 0
    store.cultivate(10) // 100 raw -> x1.6 = 160
    expect(store.cultivation).toBe(160)
  })

  it('khong co talent — cultivate giu nguyen toc do goc', () => {
    const store = usePlayerStore()
    store.realmId = 'qi_refining'
    store.realmLevel = 1
    store.cultivation = 0

    store.cultivate(100)

    expect(store.cultivation).toBe(1000)
  })

  it('Ngo Dao offline — tu vi ngoai tuyen quy doi Cam Ngo theo cung nguong', () => {
    const store = usePlayerStore()
    const save = buildMinimalSave({
      realmId: 'qi_refining',
      realmLevel: 1,
      selectedTalentIds: ['ngo_dao'],
      cultivationPerSecond: 10,
      lastSavedAt: currentMs - 1_000_000, // 1000s offline -> 10000 tu vi -> 5 insight
    })

    store.restoreFromSave(save)

    expect(store.skillInsight).toBe(5)
    expect(store.totalSkillInsightGained).toBe(5)
    expect(store.cultivationInsightAccumulator).toBe(0)
  })

  it('khong co Ngo Dao — offline cultivation khong sinh Cam Ngo', () => {
    const store = usePlayerStore()
    const save = buildMinimalSave({
      realmId: 'qi_refining',
      realmLevel: 1,
      cultivationPerSecond: 10,
      lastSavedAt: currentMs - 1_000_000,
    })

    store.restoreFromSave(save)

    expect(store.skillInsight).toBe(0)
    expect(store.cultivationInsightAccumulator).toBe(0)
  })

  it('Ngo Dao offline — idempotent: restore lai cung save khong cong them insight', () => {
    const store = usePlayerStore()
    const save = buildMinimalSave({
      realmId: 'qi_refining',
      realmLevel: 1,
      selectedTalentIds: ['ngo_dao'],
      cultivationPerSecond: 10,
      lastSavedAt: currentMs - 1_000_000,
    })

    store.restoreFromSave(save)
    const insightAfterFirst = store.skillInsight

    currentMs += 10_000
    store.restoreFromSave(save)

    expect(store.skillInsight).toBe(insightAfterFirst)
  })

  it('Ngo Dao — online va offline di QUA CUNG mot accrual: cung gained cho ket qua giong het nhau', () => {
    // 2500 tu vi -> 1 Cam Ngo + 500 remainder, regardless of path.
    const online = usePlayerStore()
    online.realmId = 'qi_refining'
    online.realmLevel = 1
    online.cultivation = 0
    online.selectedTalentIds = ['ngo_dao']
    online.cultivate(250) // 10/s * 250s = 2500 tu vi

    setActivePinia(createPinia())
    const offline = usePlayerStore()
    offline.restoreFromSave(buildMinimalSave({
      realmId: 'qi_refining',
      realmLevel: 1,
      selectedTalentIds: ['ngo_dao'],
      cultivationPerSecond: 10,
      lastSavedAt: currentMs - 250_000, // 250s offline -> 2500 tu vi
    }))

    expect(online.skillInsight).toBe(1)
    expect(offline.skillInsight).toBe(1)
    expect(online.cultivationInsightAccumulator).toBe(500)
    expect(offline.cultivationInsightAccumulator).toBe(500)
    expect(online.totalSkillInsightGained).toBe(offline.totalSkillInsightGained)
  })
})
