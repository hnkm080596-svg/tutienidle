import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Rework combat-skill-flow-element-power-dot-plan.md §6 — Mộc dùng cùng
// bộ khung Hỏa: Root Độc Chưởng (2 SP) → Power Độc Nguyên (10 cấp) →
// Độc Mạch/Độc Tức growth (5 cấp) → Keystone Độc Dẫn XOR Mộc Thế →
// specialization sau keystone cha. Modifier suy ra qua aggregator.

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)

  gameManager.registerProgressionNodes(PHAP_TU_NODES)

  return gameManager
}

describe('GameManager — Pháp Tu PoisonPath (Mộc Node Tree)', () => {
  it('Mộc Luyện Khí: growth nodes mua được sau khi Lĩnh Ngộ Mộc, KHÔNG trước đó', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('doc_chuong')?.unlocked).toBe(true)
    // Root tốn 2 Skill Point.
    expect(player.skillInsight).toBe(3)

    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_duration', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_threshold', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Độc Nguyên +2 Mộc Lực; Độc Tức +4% duration; Độc Mạch +3% cast speed.
    expect(finalStats.woodPower).toBeGreaterThanOrEqual(2)
    expect(finalStats.ailmentDurationPercent).toBeGreaterThanOrEqual(0.04)
    expect(finalStats.speed).toBeGreaterThanOrEqual(100.03)
  })

  it('Mộc Trúc Cơ: Keystone cần Power ≥ 1 + Trúc Cơ, loại trừ lẫn nhau', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('moc_truc_co_doc_dan', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('moc_truc_co_doc_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('moc_truc_co_doc_can', player)).toBe(false)
  })

  it('Mộc Trúc Cơ Pure: specialization chỉ mở sau Mộc Thế', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_heart', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_wood_duration_chung', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_truc_co_doc_can', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_heart', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_duration_chung', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Độc Linh +3 Mộc Lực/cấp; Độc Trưởng +3% duration/cấp.
    expect(finalStats.woodPower).toBeGreaterThanOrEqual(3)
    expect(finalStats.ailmentDurationPercent).toBeGreaterThanOrEqual(0.03)
  })

  it('Mộc Trúc Cơ Reaction: Độc Dẫn cấp reactionEffectPercent, Cộng Độc CHẶN nếu chưa chọn Độc Dẫn', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_truc_co_doc_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Độc Dẫn 0.15 + Cộng Độc level 1: 0.05.
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.2)
  })

  it('Mộc Trúc Cơ Pure: Mộc Thế cấp poisonRootMaxStacks qua getSkillRuntimeStats(player)', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('moc_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_wood_channeling', player)).toBe(false)

    expect(gameManager.purchaseNode('moc_truc_co_doc_can', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_wood_channeling', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Mộc Thế keystone +1 tầng, Độc Uyển level 1 +1 tầng.
    expect(runtimeStats.poisonRootMaxStacks).toBeGreaterThanOrEqual(2)

    // Skill instance KHÔNG bị mutate (plan §6.8).
    expect(gameManager.skillManager.get('doc_chuong')!.poisonRootMaxStacks ?? 0).toBeLessThanOrEqual(0.001)
  })
})
