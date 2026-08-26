import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Rework theo combat-skill-flow-element-power-dot-plan.md §6.4-§6.6 —
// bộ khung mỗi hành: Root(1) → Power(10) → Cadence/Mechanic growth(5)
// → 2 Keystone Trúc Cơ loại trừ nhau (1 cấp, cần Power ≥ 1 + Trúc Cơ)
// → specialization sau keystone cha. Modifier node suy ra qua
// getAggregatedModifiers(player) / getSkillRuntimeStats(player), KHÔNG
// còn nằm trong player.modifiers hay mutate Skill instance.

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)

  gameManager.registerProgressionNodes(PHAP_TU_NODES)

  return gameManager
}

describe('GameManager — Pháp Tu FirePath (chọn path tự cấp basic + Hỏa Node Tree)', () => {
  it('chooseCultivationPath("phap_tu") học Hỏa Cầu Thuật + equip slot 0; 4 hành còn lại chưa học', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.realmLevel = 12

    expect(gameManager.chooseCultivationPath('phap_tu', player)).toBe(true)

    const hoaCauThuat = gameManager.skillManager.get('hoa_cau_thuat')

    expect(hoaCauThuat?.unlocked).toBe(true)
    expect(hoaCauThuat?.equipped).toBe(true)
    expect(hoaCauThuat?.loadoutSlot).toBe(0)
    expect(hoaCauThuat?.execution?.kind).toBe('cast_time')
    expect(gameManager.skillManager.getLoadoutSkills().map(skill => skill.id)).toEqual(['hoa_cau_thuat'])

    for (const skillId of ['thuy_tien_thuat', 'doc_chuong', 'diem_kim_thuat', 'tho_cau_thuat']) {
      expect(gameManager.skillManager.get(skillId)).toBeUndefined()
    }
  })

  it('setSkillLoadoutSlot: Thủy Tiễn Thuật vào slot 1 không đụng Hỏa Cầu Thuật ở slot 0', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.realmLevel = 12

    expect(gameManager.chooseCultivationPath('phap_tu', player)).toBe(true)

    player.skillInsight = 2

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)

    expect(gameManager.setSkillLoadoutSlot(player, 1, 'thuy_tien_thuat')).toBe(true)

    expect(gameManager.skillManager.get('thuy_tien_thuat')?.loadoutSlot).toBe(1)
    expect(gameManager.skillManager.get('hoa_cau_thuat')?.loadoutSlot).toBe(0)
    expect(gameManager.skillManager.getLoadoutSkills().map(skill => skill.id)).toEqual(['hoa_cau_thuat', 'thuy_tien_thuat'])
  })

  it('Hỏa Luyện Khí: Power/Cadence/Mechanic mua được sau root; modifier suy ra qua aggregator', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 3

    // Chưa có root — chặn.
    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)
    expect(player.skillInsight).toBe(3)

    // Mỗi growth level 1 tốn đúng 1 Cảm Ngộ.
    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_burn', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_haste', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Hỏa Linh +2 Hỏa Lực/cấp; Xích Viêm potency 4%; Tật Hỏa cast speed 3%.
    expect(finalStats.firePower).toBeGreaterThanOrEqual(2)
    expect(finalStats.ailmentPotencyPercent).toBeGreaterThanOrEqual(0.04)
    expect(finalStats.castSpeedPercent).toBeGreaterThanOrEqual(0.03)
  })

  it('Power node nâng nhiều cấp cộng dồn +2/cấp qua aggregator', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 50

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(true)

    // Nâng thêm 2 lần: tổng level 3, cost 1 + 1 + 1.
    expect(gameManager.upgradeNode('minor_fire_intensity', player)).toBe(true)
    expect(gameManager.upgradeNode('minor_fire_intensity', player)).toBe(true)

    expect(gameManager.getNodeLevel('minor_fire_intensity', player)).toBe(3)
    expect(player.skillInsight).toBe(47)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Nền gốc ~0.5 + node 3 cấp × 2 = 6 → tổng ≥ 6.5; assert phần NODE
    // đóng góp bằng chặn dưới.
    expect(finalStats.firePower).toBeGreaterThanOrEqual(6)
  })

  it('Hỏa Trúc Cơ: Keystone cần Power ≥ 1 + Trúc Cơ, loại trừ lẫn nhau', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 20
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(true)

    // Chưa tới Trúc Cơ — keystone chặn dù đã có Power.
    expect(gameManager.purchaseNode('hoa_truc_co_dan_hoa', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('hoa_truc_co_dan_hoa', player)).toBe(true)
    expect(gameManager.purchaseNode('hoa_truc_co_tu_hoa', player)).toBe(false)
  })

  it('Specialization CHẶN nếu chưa chọn keystone cha; sau đó mở', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_fire_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('hoa_truc_co_dan_hoa', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.15)
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Pure Tụ Hỏa: skillModifier suy ra từ nodeLevels qua getSkillRuntimeStats(player)', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('hoa_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_fire_channeling', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_fire_retention', player)).toBe(false)

    expect(gameManager.purchaseNode('hoa_truc_co_tu_hoa', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_fire_channeling', player)).toBe(true)

    // Nâng Hỏa Mạch lên level 3 (+2% mỗi cấp → 0.06).
    expect(gameManager.upgradeNode('minor_fire_channeling', player)).toBe(true)
    expect(gameManager.upgradeNode('minor_fire_channeling', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_fire_retention', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Tụ Hỏa flat 1 + Hỏa Mạch level 3 (0.02 + 0.02×2).
    expect(runtimeStats.hoaTheGainPerCast).toBeCloseTo(1.06, 5)
    expect(runtimeStats.hoaTheDecayReductionPercent).toBeCloseTo(0.02, 5)

    // Skill instance KHÔNG bị mutate (plan §6.8).
    expect(gameManager.skillManager.get('hoa_cau_thuat')!.hoaTheGainPerCast ?? 0).toBeLessThanOrEqual(0.001)
  })
})
