import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Rework combat-skill-flow-element-power-dot-plan.md §6 — Thổ dùng cùng
// bộ khung: Root Thổ Cầu Thuật → Power/Cadence/Mechanic growth →
// Keystone Định Thổ XOR Thổ Thế → specialization sau keystone cha.

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)

  gameManager.registerProgressionNodes(PHAP_TU_NODES)

  return gameManager
}

describe('GameManager — Pháp Tu EarthPath (Thổ Node Tree)', () => {
  it('Thổ Luyện Khí: growth nodes mua được sau root, KHÔNG trước đó', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('tho_cau_thuat')?.unlocked).toBe(true)
    expect(player.skillInsight).toBe(3)

    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_haste', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_impact', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Thổ Nguyên +2 Thổ Lực; Thổ Tốc +3% speed (turn-based conversion
    // 2026-09-04 — node cấp speed thay castSpeedPercent); Chấn Lúc là
    // skillModifier (skillImpactPercent) — kiểm qua runtime stats.
    expect(finalStats.earthPower).toBeGreaterThanOrEqual(2)
    expect(finalStats.speed).toBeGreaterThanOrEqual(100.03)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    expect(runtimeStats.skillImpactPercent).toBeGreaterThanOrEqual(0.02)
  })

  it('Thổ Trúc Cơ: Keystone cần Power ≥ 1 + Trúc Cơ, loại trừ lẫn nhau', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('tho_truc_co_dinh_tho', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_truc_co_dinh_tho', player)).toBe(true)
    expect(gameManager.purchaseNode('tho_truc_co_tho_the', player)).toBe(false)
  })

  it('Thổ Trúc Cơ Pure: specialization chỉ mở sau Thổ Thế; earthAoeRadius qua runtime stats', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_aoe', player)).toBe(false)

    expect(gameManager.purchaseNode('tho_truc_co_tho_the', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_aoe', player)).toBe(true)

    // Nâng Chấn Vực lên level 5: radius 1 + 0.25×4 = 2 ô.
    for (let i = 0; i < 4; i++) {
      expect(gameManager.upgradeNode('minor_earth_aoe', player)).toBe(true)
    }

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Thổ Thế keystone +5% skill impact; Chấn Vực cấp radius ≥ 2.
    expect(runtimeStats.skillImpactPercent).toBeGreaterThanOrEqual(0.05)
    expect(runtimeStats.earthAoeRadius).toBeGreaterThanOrEqual(2)

    expect(gameManager.purchaseNode('minor_earth_heart', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    expect(finalStats.earthPower).toBeGreaterThanOrEqual(3)
  })

  it('Thổ Thế keystone cấp thoTheGainPerCast — nhánh Pure tích được Thổ Thế khi cast', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(true)

    const runtimeBefore = gameManager.getSkillRuntimeStats(player)

    expect(runtimeBefore.thoTheGainPerCast).toBe(0)

    expect(gameManager.purchaseNode('tho_truc_co_tho_the', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Keystone "Thổ Thế" phải cấp nền gain per-cast (pattern Tụ Hỏa của
    // Hỏa — không có stat này thì currentThoThe không bao giờ tăng).
    expect(runtimeStats.thoTheGainPerCast).toBeGreaterThanOrEqual(1)
  })

  it('Thổ Trúc Cơ Reaction: Định Thổ cấp reactionEffectPercent, Định Lực CHẶN nếu chưa chọn', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('tho_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_earth_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('tho_truc_co_dinh_tho', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_earth_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.2)
  })
})
