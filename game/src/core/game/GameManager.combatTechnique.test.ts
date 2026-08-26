import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { calculateStats, type StatModifier } from '../stats/StatCalculator'

// Tâm pháp Pháp Tu (plan §9 + balance pass 2026-08-26): Đại Ngũ Hành
// Chân Quyết cộng CỐ ĐỊNH +2 attackRange khi equipped (không theo tier,
// không double-apply). Base range nhân vật = 5.
describe('GameManager — Technique.combatModifiers (+2 attackRange Pháp Tu)', () => {
  it('Đại Ngũ Hành equipped → tổng hợp ĐÚNG MỘT modifier +2 attackRange', () => {
    const gameManager = new GameManager()

    gameManager.registerTechniqueTemplates(TECHNIQUES)
    gameManager.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()

    gameManager.learnTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.equipTechnique('dai_ngu_hanh_chan_quyet')

    const modifiers = gameManager.getAggregatedModifiers(player)
    const rangeModifiers = modifiers.filter((modifier) => modifier.stat === 'attackRange')

    expect(rangeModifiers).toHaveLength(1)
    expect(rangeModifiers[0]).toMatchObject({
      id: 'technique:dai_ngu_hanh_chan_quyet:attack_range',
      sourceId: 'dai_ngu_hanh_chan_quyet',
      sourceType: 'technique',
      flat: 2,
    })

    // Range nền thực tế của Pháp Tu = base 5 + flat 2 = 7 (plan §2.4 +
    // balance pass 2026-08-26).
    const stats = calculateStats(
      player.baseStats,
      modifiers as StatModifier[],
    )

    expect(stats.attackRange).toBe(7)
  })

  it('chưa equip tâm pháp nào → KHÔNG có bonus attackRange', () => {
    const gameManager = new GameManager()

    gameManager.registerTechniqueTemplates(TECHNIQUES)

    const player = createDefaultPlayer()

    // Tụ Linh Quyết (tu luyện) không khai combatModifiers — nhưng equip
    // nó để chứng minh bonus chỉ đến từ tâm pháp CÓ khai field này.
    gameManager.learnTechnique('tu_linh_quyet')
    gameManager.equipTechnique('tu_linh_quyet')

    const rangeModifiers = gameManager
      .getAggregatedModifiers(player)
      .filter((modifier) => modifier.stat === 'attackRange')

    expect(rangeModifiers).toHaveLength(0)

    const stats = calculateStats(player.baseStats, gameManager.getAggregatedModifiers(player))

    expect(stats.attackRange).toBe(5)
  })

  it('bonus KHÔNG nằm trong tierEffects — không scale theo tier, không cộng hai lần', () => {
    const gameManager = new GameManager()

    gameManager.registerTechniqueTemplates(TECHNIQUES)

    gameManager.learnTechnique('dai_ngu_hanh_chan_quyet')

    const technique = gameManager.techniqueManager.get('dai_ngu_hanh_chan_quyet')!

    // Field combatModifiers tách biệt tierEffects.
    for (const tierEffect of Object.values(technique.tierEffects ?? {})) {
      expect('attackRange' in tierEffect).toBe(false)
    }

    gameManager.equipTechnique('dai_ngu_hanh_chan_quyet')

    // Nạp nhiều lần kinh nghiệm (tier tăng) — modifier vẫn đúng MỘT entry
    // flat 2 qua aggregation path duy nhất.
    gameManager.gainEquippedTechniqueInsight(1000)

    const player = createDefaultPlayer()
    const rangeModifiers = gameManager
      .getAggregatedModifiers(player)
      .filter((modifier) => modifier.stat === 'attackRange')

    expect(rangeModifiers).toHaveLength(1)
    expect(rangeModifiers[0]!.flat).toBe(2)
    expect(rangeModifiers[0]!.percent ?? 0).toBe(0)
  })
})
