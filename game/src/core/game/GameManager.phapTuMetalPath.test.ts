import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Plans/KimPath (2026-08-21) — Kim đi theo ĐÚNG khuôn Hỏa/Thủy/Mộc/Thổ
// (xem GameManager.phapTuFirePath.test.ts/phapTuWaterPath.test.ts/
// phapTuWoodPath.test.ts/phapTuEarthPath.test.ts): 1 Active Skill/hành,
// Node Tree Luyện Khí (3 Minor) + Trúc Cơ (2 Major loại trừ nhau + Minor
// đi kèm). Feedback (2026-08-21) — mô hình "Lĩnh Ngộ X" quay TRỞ LẠI
// cho Thủy/Mộc/Thổ/Kim (chỉ Hỏa học sẵn miễn phí) — Điểm Kim Thuật phải
// mua node "Lĩnh Ngộ Kim" (kim_linh_ngo, 2 Skill Point) TRƯỚC, node này
// là prerequisite của MỌI node khác trong hành.
describe('GameManager — Pháp Tu KimPath (Kim Node Tree Luyện Khí/Trúc Cơ)', () => {
  it('Kim Luyện Khí: 3 Minor mua được sau khi Lĩnh Ngộ Kim, KHÔNG mua được trước đó', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('diem_kim_thuat')?.unlocked).toBe(true)

    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_bleed_damage', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_application', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(gameManager.skillManager.get('diem_kim_thuat')?.metalAilmentPotencyPercent).toBeGreaterThanOrEqual(0.05)
    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Kim Trúc Cơ: Major Huyết Dẫn/Kim Thế bị chặn trước Trúc Cơ, loại trừ lẫn nhau sau khi mua 1 trong 2', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 10
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('kim_truc_co_huyet_dan', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_truc_co_huyet_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('kim_truc_co_kim_the', player)).toBe(false)
  })

  it('Kim Trúc Cơ: Kim Tâm (minor chung) chỉ cần Trúc Cơ, không cần chọn Major nào', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 3
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_metal_heart', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.metalPower).toBeGreaterThan(0)
  })

  it('Kim Trúc Cơ Reaction: Huyết Dẫn cấp thật reactionEffectPercent, Cộng Huyết CHẶN nếu chưa chọn Huyết Dẫn', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 10
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_metal_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('kim_truc_co_huyet_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    // Huyết Dẫn flat 0.2 + Cộng Huyết flat 0.05.
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.25)
  })

  it('Kim Trúc Cơ Pure: Kim Thế cấp kimTheGainPerProc/kimTheDotDamagePercentPerStack/kimTheDotResistancePenetrationPercentPerStack, Kim Uyên/Huyết Lưu CHẶN nếu chưa chọn Kim Thế', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 10
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_metal_channeling', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_metal_burst', player)).toBe(false)

    expect(gameManager.purchaseNode('kim_truc_co_kim_the', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_channeling', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_burst', player)).toBe(true)

    const diemKimThuat = gameManager.skillManager.get('diem_kim_thuat')

    expect(diemKimThuat?.kimTheGainPerProc).toBeGreaterThanOrEqual(1)
    expect(diemKimThuat?.kimTheDotDamagePercentPerStack).toBeGreaterThanOrEqual(0.05)
    expect(diemKimThuat?.kimTheDotResistancePenetrationPercentPerStack).toBeGreaterThanOrEqual(0.03)
    expect(diemKimThuat?.kimTheMaxStacksBonus).toBeGreaterThanOrEqual(1)
    // Kim Thế major chưa cấp metalAilmentPotencyPercent — chỉ Huyết Lưu (minor) mới cấp.
    expect(diemKimThuat?.metalAilmentPotencyPercent).toBeGreaterThanOrEqual(0.1)
  })
})
