import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Rework combat-skill-flow-element-power-dot-plan.md §6 — Thủy dùng cùng
// bộ khung: Root Thủy Tiễn Thuật → Power/Cadence/Mechanic growth →
// Keystone Dẫn Lưu XOR Tụ Thủy → specialization sau keystone cha.

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)

  gameManager.registerProgressionNodes(PHAP_TU_NODES)

  return gameManager
}

describe('GameManager — Pháp Tu WaterPath (Thủy Node Tree)', () => {
  it('Thủy Luyện Khí: growth nodes mua được sau root, KHÔNG trước đó', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('thuy_tien_thuat')?.unlocked).toBe(true)
    expect(player.skillInsight).toBe(3)

    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_haste', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_cast_speed', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Thủy Linh +2 Thủy Lực; Thủy Tốc +0.03 speed + Lưu Tốc +0.02 speed
    // (turn-based conversion 2026-09-04 — cả 2 node giờ cấp flat speed).
    expect(finalStats.waterPower).toBeGreaterThanOrEqual(2)
    expect(finalStats.speed).toBeGreaterThanOrEqual(100.05)
  })

  it('Thủy Trúc Cơ: Keystone cần Power ≥ 1 + Trúc Cơ, loại trừ lẫn nhau', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('thuy_truc_co_dan_luu', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('thuy_truc_co_dan_luu', player)).toBe(true)
    expect(gameManager.purchaseNode('thuy_truc_co_tu_thuy', player)).toBe(false)
  })

  it('Thủy Trúc Cơ Pure: specialization chỉ mở sau Tụ Thủy; thùy thế qua runtime stats', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_water_channeling', player)).toBe(false)
    expect(gameManager.purchaseNode('minor_water_softness', player)).toBe(false)

    expect(gameManager.purchaseNode('thuy_truc_co_tu_thuy', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_water_channeling', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_softness', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Tụ Thủy keystone +5%; Thủy Mạch + Nhuyễn Lưu mỗi node level 1 +1%.
    expect(runtimeStats.thuyThePercent).toBeGreaterThanOrEqual(0.07)
  })

  it('Thủy Trúc Cơ Reaction: Dẫn Lưu cấp elementApplication, Cộng Lưu CHẶN nếu chưa chọn', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('thuy_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_water_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('thuy_truc_co_dan_luu', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_water_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Dẫn Lưu 0.15 + Cộng Lưu level 1: 0.05.
    expect(finalStats.elementApplicationPercent).toBeGreaterThanOrEqual(0.15)
    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.05)
  })
})
