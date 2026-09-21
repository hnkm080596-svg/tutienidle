import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
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
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
    })

    killEnemy()

    // P7-M3 - mastery buffers until settleTechniqueMastery, it never
    // passes through RewardSystem.
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 8 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(35)
    expect(loot.getSummary().spiritStone).toBe(8)
  })

  it('Trúc Cơ ×3 — currency stage-table nhân 3', () => {
    // rng 0 -> foundation table min: 25 thạch / 90 cảm ngộ, sau ×3.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 75 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(270)
    expect(loot.getSummary().spiritStone).toBe(75)
  })

  it('Trúc Cơ ×3 + talent v3 retired (tu_bao) — không còn bonus ×1.5 (effect rỗng, spec v4 §4.4)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'foundation_establishment',
      talentIds: ['tu_bao'],
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    // Tụ Bảo retired — chỉ còn realm ×3, đúng hành vi "save cũ an toàn".
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 75 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(270)
    expect(loot.getSummary().spiritStone).toBe(75)
  })

  it('Trúc Cơ — Cảm Ngộ Kỹ năng suy ra từ techniqueMastery cũng ×3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    // techniqueMastery 90 (min) x 3 realm = 270 -> skillInsight suy ra
    // round(270 x 0.6) = 162 (M2 baseline ratio, SkillInsightBalance.ts).
    expect(player.skillInsight).toBe(162)
    expect(loot.getSummary().skillInsight).toBe(162)
  })

  it('Trúc Cơ — hệ số áp lên giá trị resolver trả về (mid-range)', () => {
    // rng 0.5 -> spiritStone floor(0.5*11)+25 = 30, ×3 = 90.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 90 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(315)
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

    createInstance.mockReturnValue({
      ...TEST_EQUIPMENT_INSTANCE,
      quality: 'tien',
    } as EquipmentInstance)

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

  it('grade and quality particle colors are one table across all five ranks', () => {
    // Mission G Task 29 - pins the single-table contract: the equipment
    // path (quality) and the pill path (grade) must emit the identical
    // color for every rank of the shared 5-member union.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const itemColors = (emit: ReturnType<typeof vi.fn>) =>
      emit.mock.calls
        .filter((call) => call[0] === 'reward_particle' && call[1]?.kind === 'item')
        .map((call) => (call[1] as { color: number }).color)

    for (const rank of ['hoang', 'huyen', 'dia', 'thien', 'tien'] as const) {
      // fe_5: no unconditional equipment_any line, so the signature drop
      // is the only 'item' particle of the run (mortal_5 emits two).
      const equipment = createLootTestSetup({
        realmId: 'foundation_establishment',
        stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
        equipmentTemplates: [TEST_EQUIPMENT_TEMPLATE],
        signatureDrops: [{ kind: 'equipment', itemId: 'eq_test', chance: 1 }],
      })
      equipment.createInstance.mockReturnValue({
        ...TEST_EQUIPMENT_INSTANCE,
        quality: rank,
      } as EquipmentInstance)
      equipment.killEnemy()

      const pill = createLootTestSetup({
        realmId: 'foundation_establishment',
        stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
        pillTemplates: [{ id: 'pill_t', name: 'Đan', grade: rank }],
        signatureDrops: [{ kind: 'pill', itemId: 'pill_t', chance: 1 }],
      })
      pill.killEnemy()

      const qualityColors = itemColors(equipment.eventBus.emit)
      const gradeColors = itemColors(pill.eventBus.emit)
      expect(qualityColors.length).toBeGreaterThan(0)
      expect(gradeColors.length).toBeGreaterThan(0)
      // Incidental table drops ride the same mocked createInstance, so
      // every emitted quality color of the run shares the rank.
      expect(new Set(qualityColors).size).toBe(1)
      expect(new Set(gradeColors).size).toBe(1)
      expect(gradeColors[0]).toBe(qualityColors[0])
    }
  })
})
