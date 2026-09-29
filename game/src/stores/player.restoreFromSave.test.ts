import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import { createBaseStats } from '../core/stats/StatBlock'
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
    hasSeenTutorial: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    nodeLevels: {},
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyProgression: { body_refinement: { completedTiers: 0, currentTierProgress: 0 }, meridian: { openedIds: [] } },
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

  // T3-26 - the returned OfflineResult must report the ACTUAL post-cap
  // delta (what addCultivation really credited), not the theoretical
  // elapsed*rate figure. The modal renders this number.
  it('reports actual post-cap offline cultivation, not theoretical', () => {
    const player = usePlayerStore()
    // Mortal L1 required = 600; seed 500 and a theoretical grant far past it.
    const save = buildMinimalSave({
      cultivation: 500,
      cultivationPerSecond: 10,
      lastSavedAt: currentMs - 300_000, // theoretical = 3000, cap headroom = 100
    })

    const result = player.restoreFromSave(save)

    expect(result.cultivation).toBe(100)
    expect(result.elapsedSeconds).toBe(300)
    // The identity-guard replay must return the corrected value too.
    expect(player.restoreFromSave(save).cultivation).toBe(100)
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

    expect(result.cultivation).toBe(600) // 20/s * 60s = 1200 theoretical, clamped at mortal L1 required = 600
    expect(result.elapsedSeconds).toBe(60)
    expect(player.cultivationPerSecond).toBe(20) // Object.assign của save2 đã chạy
  })

  // EM-02 - the save's cultivationPerSecond already folds the Tu Linh
  // Tran buff in; a buff expiring mid-offline-window must stop paying,
  // not get boosted-rate x the whole window.
  it('buff tu luyện hết hạn giữa offline → chỉ đoạn còn sống được buff (EM-02)', () => {
    const player = usePlayerStore()
    const windowMs = 30_000
    const save = buildMinimalSave({
      // base rate 10/s x (1 + 1.0) buff -> snapshot 20/s.
      cultivationPerSecond: 20,
      lastSavedAt: currentMs - windowMs,
      persistentTimedEffects: [
        {
          id: 'fx1',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: currentMs - windowMs - 10_000,
          expiresAtMs: currentMs - windowMs + 10_000, // dies after 10s offline
          cultivationSpeedPercent: 1,
          modifiers: [],
        },
      ],
    })

    const result = player.restoreFromSave(save)

    // 10*(1+1)*10s + 10*20s = 400 (< cap 600); pre-fix = 20*30 = 600.
    expect(result.cultivation).toBe(400)
    expect(result.elapsedSeconds).toBe(30)
  })

  it('buff tu luyện đã hết hạn trước khi save → snapshot cũ không được trả tiếp phần buff (F-BX-30)', () => {
    const player = usePlayerStore()
    // Snapshot 20/s was written by the last tick while the buff still
    // lived; the buff died inside the (last tick -> save] gap, so the
    // snapshot is stale high. The restore must re-derive the un-buffed
    // base from the saved fields (10/s), never trust the snapshot.
    const save = buildMinimalSave({
      cultivationPerSecond: 20,
      lastSavedAt: currentMs - 20_000,
      persistentTimedEffects: [
        {
          id: 'fx1',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: 0,
          expiresAtMs: currentMs - 200_000, // dies before the save
          cultivationSpeedPercent: 1,
          modifiers: [],
        },
      ],
    })

    const result = player.restoreFromSave(save)

    // BASE 10/s x 20s = 200; the stale boosted snapshot would pay 400.
    expect(result.cultivation).toBe(200)
  })

  it('buff tu luyện sống lúc save nhưng snapshot chưa kịp buff → vẫn được trả phần buff (F-BX-30 chiều ngược)', () => {
    const player = usePlayerStore()
    // Reverse staleness: the buff activated inside the (last tick ->
    // save] gap, so the 10/s snapshot folds NO buff while the saved
    // effect list already holds it. Un-buffing the snapshot by the live
    // percent would underpay to 5/s; the honest base stays 10/s and the
    // segment pays the live percent.
    const save = buildMinimalSave({
      cultivationPerSecond: 10,
      lastSavedAt: currentMs - 20_000,
      persistentTimedEffects: [
        {
          id: 'fx1',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: currentMs - 20_000 - 500,
          expiresAtMs: currentMs + 999_000_000, // live past window end
          cultivationSpeedPercent: 1,
          modifiers: [],
        },
      ],
    })

    const result = player.restoreFromSave(save)

    // 10/s x (1 + 1) x 20s = 400; the un-buff divide would pay 200.
    expect(result.cultivation).toBe(400)
  })

  it('buff tu luyện sống hết cửa sổ → toàn bộ thời gian được buff', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({
      cultivationPerSecond: 20,
      lastSavedAt: currentMs - 20_000,
      persistentTimedEffects: [
        {
          id: 'fx1',
          sourceItemId: 'tu_linh_tran',
          effectGroup: 'tu_linh_tran',
          appliedAtMs: 0,
          expiresAtMs: currentMs + 999_000_000, // still live past window end
          cultivationSpeedPercent: 1,
          modifiers: [],
        },
      ],
    })

    const result = player.restoreFromSave(save)

    // base 10 x (1+1) x 20s = 400 - same as snapshot-rate math but
    // reached through the segment path, not a flat multiply.
    expect(result.cultivation).toBe(400)
  })

  it('guard không phá normalization: nodeLevels fallback vẫn chạy', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({})
    save.player.nodeLevels = undefined as never // simulate save cũ thiếu field

    player.restoreFromSave(save)

    expect(player.nodeLevels).toEqual({})
    expect(player.baseStats.might).toBeGreaterThan(0)
  })

  // Dev-stage rule (Mission G) - legacy stat keys are DROPPED, never
  // translated: a legacy save loses those grants instead of silently
  // carrying renamed keys forward.
  it('save cũ với stat key cũ → key legacy bị drop, không translate', () => {
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

    // Current-shape keys survive; every legacy/retired key drops -
    // 'attack' is NOT renamed to might, it is gone.
    expect(player.baseStats.defense).toBe(7)
    expect(player.baseStats.might).toBe(createBaseStats().might)
    expect('attack' in player.baseStats).toBe(false)
    expect('maxMpPercent' in player.baseStats).toBe(false)
    expect('attackRange' in player.baseStats).toBe(false)

    expect(player.modifiers).toEqual([])
    expect(player.persistentTimedEffects[0]!.modifiers).toEqual([])
  })

  // M1 (ARCH-001) — the player slice is REPLACE semantics too: fields the
  // payload does not declare must reset to defaults instead of keeping the
  // previous session's values (a bare Object.assign merge leaked them).
  it('fields absent from the payload reset to defaults — no stale optional state survives a restore', () => {
    const player = usePlayerStore()

    // Simulate a previous session that set every optional field.
    player.cultivationPath = 'sword'
    player.cultivationWay = 'hidden_sword_pathway'
    player.swordPath = { preset: ['orb_bo'], kiemY: 5, kiemDaoCount: 2, kiemDaoBase: 1 }
    player.artifact = { artifactId: 'a', tier: 1, exp: 5 } as never
    player.highestFoundationAchieved = 'great_dao' as never
    player.formationLoadout = { formationId: 'f', assignments: [{ row: 0, column: 0, combatantId: 'c' }] }
    player.autoFarmStage = { stageId: 's', lastCheckedMs: 1 }
    player.companions = [{ companionId: 'c', constellation: 0 } as never]

    const save = buildMinimalSave({}) // declares none of the above
    player.restoreFromSave(save)

    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.swordPath).toBeUndefined()
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

  // Mission A6 — foreign keys trong payload KHÔNG được vào $state: spread
  // `...clonedPlayer` trước đây đưa cả key lạ lên store, rồi buildGameSave
  // serialize lại → key rác tự nhân bản qua mọi save kế tiếp.
  it('foreign keys trong save.player bị drop — không vào $state, không re-save', () => {
    const player = usePlayerStore()
    const save = buildMinimalSave({ name: 'clean' })

    // Keys không khai báo trong PlayerData — mô phỏng save bị sửa tay /
    // payload lạ.
    const polluted = save.player as unknown as Record<string, unknown>
    polluted.__evil = { nested: true }
    polluted.unknownTopLevel = 'x'
    ;(save.player.baseStats as Record<string, number>).__evilStat = 999

    player.restoreFromSave(save)

    const state = player.$state as unknown as Record<string, unknown>

    expect(state.__evil).toBeUndefined()
    expect(state.unknownTopLevel).toBeUndefined()
    expect((state.baseStats as Record<string, unknown>).__evilStat).toBeUndefined()
    expect(player.name).toBe('clean') // field hợp lệ vẫn restore
  })
})
