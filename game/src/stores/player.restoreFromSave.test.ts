import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'

// QA-002 (Task 9.2) — restoreFromSave phải idempotent theo payload: cùng
// save gọi lại = no-op, save khác = áp đầy đủ. Helper nội bộ (pattern
// player.aiStrategy.test.ts) — đủ shape để action không crash, KHÔNG đi
// qua loadGame/validator.
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
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    unlockedElements: [],
    equippedElements: [],
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

// Đồng hồ giả — 2 lần restore liên tiếp trong test thật sẽ chạy cách nhau
// vài ms nên không mock Date.now thì pre-fix không thất bại ổn định (elapsed
// gần như 0). Kiểm soát currentMs để khoảng offline là số nguyên xác định
// (dưới trần Phàm Nhân tầng 1 = 600 → không bị clamp che mất double-credit).
let currentMs = 1_725_160_000_000

describe('player.restoreFromSave — idempotency (QA-002, Task 9.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    currentMs = 1_725_160_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gọi 2 lần CÙNG save → offline cultivation chỉ cộng 1 lần', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({ lastSavedAt: currentMs - 30_000, cultivationPerSecond: 10 })

    const first = player.restoreFromSave(save)
    const cultivationAfterFirst = player.cultivation

    currentMs += 10_000 // thời gian trôi — payload Y HỆT vẫn phải được nhận diện là no-op

    const second = player.restoreFromSave(save)

    expect(second.cultivation).toBe(first.cultivation)
    expect(second.elapsedSeconds).toBe(first.elapsedSeconds)
    expect(player.cultivation).toBe(cultivationAfterFirst)
  })

  it('gọi lại với save KHÁC (lastSavedAt mới hơn) → áp đầy đủ', () => {
    const player = usePlayerStore()
    const save1 = buildMinimalSave({ lastSavedAt: currentMs - 60_000, cultivationPerSecond: 10 })
    player.restoreFromSave(save1)

    currentMs += 30_000
    // lastSavedAt = T0 + 30s - 60s = T0 - 30s — khác hẳn save1 (T0 - 60s)
    const save2 = buildMinimalSave({ lastSavedAt: currentMs - 60_000, cultivationPerSecond: 20 })
    const result = player.restoreFromSave(save2)

    expect(result.cultivation).toBe(1_200) // 20/s * 60s — full apply, không bị guard chặn
    expect(result.elapsedSeconds).toBe(60)
    expect(player.cultivationPerSecond).toBe(20) // Object.assign của save2 đã chạy
  })

  it('guard không phá normalization: nodeLevels fallback + attackRange vẫn chạy', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({})
    save.player.nodeLevels = undefined as never // simulate save cũ thiếu field

    player.restoreFromSave(save)

    expect(player.nodeLevels).toEqual({})
    expect(player.baseStats.attackRange).toBeGreaterThan(0)
  })
})
