import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'

// Combat AI strategy save/restore (plan §10): PlayerData là authority;
// restore validate — save thiếu field hoặc giá trị sai dùng 'nearest'.
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
    unlockedRealmEnhancements: [],
    hasSeenTutorial: false,
    isCultivating: false,
    totalCultivationGained: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    unlockedElements: [],
    equippedElements: [],
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

describe('player store — combatAiStrategy restore fallback (plan §10.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('save có giá trị hợp lệ → giữ nguyên', () => {
    const store = usePlayerStore()

    store.restoreFromSave(buildMinimalSave({ combatAiStrategy: 'boss_first' }))

    expect(store.combatAiStrategy).toBe('boss_first')
  })

  it('save thiếu field → fallback nearest', () => {
    const store = usePlayerStore()

    store.restoreFromSave(
      buildMinimalSave({ combatAiStrategy: undefined }),
    )

    expect(store.combatAiStrategy).toBe('nearest')
  })

  it('save có giá trị sai → fallback nearest', () => {
    const store = usePlayerStore()

    store.restoreFromSave(buildMinimalSave({ combatAiStrategy: 'aggressive' }))

    expect(store.combatAiStrategy).toBe('nearest')
  })
})
