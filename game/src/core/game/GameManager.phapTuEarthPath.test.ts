import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Plans/EarthPath (2026-08-21) — Thổ đi theo ĐÚNG khuôn Hỏa/Thủy/Mộc
// (xem GameManager.phapTuFirePath.test.ts/phapTuWaterPath.test.ts/
// phapTuWoodPath.test.ts): 1 Active Skill/hành, Node Tree Luyện Khí (3
// Minor) + Trúc Cơ (2 Major loại trừ nhau + Minor đi kèm). KHÁC 3 hành
// kia: chỉ 1 Minor Chung (không phải 2) — EarthPath.md chỉ cho đúng 9
// node tổng (+1 Lĩnh Ngộ = 10), xem PhapTuNodes.ts's ghi chú đầu khối
// THỔ. Feedback (2026-08-21) — Thổ Cầu Thuật KHÔNG học sẵn miễn phí nữa,
// phải mua node "Lĩnh Ngộ Thổ" (tho_linh_ngo, 2 Skill Point) TRƯỚC —
// node này là prerequisite của MỌI node khác trong hành.
describe('GameManager — Pháp Tu EarthPath (Thổ Node Tree Luyện Khí/Trúc Cơ)', () => {
  it('Thổ Luyện Khí: 3 Minor mua được sau khi Lĩnh Ngộ Thổ, KHÔNG mua được trước đó', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('tho_cau_thuat')?.unlocked).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_haste', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_impact', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.castSpeedPercent).toBeGreaterThanOrEqual(0.05)
    // "Chấn Lực" — honest placeholder, tick thật nhưng chưa ai đọc.
    expect(gameManager.skillManager.get('tho_cau_thuat')?.skillImpactPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Thổ Trúc Cơ: Major Định Thổ/Thổ Thế bị chặn trước Trúc Cơ, loại trừ lẫn nhau sau khi mua 1 trong 2', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 10
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('tho_truc_co_dinh_tho', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_truc_co_dinh_tho', player)).toBe(true)
    expect(gameManager.purchaseNode('tho_truc_co_tho_the', player)).toBe(false)
  })

  it('Thổ Trúc Cơ: Thổ Tâm (minor chung) chỉ cần Trúc Cơ, không cần chọn Major nào', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 3
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_heart', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.earthPower).toBeGreaterThan(0)
  })

  it('Thổ Trúc Cơ Reaction: Định Thổ cấp thật reactionEffectPercent, Định Lực CHẶN nếu chưa chọn Định Thổ', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 10
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('tho_truc_co_dinh_tho', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    // Định Thổ flat 0.2 + Định Lực flat 0.05.
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.25)
  })

  it('Thổ Trúc Cơ Pure: Thổ Thế cấp earthAoeRadius/earthAoeSecondaryDamagePercent/earthKnockbackDistance/thoTheGainPerCast, Chấn Vực/Trọng Thổ CHẶN nếu chưa chọn Thổ Thế', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillInsight = 10
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_aoe', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_earth_knockback', player)).toBe(false)

    expect(gameManager.purchaseNode('tho_truc_co_tho_the', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_aoe', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_knockback', player)).toBe(true)

    const thoCauThuat = gameManager.skillManager.get('tho_cau_thuat')

    expect(thoCauThuat?.earthAoeRadius).toBeGreaterThanOrEqual(1)
    expect(thoCauThuat?.earthAoeSecondaryDamagePercent).toBeGreaterThanOrEqual(0.7)
    expect(thoCauThuat?.earthKnockbackDistance).toBeGreaterThanOrEqual(30)
    expect(thoCauThuat?.thoTheGainPerCast).toBeGreaterThanOrEqual(1)
  })
})
