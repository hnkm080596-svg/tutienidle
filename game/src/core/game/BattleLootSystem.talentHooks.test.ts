import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CombatEntity } from '../combat/CombatEntity'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// Talent catalog v4 (spec 2026-09-03 sec4.4) - 4 hook loot cua v3 (Tu
// Bao/Dai Tri Nhuoc Ngu/Co Duyen/Huyet Chien) da RETIRED: id van
// resolve cho save cu nhung effects rong -> moi multiplier loot ve
// mac dinh. File nay khoa: (1) pipeline loot nen khong talent, (2)
// id retired KHONG con bonus (hanh vi "save cu an toan").
// Drop-system (2026-09-12): currency gio tu stage table qua resolveDrops,
// enemy.rewards khong con la bang loot; 'Co Duyen' tung nhan chance roi
// equipment - co che chance-per-enemy da bi xoa han cung itemDrops.
const QI_REFINING_STAGE = { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 }

describe('BattleLootSystem — pipeline loot nền (không talent)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Linh Thạch từ stage table, không nhân gì thêm', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, giveReward } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 8 })
    expect(loot.getSummary().spiritStone).toBe(8)
  })

  it('Cảm Ngộ Kỹ năng suy ra từ techniqueMastery đã resolve', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    // qi_refining techniqueMastery min 35 -> round(35 * 0.018) = 1 (pace retune)
    // (balance 2026-10-04 coefficient, spec sec4.3 row 18).
    expect(player.skillInsight).toBe(1)
    expect(loot.getSummary().skillInsight).toBe(1)
  })

  it('Van Dao (M2) — insight_gain x2 tren nen insight_base -25% = net x1.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
      talentIds: ['van_dao'],
    })

    killEnemy()

    // floor(6 * 0.75 * (1 + 1.0)) = 9.
    expect(player.skillInsight).toBe(1)
    expect(loot.getSummary().skillInsight).toBe(1)
  })

  it('máu không đổi khi quái chết', () => {
    const { loot } = createLootTestSetup({ realmId: 'qi_refining', stage: QI_REFINING_STAGE })
    const healTarget = { alive: true, currentHp: 500, maxHp: 1000 } as CombatEntity

    loot.processDefeatedEnemies([createDeadEnemy('mob')], healTarget)

    expect(healTarget.currentHp).toBe(500)
  })

  it('pool draw vào material — equipment không rơi', () => {
    // rng 0.5 -> roll 25/50 -> entry dau = qi_refining_ore_decade (w30).
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { killEnemy, equipmentBag, materialBag } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
      materialIds: ['qi_refining_ore_decade'],
      equipmentTemplates: [{ id: 'eq_test', name: 'Kiếm Test' }],
    })

    killEnemy()

    expect(equipmentBag.add).not.toHaveBeenCalled()
    expect(materialBag.getAmount('qi_refining_ore_decade')).toBeGreaterThanOrEqual(1)
  })

  it('pool draw vào equipment_any — material không vào túi', () => {
    // rng 0.999 -> roll ~50/50 -> entry cuoi = equipment_any.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    const { killEnemy, equipmentBag, materialBag } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
      materialIds: ['qi_refining_ore_decade'],
      equipmentTemplates: [{ id: 'eq_test', name: 'Kiếm Test' }],
    })

    killEnemy()

    expect(materialBag.getAmount('qi_refining_ore_decade')).toBe(0)
    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
  })
})

describe('BattleLootSystem — talent v3 retired KHÔNG còn bonus (spec v4 §4.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tu_bao (Tụ Bảo) — Linh Thạch KHÔNG nhân 1.5', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, giveReward } = createLootTestSetup({
      realmId: 'qi_refining',
      talentIds: ['tu_bao'],
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 8 })
    expect(loot.getSummary().spiritStone).toBe(8)
  })

  it('dai_tri_nhuoc_ngu (Đại Trí Nhược Ngu) — Cảm Ngộ KHÔNG nhân 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player } = createLootTestSetup({
      realmId: 'qi_refining',
      talentIds: ['dai_tri_nhuoc_ngu'],
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    expect(player.skillInsight).toBe(1) // baseline: round(35 * 0.018)
  })

  it('co_duyen (Cơ Duyên) — equipment KHÔNG có đường rớt riêng nào cả (pool draw như thường)', () => {
    // rng 0.5 -> pool draw trung material - Co Duyen khong day them do nao.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { killEnemy, equipmentBag } = createLootTestSetup({
      realmId: 'qi_refining',
      talentIds: ['co_duyen'],
      stage: QI_REFINING_STAGE,
      materialIds: ['qi_refining_ore_decade'],
      equipmentTemplates: [{ id: 'eq_test', name: 'Kiếm Test' }],
    })

    killEnemy()

    expect(equipmentBag.add).not.toHaveBeenCalled()
  })

  it('huyet_chien (Huyết Chiến) — diệt quái KHÔNG hồi máu', () => {
    const { loot, applyHealing } = createLootTestSetup({
      realmId: 'qi_refining',
      talentIds: ['huyet_chien'],
      stage: QI_REFINING_STAGE,
    })
    const healTarget = {
      alive: true,
      currentHp: 500,
      maxHp: 1000,
    } as CombatEntity

    loot.processDefeatedEnemies([createDeadEnemy('mob')], healTarget)

    expect(healTarget.currentHp).toBe(500)
    expect(applyHealing).not.toHaveBeenCalled()
  })

  it('talent v4 combat (kiem_quang) — loot nền KHÔNG bị ảnh hưởng (combat passive không đụng loot)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, player, giveReward, gainMastery } = createLootTestSetup({
      realmId: 'qi_refining',
      talentIds: ['kiem_quang'],
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    // P7-M3 - mastery buffers; verify the untouched 35 via the flush.
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 8 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(35, 'mortal', 1)
    expect(player.skillInsight).toBe(1) // baseline: round(35 * 0.018)
    expect(loot.getSummary().spiritStone).toBe(8)
  })
})
