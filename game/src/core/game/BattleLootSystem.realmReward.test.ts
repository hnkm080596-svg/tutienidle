import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRealmRewardMultiplier } from '../reward/RealmRewardScale'
import {
  createLootTestSetup,
  TEST_EQUIPMENT_INSTANCE,
  TEST_EQUIPMENT_TEMPLATE,
} from './battleLootTestSetup'

// Scale thưởng theo cảnh giới stage (balance playtest 2026-08-28) — Trúc Cơ
// tái sử dụng enemyPool Luyện Khí nên nhân thưởng ×3 để thu nhập không khựng.
// Drop-system (2026-09-12): currency giờ đến từ STAGE DROP TABLE qua
// resolveDrops — enemy.rewards không còn là bảng thưởng. Hệ số realm/talent
// giữ nguyên vị trí: nhân SAU hệ số modifier của resolver (spec §1.6).
const PILL = { id: 'pill_grade_drop', name: 'Đan Phẩm', grade: 'tien', icon: undefined }

describe('getRealmRewardMultiplier', () => {
  it('mortal & Luyện Khí ×1; Trúc Cơ ×3; Kim Đan ×9', () => {
    expect(getRealmRewardMultiplier('mortal')).toBe(1)
    expect(getRealmRewardMultiplier('qi_refining')).toBe(1)
    expect(getRealmRewardMultiplier('foundation_establishment')).toBe(3)
    expect(getRealmRewardMultiplier('golden_core')).toBe(9)
  })

  it('realm không biết — ×1 (an toàn)', () => {
    expect(getRealmRewardMultiplier('unknown_realm')).toBe(1)
  })
})

describe('BattleLootSystem — realm reward scaling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Luyện Khí ×1 — currency stage-table đi nguyên qua', () => {
    // rng 0: mọi amount roll về min — qi_refining table: 8 thạch / 35 cảm ngộ.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 8, techniqueInsight: 35 })
    expect(loot.getSummary().spiritStone).toBe(8)
  })

  it('Trúc Cơ ×3 — currency stage-table nhân 3', () => {
    // rng 0 -> foundation table min: 25 thạch / 90 cảm ngộ, sau ×3.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 75, techniqueInsight: 270 })
    expect(loot.getSummary().spiritStone).toBe(75)
  })

  it('Trúc Cơ ×3 + talent v3 retired (tu_bao) — không còn bonus ×1.5 (effect rỗng, spec v4 §4.4)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      talentIds: ['tu_bao'],
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    // Tụ Bảo retired — chỉ còn realm ×3, đúng hành vi "save cũ an toàn".
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 75, techniqueInsight: 270 })
    expect(loot.getSummary().spiritStone).toBe(75)
  })

  it('Trúc Cơ — Cảm Ngộ Kỹ năng suy ra từ techniqueInsight cũng ×3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    // techniqueInsight 90 (min) × 3 realm = 270 -> skillInsight suy ra 270.
    expect(player.skillInsight).toBe(270)
    expect(loot.getSummary().skillInsight).toBe(270)
  })

  it('Trúc Cơ — hệ số áp lên giá trị resolver trả về (mid-range)', () => {
    // rng 0.5 -> spiritStone floor(0.5*11)+25 = 30, ×3 = 90.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { killEnemy, giveReward } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 90, techniqueInsight: 315 })
  })

  it('equipment rơi qua pool draw dùng quality cho particle và rank accent', () => {
    // rng 0.8: guaranteed tinh_hoa (0.7) trượt; pool roll 0.8*35=28 ->
    // qua base_kiem (15) -> equipment_any -> rút template từ registry.
    vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const { killEnemy, equipmentBag, eventBus, notifications, createInstance } =
      createLootTestSetup({
        realmId: 'mortal',
        stage: { stageId: 'mortal_5', requiredRealmId: 'mortal', floor: 5 },
        equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
      })

    createInstance.mockReturnValue({ ...TEST_EQUIPMENT_INSTANCE, quality: 'tien' })

    killEnemy()

    expect(equipmentBag.add).toHaveBeenCalledTimes(1)
    expect(equipmentBag.add).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 'bat_pham', quality: 'tien' }),
    )
    expect(eventBus.emit).toHaveBeenCalledWith('reward_particle', {
      sourceId: 'mob',
      kind: 'item',
      color: 0xfff6d8,
    })
    expect(notifications.push).toHaveBeenCalledWith({
      kind: 'loot',
      message: '+1 Kiếm Test',
      loot: expect.objectContaining({ accentColorVar: '--grade-tien' }),
    })
  })

  it('pill drop keeps the grade particle and accent presentation', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { killEnemy, eventBus, notifications } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
      signatureDrops: [{ kind: 'pill', itemId: PILL.id, chance: 1 }],
      pillTemplates: [PILL],
    })

    killEnemy()

    expect(eventBus.emit).toHaveBeenCalledWith('reward_particle', {
      sourceId: 'mob',
      kind: 'item',
      color: 0xfff6d8,
    })
    expect(notifications.push).toHaveBeenCalledWith({
      kind: 'loot',
      message: '+1 Đan Phẩm',
      loot: expect.objectContaining({ accentColorVar: '--grade-tien' }),
    })
  })
})
