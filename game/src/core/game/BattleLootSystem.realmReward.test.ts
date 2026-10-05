import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import { getRealmRewardMultiplier } from '../reward/RealmRewardScale'
import {
  createLootTestSetup,
  TEST_EQUIPMENT_INSTANCE,
  TEST_EQUIPMENT_TEMPLATE,
} from './battleLootTestSetup'

// Scale thuong theo canh gioi stage (balance playtest 2026-08-28).
// 2026-10-05 pace retune: Truc Co co drop band rieng (25-35 thach /
// 90-120 cam ngo, da la ~x3 band Luyen Khi) nen chi tra x1 - bo x3
// double-count khien thu nhap TC ~x9 LK, vuot xa moi bang chi phi.
// x3 tro len chi con cho tier chua co band (golden_core+).
// Drop-system (2026-09-12): currency gio den tu STAGE DROP TABLE qua
// resolveDrops - enemy.rewards khong con la bang thuong. He so realm/talent
// giu nguyen vi tri: nhan SAU he so modifier cua resolver (spec sec1.6).
const PILL = { id: 'pill_grade_drop', name: 'Đan Phẩm', grade: 'tien', icon: undefined }

describe('getRealmRewardMultiplier', () => {
  it('beta realms x1; Kim Đan x3 (tier chua co drop band rieng)', () => {
    expect(getRealmRewardMultiplier('mortal')).toBe(1)
    expect(getRealmRewardMultiplier('qi_refining')).toBe(1)
    expect(getRealmRewardMultiplier('foundation_establishment')).toBe(1)
    expect(getRealmRewardMultiplier('golden_core')).toBe(3)
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
    // rng 0: moi amount roll ve min - qi_refining table: 8 thach / 35 cam ngo.
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
    expect(gainMastery).toHaveBeenCalledWith(35, 'mortal', 1)
    expect(loot.getSummary().spiritStone).toBe(8)
  })

  it('Trúc Cơ x1 — currency stage-table di nguyen qua (band da ~x3)', () => {
    // rng 0 -> foundation table min: 25 thach / 90 cam ngo.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 25 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(90, 'mortal', 1)
    expect(loot.getSummary().spiritStone).toBe(25)
  })

  it('Trúc Cơ x1 + talent v3 retired (tu_bao) — không còn bonus ×1.5 (effect rỗng, spec v4 §4.4)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'foundation_establishment',
      talentIds: ['tu_bao'],
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    // Tu Bao retired - chi con realm x1, dung hanh vi "save cu an toan".
    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 25 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(90, 'mortal', 1)
    expect(loot.getSummary().spiritStone).toBe(25)
  })

  it('Trúc Cơ — Cảm Ngộ Kỹ năng suy ra từ techniqueMastery (band x1)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { killEnemy, player, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    // techniqueMastery 90 (min) x 1 realm = 90 -> skillInsight suy ra
    // round(90 x 0.18) = 16 (balance 2026-10-04, SkillInsightBalance.ts).
    expect(player.skillInsight).toBe(16)
    expect(loot.getSummary().skillInsight).toBe(16)
  })

  it('Trúc Cơ — hệ số áp lên giá trị resolver trả về (mid-range)', () => {
    // rng 0.5 -> spiritStone floor(0.5*11)+25 = 30, x1 = 30.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { killEnemy, giveReward, loot, gainMastery } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: { stageId: 'fe_5', requiredRealmId: 'foundation_establishment', floor: 5 },
    })

    killEnemy()

    expect(giveReward.mock.calls[0]?.[1]).toMatchObject({ spiritStone: 30 })
    loot.settleTechniqueMastery()
    expect(gainMastery).toHaveBeenCalledWith(105, 'mortal', 1)
  })

  it('equipment rơi qua pool draw dùng quality cho particle và rank accent', () => {
    // rng 0.8: guaranteed tinh_hoa (0.7) truot; pool roll 0.8*35=28 ->
    // qua base_kiem (15) -> equipment_any -> rut template tu registry.
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
