import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Plans/PoisonPath (2026-08-21) — Mộc đi theo ĐÚNG khuôn Hỏa/Thủy (xem
// GameManager.phapTuFirePath.test.ts/phapTuWaterPath.test.ts): 1 Active
// Skill/hành, Node Tree Luyện Khí (3 Minor) + Trúc Cơ (2 Major loại trừ
// nhau + Minor đi kèm). KHÁC Hỏa/Thủy: Major Pure ("Độc Căn") cấp 2 stat
// cùng lúc (poisonRootPercentPerStack + poisonRootMaxStacks) — nền 0/0
// tắt hẳn cơ chế. Feedback (2026-08-21) — Độc Chưởng KHÔNG học sẵn miễn
// phí nữa, phải mua node "Lĩnh Ngộ Mộc" (moc_linh_ngo, 2 Skill Point)
// TRƯỚC — node này là prerequisite của MỌI node khác trong hành.
describe('GameManager — Pháp Tu PoisonPath (Mộc Node Tree Luyện Khí/Trúc Cơ)', () => {
  it('Mộc Luyện Khí: 3 Minor mua được sau khi Lĩnh Ngộ Mộc, KHÔNG mua được trước đó', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 5

    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('doc_chuong')?.unlocked).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_duration', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_potency', player)).toBe(true)

    expect(player.skillPoints).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    // Độc Nguyên flat 0.03 + Độc Thực flat 0.05.
    expect(finalStats.ailmentPotencyPercent).toBeGreaterThanOrEqual(0.08)
    expect(finalStats.ailmentDurationPercent).toBeGreaterThanOrEqual(0.1)
  })

  it('Mộc Trúc Cơ: Major Độc Dẫn/Độc Căn bị chặn trước Trúc Cơ, loại trừ lẫn nhau sau khi mua 1 trong 2', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('moc_truc_co_doc_dan', player)).toBe(false)

    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('moc_truc_co_doc_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('moc_truc_co_doc_can', player)).toBe(false)
  })

  it('Mộc Trúc Cơ: Độc Linh + Độc Trường (minor chung) chỉ cần Trúc Cơ, không cần chọn Major nào', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 4
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_heart', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_duration_chung', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.ailmentPotencyPercent).toBeGreaterThanOrEqual(0.05)
    expect(finalStats.ailmentDurationPercent).toBeGreaterThanOrEqual(0.1)
  })

  it('Mộc Trúc Cơ Reaction: Độc Dẫn cấp thật reactionEffectPercent, Cộng Độc CHẶN nếu chưa chọn Độc Dẫn', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_truc_co_doc_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    // Độc Dẫn flat 0.2 + Cộng Độc flat 0.05.
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.25)
  })

  it('Mộc Trúc Cơ Pure: Độc Căn cấp poisonRootPercentPerStack + poisonRootMaxStacks, Độc Uyên/Độc Mạch CHẶN nếu chưa chọn Độc Căn', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_channeling', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_wood_threshold', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_truc_co_doc_can', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_channeling', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_threshold', player)).toBe(true)

    const docChuong = gameManager.skillManager.get('doc_chuong')

    expect(docChuong?.poisonRootPercentPerStack).toBeGreaterThanOrEqual(0.03)
    // Độc Căn major flat 5 + Độc Uyên minor flat 1.
    expect(docChuong?.poisonRootMaxStacks).toBeGreaterThanOrEqual(6)
    expect(docChuong?.poisonRootThresholdBonusPercent).toBeGreaterThanOrEqual(0.05)
  })
})
