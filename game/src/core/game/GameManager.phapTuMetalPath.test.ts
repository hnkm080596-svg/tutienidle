import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// Rework combat-skill-flow-element-power-dot-plan.md §6 — Kim dùng cùng
// bộ khung: Root Điểm Kim Thuật → Power/Cadence/Mechanic growth →
// Keystone Huyết Dẫn XOR Kim Thế → specialization sau keystone cha.

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)

  gameManager.registerProgressionNodes(PHAP_TU_NODES)

  return gameManager
}

describe('GameManager — Pháp Tu MetalPath (Kim Node Tree)', () => {
  it('Kim Luyện Khí: growth nodes mua được sau root, KHÔNG trước đó', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 5

    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(false)

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.skillManager.get('diem_kim_thuat')?.unlocked).toBe(true)
    expect(player.skillInsight).toBe(3)

    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_burst', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_bleed_damage', player)).toBe(true)

    expect(player.skillInsight).toBe(0)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    // Kim Khí +2 Kim Lực; Huyết Bạo +3% cast speed; Huyết Ấn +4% potency.
    expect(finalStats.metalPower).toBeGreaterThanOrEqual(2)
    expect(finalStats.castSpeedPercent).toBeGreaterThanOrEqual(0.03)
    expect(finalStats.ailmentPotencyPercent).toBeGreaterThanOrEqual(0.04)
  })

  it('Kim Trúc Cơ: Keystone cần Power ≥ 1 + Trúc Cơ, loại trừ lẫn nhau', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('kim_truc_co_huyet_dan', player)).toBe(false)

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_truc_co_huyet_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('kim_truc_co_kim_the', player)).toBe(false)
  })

  it('Kim Trúc Cơ Pure: specialization chỉ mở sau Kim Thế; kimTheMaxStacks qua runtime stats', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_metal_channeling', player)).toBe(false)

    expect(gameManager.purchaseNode('kim_truc_co_kim_the', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_channeling', player)).toBe(true)

    // Nâng Kim Uyển lên level 3 (+1 tầng ở cấp 1, +3 tầng ở cấp 5).
    expect(gameManager.upgradeNode('minor_metal_channeling', player)).toBe(true)
    expect(gameManager.upgradeNode('minor_metal_channeling', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Kim Thế keystone +1; Kim Uyển level 3: 1 + 0.5×2 = 2 → tổng ≥ 3.
    expect(runtimeStats.kimTheMaxStacksBonus).toBeGreaterThanOrEqual(3)

    expect(gameManager.purchaseNode('minor_metal_shatter', player)).toBe(true)

    const runtimeAfterShatter = gameManager.getSkillRuntimeStats(player)

    // Huyết Phá level 1: 0.005.
    expect(
      runtimeAfterShatter.kimTheDotResistancePenetrationPercentPerStack,
    ).toBeGreaterThanOrEqual(0.005)
  })

  it('Kim Thế keystone cấp kimTheGainPerProc — nhánh Pure tích được Kim Thế khi proc Xuất Huyết', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)

    const runtimeBefore = gameManager.getSkillRuntimeStats(player)

    expect(runtimeBefore.kimTheGainPerProc).toBe(0)

    expect(gameManager.purchaseNode('kim_truc_co_kim_the', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Keystone "Kim Thế" phải cấp nền gain per-proc (pattern Tụ Hỏa của
    // Hỏa — không có stat này thì currentKimThe không bao giờ tăng).
    expect(runtimeStats.kimTheGainPerProc).toBeGreaterThanOrEqual(1)
  })

  it('Huyết Phá node cấp huyetPhaGainPerProc + huyetPhaBurstDamage cùng lúc (BattleSystem.huyetPha contract)', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)
    expect(gameManager.purchaseNode('kim_truc_co_kim_the', player)).toBe(true)

    const runtimeBefore = gameManager.getSkillRuntimeStats(player)

    expect(runtimeBefore.huyetPhaGainPerProc).toBe(0)
    expect(runtimeBefore.huyetPhaBurstDamage).toBe(0)

    expect(gameManager.purchaseNode('minor_metal_shatter', player)).toBe(true)

    const runtimeStats = gameManager.getSkillRuntimeStats(player)

    // Node "Huyết Phá" cấp CẢ HAI stat cùng lúc — charge không burst thì
    // chạm ngưỡng chỉ reset về 0 mà không damage (xem
    // BattleSystem.huyetPha.test.ts "huyetPhaBurstDamage=0").
    expect(runtimeStats.huyetPhaGainPerProc).toBeGreaterThanOrEqual(1)
    expect(runtimeStats.huyetPhaBurstDamage).toBeGreaterThan(0)
  })

  it('Kim Trúc Cơ Reaction: Huyết Dẫn cấp reactionEffectPercent, Cộng Huyết CHẶN nếu chưa chọn', () => {
    const gameManager = setup()

    const player = createDefaultPlayer()

    player.skillInsight = 30
    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kim_linh_ngo', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_intensity', player)).toBe(true)

    expect(gameManager.purchaseNode('minor_metal_reaction_effect', player)).toBe(false)

    expect(gameManager.purchaseNode('kim_truc_co_huyet_dan', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_metal_reaction_effect', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(player),
    ])

    expect(finalStats.reactionEffectPercent).toBeGreaterThanOrEqual(0.2)
  })
})
