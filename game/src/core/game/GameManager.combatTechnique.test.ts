import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { calculateStats, type StatModifier } from '../stats/StatCalculator'

// stat-system-reimagined Task 3 (D16/D17) — the old fixed +2 range
// combatModifiers retired with the attackRange stat; the technique MP
// tier fields are now plain authoring percents emitted as
// {stat, percent, domain:'phap_tu'} modifiers so the Task-7 domain gate
// accepts them once MP stats are gated.
describe('GameManager — technique tier MP modifiers (phap_tu domain)', () => {
  it('Đại Ngũ Hành equipped (Sơ Nhập) → percent modifiers on maxMp/manaRegenPerTurn carry domain phap_tu', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()

    gameManager.realmAdvanceOps.learnTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.realmAdvanceOps.equipTechnique('dai_ngu_hanh_chan_quyet')

    const modifiers = gameManager.effectOps.getAggregatedModifiers(player)

    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'dai_ngu_hanh_chan_quyet',
        stat: 'maxMp',
        percent: 0.03,
        domain: 'phap_tu',
      }),
    )
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'dai_ngu_hanh_chan_quyet',
        stat: 'manaRegenPerTurn',
        percent: 0.005,
        domain: 'phap_tu',
      }),
    )
    // mpRegenFlat rides the same gated stat.
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        stat: 'manaRegenPerTurn',
        flat: 0.5,
        domain: 'phap_tu',
      }),
    )
    // HP regen stays a universal-stat grant (no domain credential).
    expect(modifiers).toContainEqual(
      expect.objectContaining({ stat: 'hpRegenPerTurn', flat: 0.5 }),
    )
    expect(
      modifiers.find((m) => m.stat === 'hpRegenPerTurn')?.domain,
    ).toBeUndefined()

    // Percent applies to the live stats through the normal pipeline.
    const stats = calculateStats(player.baseStats, modifiers as StatModifier[])

    expect(stats.maxMp).toBeCloseTo(player.baseStats.maxMp * 1.03)
  })

  it('không technique nào còn khai combatModifiers (field retired với attackRange)', () => {
    for (const technique of TECHNIQUES) {
      expect(technique.combatModifiers ?? []).toHaveLength(0)
    }
  })

  it('tier KHÔNG phát thêm modifier khi insight tăng tier — grant phát lại theo tier mới, không cộng dồn', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)

    gameManager.realmAdvanceOps.learnTechnique('dai_ngu_hanh_chan_quyet')
    gameManager.realmAdvanceOps.equipTechnique('dai_ngu_hanh_chan_quyet')

    const player = createDefaultPlayer()
    const before = gameManager.effectOps
      .getAggregatedModifiers(player)
      .filter((modifier) => modifier.sourceType === 'technique')

    // Đại Thành tier (insight >= 30% of 3000): mỗi stat vẫn ĐÚNG MỘT
    // modifier entry, chỉ giá trị đổi theo tier.
    gameManager.rewardOps.gainEquippedTechniqueInsight(900)

    const after = gameManager.effectOps
      .getAggregatedModifiers(player)
      .filter((modifier) => modifier.sourceType === 'technique')

    expect(after).toHaveLength(before.length)
    expect(
      after.filter((modifier) => modifier.stat === 'maxMp'),
    ).toHaveLength(1)
    expect(
      after.find((modifier) => modifier.stat === 'maxMp')?.percent,
    ).toBe(0.05)
  })
})
