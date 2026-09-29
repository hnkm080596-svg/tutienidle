// Pill nghề (2026-08-24, plan §5): gate wrong_realm KHÔNG consume; main
// stat roll bỏ stat đã cap + deterministic RNG; regen = timed effect
// deadline tuyệt đối có hiệu lực trong combat và hết đúng hạn; Tu Vi đi
// qua addCultivation (giữ cap); Cảm Ngộ tăng cả current + lifetime.
// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { getMainStatCap } from '../stats/StatCap'
import { getRequiredCultivation } from '../realm/realmSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { Enemy } from '../enemy/Enemy'

function _makeEnemyData(): Enemy {
  const stats = {
    ...createBaseStats(),
    might: 0,
  }

  return {
    id: 'enemy_x',
    level: 1,
    realmId: 'mortal',
    rewards: { techniqueMastery: 0, spiritStone: 0 },
    lane: 'ground',
    name: 'Quái',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    alive: true,
  } as unknown as Enemy
}

function setup() {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

// M10 (ARCH-008) — hoi_xuan_dan retired; hoi_linh_dan keeps the regen
// profession-pill path covered (realm gate still fires before its
// spell gate, so the wrong_realm test is unaffected).
const REGEN_PILL = 'hoi_linh_dan_mortal'
const PERMANENT_PILL = 'to_cot_dan_mortal'
const CULTIVATION_PILL = 'tu_linh_dan_mortal'

function registerPill(gameManager: GameManager, pillId: string, amount = 1) {
  // Pill đã register qua bootstrap data ở App.vue; ở test, lấy từ registry
  // data bằng import gián tiếp để tránh phụ thuộc App.vue.
  return import('../../data/pill/pills').then(({ pills }) => {
    gameManager.catalogOps.registerPills(pills.filter((pill) => pill.id === pillId))
    gameManager.pillBag.add(gameManager.pillRegistry.get(pillId), amount)
  })
}

function pillTarget() {
  return {
    addCultivation: () => {},
    heal: () => {},
    applyBuff: () => {},
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Pill nghề — gate + atomic consumption', () => {
  it('wrong_realm: KHÔNG consume, KHÔNG apply', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, REGEN_PILL)

    const playerWrongRealm = { ...player, realmId: 'golden_core' }

    const result = gameManager.pillOps.usePillDetailed(REGEN_PILL, pillTarget(), playerWrongRealm as never)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong_realm')
    expect(gameManager.pillBag.has(REGEN_PILL, 1)).toBe(true)
  })

  it('đan vĩnh viễn cộng THẲNG vào baseStats (ruling 2026-09-29) - không tạo modifier', async () => {
    const { gameManager, player } = setup()

    const before = player.baseStats.strength

    await registerPill(gameManager, PERMANENT_PILL, 2)
    const result = gameManager.pillOps.usePillDetailed(PERMANENT_PILL, pillTarget(), player)

    expect(result.ok).toBe(true)
    expect(player.baseStats.strength).toBe(before + 1)
    expect(player.modifiers.some((modifier) => modifier.id === 'pill-permanent:strength')).toBe(false)
    expect(gameManager.pillBag.getAmount(PERMANENT_PILL)).toBe(1)
  })

  it('baseStats từ đan vĩnh viễn được predicate lineage ẩn tính (đọc baseStats thô)', async () => {
    const { gameManager, player } = setup()

    // Pill the stat to just under cap via the production path, then a
    // final pill closes it - the hidden predicate's baseStats read
    // reaches cap only because the write is to baseStats, not modifiers.
    const cap = getMainStatCap('mortal')
    player.baseStats.strength = cap - 1

    await registerPill(gameManager, PERMANENT_PILL)
    const result = gameManager.pillOps.usePillDetailed(PERMANENT_PILL, pillTarget(), player)

    expect(result.ok).toBe(true)
    expect(player.baseStats.strength).toBe(cap)
  })

  it('thuộc tính đích đã chạm trần → không consume', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, PERMANENT_PILL)

    const cap = getMainStatCap('mortal')
    player.baseStats.strength = cap
    const result = gameManager.pillOps.usePillDetailed(PERMANENT_PILL, pillTarget(), player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('cap')
    expect(gameManager.pillBag.has(PERMANENT_PILL, 1)).toBe(true)
  })

  it('cultivation: % yêu cầu tầng, qua addCultivation giữ cap tầng', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, CULTIVATION_PILL)

    // Đặt cultivation sát trần: pill cộng 3% required nhưng KHÔNG vượt
    // required (addCultivation chặn ở required — hành vi giữ cap).
    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    player.cultivation = required - 1

    expect(gameManager.pillOps.usePillDetailed(CULTIVATION_PILL, pillTarget(), player).ok).toBe(true)

    expect(player.cultivation).toBe(required)
  })
})

// M10 (ARCH-008, user-locked 2026-09-14): Hoi Xuan Dan RETIRED — the pill
// is no longer consumable at all (reason 'retired', bag item kept). The
// earlier hpRegenPerTurn-stripping tests retired with the mechanic
// (2026-09-05); this pins the retired state instead of a silent no-op.
describe('Hoi Xuan Dan — retired family (ARCH-008 / M10)', () => {
  it('usePillDetailed rejects with reason retired — no consume, no timed effect', async () => {
    const { gameManager, player } = setup()
    await registerPill(gameManager, 'hoi_xuan_dan_mortal')

    const result = gameManager.pillOps.usePillDetailed('hoi_xuan_dan_mortal', pillTarget(), player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('retired')
    expect(gameManager.pillBag.has('hoi_xuan_dan_mortal', 1)).toBe(true)
    expect(player.persistentTimedEffects).toHaveLength(0)
  })
})
// M3 (spec 2026-09-03 talent catalog v4 §4.2) — Hoa Hau Thong Than: dan
// tu luyen dung hieu qua +50% — scale tai PillSystem consumption seam.
describe('Pill nghề — Hỏa Hầu Thông Thần +50% hiệu quả (M3)', () => {
  it('đan tu vi: cultivationPercent ×1.5 khi có talent', async () => {
    const { gameManager, player } = setup()
    player.selectedTalentIds = ['hoa_hau_thong_than']

    await registerPill(gameManager, CULTIVATION_PILL)

    const pill = gameManager.pillRegistry.get(CULTIVATION_PILL)
    const basePercent = pill.effects.find((effect) => effect.type === 'cultivation')?.cultivationPercent ?? 0
    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    player.cultivation = 0

    expect(gameManager.pillOps.usePillDetailed(CULTIVATION_PILL, pillTarget(), player).ok).toBe(true)
    expect(player.cultivation).toBe(Math.floor(required * basePercent * 1.5))
  })

  it('không talent — đan tu vi giữ nguyên % gốc', async () => {
    const { gameManager, player } = setup()

    await registerPill(gameManager, CULTIVATION_PILL)

    const pill = gameManager.pillRegistry.get(CULTIVATION_PILL)
    const basePercent = pill.effects.find((effect) => effect.type === 'cultivation')?.cultivationPercent ?? 0
    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    player.cultivation = 0

    expect(gameManager.pillOps.usePillDetailed(CULTIVATION_PILL, pillTarget(), player).ok).toBe(true)
    expect(player.cultivation).toBe(Math.floor(required * basePercent))
  })

  it('đan Cảm Ngộ (skill_insight): value ×1.5 round, cả current + lifetime', async () => {
    const { gameManager, player } = setup()
    player.selectedTalentIds = ['hoa_hau_thong_than']

    // Không có production pill nào emit skill_insight — đăng ký synthetic.
    const insightPill = {
      id: 'test_insight_pill',
      name: 'Đan Cảm Ngộ Test',
      type: 'cultivation',
      grade: 'hoang',
      realmId: 'mortal',
      effects: [{ type: 'skill_insight', value: 10 }],
    } as never

    gameManager.catalogOps.registerPills([insightPill])
    gameManager.pillBag.add(gameManager.pillRegistry.get('test_insight_pill'), 1)

    expect(gameManager.pillOps.usePillDetailed('test_insight_pill', pillTarget(), player).ok).toBe(true)
    expect(player.skillInsight).toBe(15)
    expect(player.totalSkillInsightGained).toBe(15)
  })

  it('đan hồi MP (regen): mpPerSecond ×1.5 trong timed effect', async () => {
    const { gameManager, player } = setup()
    player.selectedTalentIds = ['hoa_hau_thong_than']
    player.cultivationPath = 'spell' // MP regen pill gate
    player.cultivationWay = 'spell_pathway' // M4: the gate is way-owned

    await registerPill(gameManager, 'hoi_linh_dan_mortal')

    const pill = gameManager.pillRegistry.get('hoi_linh_dan_mortal')
    const baseMp = pill.effects.find((effect) => effect.type === 'regen')?.mpPerSecond ?? 0

    expect(baseMp).toBeGreaterThan(0)
    expect(gameManager.pillOps.usePillDetailed('hoi_linh_dan_mortal', pillTarget(), player).ok).toBe(true)

    const modifier = player.persistentTimedEffects
      .flatMap((effect) => effect.modifiers)
      .find((entry) => entry.stat === 'manaRegenPerTurn')

    expect(modifier?.flat).toBe(baseMp * 1.5)
  })
})

describe('PR54 fixpoint repairs', () => {
  it('đan lai (permanent_stat + heal): stat vào baseStats VÀ heal chạy qua adapter - không rơi mất hiệu ứng kế thừa', async () => {
    const { gameManager, player } = setup()

    const mixedPill = {
      id: 'test_mixed_pill',
      name: 'Đan Lai Test',
      type: 'permanent',
      grade: 'hoang',
      realmId: 'mortal',
      effects: [
        { type: 'permanent_stat', stat: 'strength', value: 1 },
        { type: 'heal', value: 7 },
      ],
    } as never

    gameManager.catalogOps.registerPills([mixedPill])
    gameManager.pillBag.add(gameManager.pillRegistry.get('test_mixed_pill'), 1)

    let healed = 0
    const target = { addCultivation: () => {}, heal: (amount: number) => (healed += amount), applyBuff: () => {} }

    const before = player.baseStats.strength
    const result = gameManager.pillOps.usePillDetailed('test_mixed_pill', target, player)

    expect(result.ok).toBe(true)
    expect(player.baseStats.strength).toBe(before + 1)
    expect(healed).toBe(7)
    expect(gameManager.pillBag.has('test_mixed_pill', 1)).toBe(false)
  })

  it('hai grant cùng stat trong một đan: gate tích luỹ - tổng vượt trần bị từ chối thay vì bốc hơi grant thứ hai', async () => {
    const { gameManager, player } = setup()

    const twinPill = {
      id: 'test_twin_pill',
      name: 'Đan Đôi Test',
      type: 'permanent',
      grade: 'hoang',
      realmId: 'mortal',
      effects: [
        { type: 'permanent_stat', stat: 'strength', value: 1 },
        { type: 'permanent_stat', stat: 'strength', value: 1 },
      ],
    } as never

    gameManager.catalogOps.registerPills([twinPill])
    gameManager.pillBag.add(gameManager.pillRegistry.get('test_twin_pill'), 1)

    const cap = getMainStatCap('mortal')
    player.baseStats.strength = cap - 1

    const result = gameManager.pillOps.usePillDetailed('test_twin_pill', pillTarget(), player)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('cap')
    expect(player.baseStats.strength).toBe(cap - 1)
    expect(gameManager.pillBag.has('test_twin_pill', 1)).toBe(true)
  })

  it('đan cộng chỉ số bị từ chối giữa trận (in_battle), đan heal vẫn dùng được', async () => {
    const { gameManager, player } = setup()

    vi.spyOn(gameManager.turnBattleOps, 'isTurnBattleInProgress').mockReturnValue(true)

    const healPill = {
      id: 'test_heal_pill',
      name: 'Đan Hồi Test',
      type: 'healing',
      grade: 'hoang',
      effects: [{ type: 'heal', value: 5 }],
    } as never

    gameManager.catalogOps.registerPills([healPill])
    await registerPill(gameManager, PERMANENT_PILL)
    gameManager.pillBag.add(gameManager.pillRegistry.get('test_heal_pill'), 1)

    const statResult = gameManager.pillOps.usePillDetailed(PERMANENT_PILL, pillTarget(), player)
    expect(statResult.ok).toBe(false)
    expect(statResult.reason).toBe('in_battle')
    expect(gameManager.pillBag.has(PERMANENT_PILL, 1)).toBe(true)

    let healed = 0
    const healResult = gameManager.pillOps.usePillDetailed(
      'test_heal_pill',
      { addCultivation: () => {}, heal: (amount: number) => (healed += amount), applyBuff: () => {} },
      player,
    )
    expect(healResult.ok).toBe(true)
    expect(healed).toBe(5)
  })

  it('permanent_stat nhắm stat ngoài MAIN_STAT_KEYS bị từ chối ghi (drift authored)', async () => {
    const { gameManager, player } = setup()

    const driftPill = {
      id: 'test_drift_pill',
      name: 'Đan Drift Test',
      type: 'permanent',
      grade: 'hoang',
      realmId: 'mortal',
      effects: [{ type: 'permanent_stat', stat: 'might', value: 5 }],
    } as never

    gameManager.catalogOps.registerPills([driftPill])
    gameManager.pillBag.add(gameManager.pillRegistry.get('test_drift_pill'), 1)

    const before = player.baseStats.might
    const result = gameManager.pillOps.usePillDetailed('test_drift_pill', pillTarget(), player)

    // The write is refused either way: the apply skips non-main stats,
    // or the cap gate rejects the pill outright. Either path leaves
    // baseStats untouched; a refusal keeps the pill in the bag.
    expect(player.baseStats.might).toBe(before)
    if (!result.ok) {
      expect(gameManager.pillBag.has('test_drift_pill', 1)).toBe(true)
    }
  })
})
