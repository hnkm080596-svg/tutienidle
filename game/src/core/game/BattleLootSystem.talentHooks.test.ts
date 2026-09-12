import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CombatEntity } from '../combat/CombatEntity'
import { createBattle, createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// Talent catalog v4 (spec 2026-09-03 §4.4) — 4 hook loot của v3 (Tụ
// Bảo/Đại Trí Nhược Ngu/Cơ Duyên/Huyết Chiến) đã RETIRED: id vẫn
// resolve cho save cũ nhưng effects rỗng → mọi multiplier loot về
// mặc định. File này khóa: (1) pipeline loot nền không talent, (2)
// id retired KHÔNG còn bonus (hành vi "save cũ an toàn").
// Drop-system (2026-09-12): currency giờ từ stage table qua resolveDrops,
// enemy.rewards không còn là bảng loot; 'Cơ Duyên' từng nhân chance rơi
// equipment — cơ chế chance-per-enemy đã bị xoá hẳn cùng itemDrops.
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

  it('Cảm Ngộ Kỹ năng suy ra từ techniqueInsight đã resolve', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    // qi_refining techniqueInsight min 35 -> round(35 * 0.6) = 21
    // (M2 baseline cut, spec §4.3 row 18).
    expect(player.skillInsight).toBe(21)
    expect(loot.getSummary().skillInsight).toBe(21)
  })

  it('Van Dao (M2) — Cảm Ngộ từ quái nhân x2 qua insight_gain', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: QI_REFINING_STAGE,
      talentIds: ['van_dao'],
    })

    killEnemy()

    // floor(21 * (1 + 1.0)) = 42.
    expect(player.skillInsight).toBe(42)
    expect(loot.getSummary().skillInsight).toBe(42)
  })

  it('máu không đổi khi quái chết', () => {
    const { loot } = createLootTestSetup({ realmId: 'qi_refining', stage: QI_REFINING_STAGE })
    const battle = createBattle([createDeadEnemy('mob')], { currentHp: 500, maxHp: 1000 })

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(500)
  })

  it('pool draw vào material — equipment không rơi', () => {
    // rng 0.5 -> roll 25/50 -> entry đầu = qi_refining_ore_decade (w30).
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
    // rng 0.999 -> roll ~50/50 -> entry cuối = equipment_any.
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

    expect(player.skillInsight).toBe(21) // baseline M2: round(35 * 0.6)
  })

  it('co_duyen (Cơ Duyên) — equipment KHÔNG có đường rớt riêng nào cả (pool draw như thường)', () => {
    // rng 0.5 -> pool draw trúng material — Cơ Duyên không đẩy thêm đồ nào.
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
    const battle = createBattle([createDeadEnemy('mob')], {
      currentHp: 500,
      maxHp: 1000,
    } as Partial<CombatEntity>)

    loot.processDefeatedEnemies(battle)

    expect(battle.player.currentHp).toBe(500)
    expect(applyHealing).not.toHaveBeenCalled()
  })

  it('talent v4 combat (kiem_quang) — loot nền KHÔNG bị ảnh hưởng (combat passive không đụng loot)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, loot, player, giveReward } = createLootTestSetup({
      realmId: 'qi_refining',
      talentIds: ['kiem_quang'],
      stage: QI_REFINING_STAGE,
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 8, techniqueInsight: 35 })
    expect(player.skillInsight).toBe(21) // M2 baseline: round(35 * 0.6)
    expect(loot.getSummary().spiritStone).toBe(8)
  })
})
