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

  it('guard không phá normalization: nodeLevels fallback vẫn chạy', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({})
    save.player.nodeLevels = undefined as never // simulate save cũ thiếu field

    player.restoreFromSave(save)

    expect(player.nodeLevels).toEqual({})
    expect(player.baseStats.might).toBeGreaterThan(0)
  })

  // Stat-key migration (stat-system-reimagined rename pass) — saves
  // written under the old key names must come back with renamed keys,
  // retired keys dropped, and modifier stat fields remapped.
  it('save cũ với stat key cũ → migrate sang key mới, key retired bị drop', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      baseStats: { attack: 10, attackRange: 1, maxMpPercent: 0.2, defense: 7 },
      modifiers: [
        {
          id: 'm1',
          sourceId: 's1',
          sourceType: 'equipment',
          stat: 'attack',
          flat: 5,
        },
        {
          id: 'm2',
          sourceId: 's2',
          sourceType: 'equipment',
          stat: 'manaRegenPerSecond',
          flat: 1,
        },
      ],
      persistentTimedEffects: [
        {
          id: 'fx1',
          modifiers: [
            {
              id: 'fx1_m',
              sourceId: 'fx1',
              sourceType: 'pill',
              stat: 'speedMultiplier',
              percent: 10,
            },
          ],
        },
      ],
    })

    player.restoreFromSave(save)

    expect(player.baseStats.might).toBe(10)
    expect(player.baseStats.defense).toBe(7)
    expect('attack' in player.baseStats).toBe(false)
    // Task 3: retired keys are gone from StatType entirely — the saved
    // value drops AND no baseline key fills back in.
    expect('maxMpPercent' in player.baseStats).toBe(false)
    expect('attackRange' in player.baseStats).toBe(false)

    expect(player.modifiers.map((modifier) => modifier.stat)).toEqual([
      'might',
      'manaRegenPerTurn',
    ])
    expect(player.persistentTimedEffects[0]!.modifiers[0]!.stat).toBe(
      'productionSpeedMultiplier',
    )
  })

  // M1 (ARCH-001) — the player slice is REPLACE semantics too: fields the
  // payload does not declare must reset to defaults instead of keeping the
  // previous session's values (a bare Object.assign merge leaked them).
  it('fields absent from the payload reset to defaults — no stale optional state survives a restore', () => {
    const player = usePlayerStore()

    // Simulate a previous session that set every optional field.
    player.cultivationPath = 'kiem_tu'
    player.kiemTu = { mode: 'ngu', preset: ['orb_bo'], kiemY: 5, kiemDaoCount: 2, kiemDaoBase: 1 }
    player.artifact = { artifactId: 'a', tier: 1, exp: 5 } as never
    player.highestFoundationAchieved = 'great_dao' as never
    player.formationLoadout = { formationId: 'f', assignments: [{ row: 0, column: 0, combatantId: 'c' }] }
    player.autoFarmStage = { stageId: 's', lastCheckedMs: 1 }
    player.companions = [{ companionId: 'c', constellation: 0 } as never]

    const save = buildMinimalSave({}) // declares none of the above
    player.restoreFromSave(save)

    expect(player.cultivationPath).toBeUndefined()
    expect(player.kiemTu).toBeUndefined()
    expect(player.artifact).toBeUndefined()
    expect(player.highestFoundationAchieved).toBeUndefined()
    expect(player.formationLoadout).toBeNull()
    expect(player.autoFarmStage).toBeNull()
    expect(player.companions).toEqual([])
  })

  // M1 (ARCH-001) — identity commits only AFTER the whole apply succeeds:
  // a throw mid-restore must leave the payload uncommitted so a retry with
  // the same payload re-applies instead of being skipped by the guard.
  it('a failure before apply completes does not commit identity — the same payload retries cleanly', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({ name: 'retry-me' })

    const cloneSpy = vi.spyOn(globalThis, 'structuredClone').mockImplementationOnce(() => {
      throw new Error('injected clone failure')
    })

    expect(() => player.restoreFromSave(save)).toThrow('injected clone failure')
    expect(player.name).toBe('Vô Danh') // pre-apply failure changed nothing
    cloneSpy.mockRestore()

    const result = player.restoreFromSave(save)
    expect(player.name).toBe('retry-me')

    // Identity committed on success — a third call converges via the guard.
    expect(player.restoreFromSave(save)).toEqual(result)
  })
})
