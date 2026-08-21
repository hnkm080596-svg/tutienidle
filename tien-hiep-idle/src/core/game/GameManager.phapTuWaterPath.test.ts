import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Plans/waterpath (2026-08-21) — Thủy đi theo ĐÚNG khuôn Hỏa (xem
// GameManager.phapTuFirePath.test.ts): 1 Active Skill/hành, Node Tree
// Luyện Khí (3 Minor) + Trúc Cơ (2 Major loại trừ nhau + Minor đi kèm).
// Feedback (2026-08-21) — KHÁC Hỏa: Thủy Tiễn Thuật KHÔNG học sẵn miễn
// phí nữa, phải mua node "Lĩnh Ngộ Thủy" (thuy_linh_ngo, 2 Skill Point)
// TRƯỚC — node này là prerequisite của MỌI node khác trong hành, kể cả
// Luyện Khí.
describe('GameManager — Pháp Tu waterpath (Thủy Node Tree Luyện Khí/Trúc Cơ)', () => {
  it('Thủy Luyện Khí: 3 Minor mua được sau khi Lĩnh Ngộ Thủy, KHÔNG mua được trước đó', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 5

    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('thuy_tien_thuat')?.unlocked).toBe(true)

    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_haste', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_application', player)).toBe(true)

    expect(player.skillPoints).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.projectileSpeedPercent).toBeGreaterThanOrEqual(0.05)
    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Thủy Trúc Cơ: Major Dẫn Lưu/Tụ Thủy bị chặn trước Trúc Cơ, loại trừ lẫn nhau sau khi mua 1 trong 2', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('thuy_truc_co_dan_luu', player)).toBe(false)

    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('thuy_truc_co_dan_luu', player)).toBe(true)
    expect(gameManager.purchaseNode('thuy_truc_co_tu_thuy', player)).toBe(false)
  })

  it('Thủy Trúc Cơ: Thủy Nguyên + Lưu Tốc (minor chung) chỉ cần Trúc Cơ, không cần chọn Major nào', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 4
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_water_heart', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_cast_speed', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.cooldownReduction).toBeGreaterThanOrEqual(0.03)
  })

  it('Thủy Trúc Cơ Reaction: Dẫn Lưu cấp thật elementApplicationPercent + waterReactionExtensionSeconds, Cộng Lưu CHẶN nếu chưa chọn Dẫn Lưu', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_water_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('thuy_truc_co_dan_luu', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.15)
    expect(gameManager.skillManager.get('thuy_tien_thuat')?.waterReactionExtensionSeconds).toBeGreaterThanOrEqual(1)
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.05)
  })

  it('Thủy Trúc Cơ Pure: Tụ Thủy cấp thuyThePercent, Thủy Mạch/Nhu Lưu CHẶN nếu chưa chọn Tụ Thủy', () => {
    const gameManager = new GameManager()

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    const player = createDefaultPlayer()

    player.skillPoints = 10
    player.realmId = 'foundation'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_water_channeling', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_water_softness', player)).toBe(false)

    expect(gameManager.purchaseNode('thuy_truc_co_tu_thuy', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_channeling', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_softness', player)).toBe(true)

    // Tụ Thủy flat 0.05 + Thủy Mạch flat 0.02 + Nhu Lưu flat 0.02.
    expect(gameManager.skillManager.get('thuy_tien_thuat')?.thuyThePercent).toBeGreaterThanOrEqual(0.09)
  })
})
