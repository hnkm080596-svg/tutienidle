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
    // MP modifiers emit only when the path owns the phap_tu domain
    // (emission gate in getTechniqueTierModifiers) -- default player has
    // cultivationPath undefined, so the path must be set explicitly.
    player.cultivationPath = 'phap_tu'

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
    // cultivationPath 'phap_tu' also pulls the kit's +100 maxMp flat
    // (phap_tu_linh_luc) into the same aggregation.
    const stats = calculateStats(player.baseStats, modifiers as StatModifier[])

    expect(stats.maxMp).toBeCloseTo((player.baseStats.maxMp + 100) * 1.03)
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
    player.cultivationPath = 'phap_tu'
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

  // Emission gate (MP is a phap_tu-domain resource): a path that does
  // not own the phap_tu domain must not receive the MP family, even
  // though the technique still legally authors the fields -- the
  // domain gate cannot perform this credential check, emission does.
  it('the_tu player + kim_cang_bat_hoai_the emits NO MP-family modifiers; hpRegenPerTurn still emits', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'the_tu'

    gameManager.realmAdvanceOps.learnTechnique('kim_cang_bat_hoai_the')
    gameManager.realmAdvanceOps.equipTechnique('kim_cang_bat_hoai_the')

    const modifiers = gameManager.effectOps.getAggregatedModifiers(player)

    expect(
      modifiers.filter(
        (modifier) =>
          modifier.sourceType === 'technique' &&
          (modifier.stat === 'maxMp' || modifier.stat === 'manaRegenPerTurn'),
      ),
    ).toHaveLength(0)
    // Positive control: only the MP family is gated -- the authored
    // universal hpRegenFlat (2 at So Nhap) still reaches the player.
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'kim_cang_bat_hoai_the',
        stat: 'hpRegenPerTurn',
        flat: 2,
      }),
    )
  })

  it('kiem_tu player + ngu_kiem emits NO MP-family modifiers; hpRegenPerTurn still emits', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'

    gameManager.realmAdvanceOps.learnTechnique('ngu_kiem')
    gameManager.realmAdvanceOps.equipTechnique('ngu_kiem')

    const modifiers = gameManager.effectOps.getAggregatedModifiers(player)

    expect(
      modifiers.filter(
        (modifier) =>
          modifier.sourceType === 'technique' &&
          (modifier.stat === 'maxMp' || modifier.stat === 'manaRegenPerTurn'),
      ),
    ).toHaveLength(0)
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'ngu_kiem',
        stat: 'hpRegenPerTurn',
        flat: 1.5,
      }),
    )
  })

  it('phap_tu_an player + ngo_dao_chan_quyet still emits the MP family (the hidden path owns the phap_tu domain)', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu_an'

    gameManager.realmAdvanceOps.learnTechnique('ngo_dao_chan_quyet')
    gameManager.realmAdvanceOps.equipTechnique('ngo_dao_chan_quyet')

    const modifiers = gameManager.effectOps.getAggregatedModifiers(player)

    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'ngo_dao_chan_quyet',
        stat: 'maxMp',
        percent: 0.03,
        domain: 'phap_tu',
      }),
    )
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'ngo_dao_chan_quyet',
        stat: 'manaRegenPerTurn',
        flat: 0.5,
        domain: 'phap_tu',
      }),
    )
  })
})
