import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { calculateStats, type StatModifier } from '../stats/StatCalculator'

// stat-system-reimagined Task 3 (D16/D17) — the old fixed +2 range
// combatModifiers retired with the attackRange stat; the technique MP
// tier fields are now plain authoring percents emitted as
// {stat, percent, domain:'spell'} modifiers so the Task-7 domain gate
// accepts them once MP stats are gated.
describe('GameManager — technique grade MP modifiers (spell domain)', () => {
  it('Tiểu Ngũ Hành active (rank 0 / Sơ Nhập) → percent modifiers on maxMp/manaRegenPerTurn carry domain spell', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    // MP modifiers emit only when the path owns the spell domain
    // (emission gate in getTechniqueTierModifiers) -- default player has
    // cultivationPath undefined, so the path+way pair must be set explicitly.
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'qi_refining'

    gameManager.realmAdvanceOps.grantCanonicalTechnique('five_elements_art', player)

    const modifiers = gameManager.effectOps.getAggregatedModifiers(player)

    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'five_elements_art',
        stat: 'maxMp',
        percent: 0.03,
        domain: 'spell',
      }),
    )
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'five_elements_art',
        stat: 'manaRegenPerTurn',
        percent: 0.005,
        domain: 'spell',
      }),
    )
    // mpRegenFlat rides the same gated stat.
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        stat: 'manaRegenPerTurn',
        flat: 0.5,
        domain: 'spell',
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
    // cultivationPath 'spell' also pulls the kit's +100 maxMp flat
    // (phap_tu_linh_luc) into the same aggregation.
    const stats = calculateStats(player.baseStats, modifiers as StatModifier[])

    expect(stats.maxMp).toBeCloseTo((player.baseStats.maxMp + 100) * 1.03)
  })

  it('không technique nào còn khai combatModifiers (field retired với attackRange)', () => {
    for (const technique of TECHNIQUES) {
      expect(technique.combatModifiers ?? []).toHaveLength(0)
    }
  })

  it('rank band KHÔNG phát thêm modifier khi mastery tăng rank — grant phát lại theo band mới, không cộng dồn', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)

    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.realmId = 'qi_refining'
    gameManager.realmAdvanceOps.grantCanonicalTechnique('five_elements_art', player)

    const before = gameManager.effectOps
      .getAggregatedModifiers(player)
      .filter((modifier) => modifier.sourceType === 'technique')

    // Dai Thanh band (rank 5: 1500 mastery at 300/rank) - each stat
    // keeps EXACTLY ONE modifier entry, only the value changes.
    gameManager.techniqueSystem.gainMastery(1500, 'qi_refining', 18)

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

  // Emission gate (MP is a spell-domain resource): a path that does
  // not own the spell domain must not receive the MP family, even
  // though the technique still legally authors the fields -- the
  // domain gate cannot perform this credential check, emission does.
  it('body player + diamond_body_art emits NO MP-family modifiers; hpRegenPerTurn still emits', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'
    player.realmId = 'qi_refining'

    gameManager.realmAdvanceOps.grantCanonicalTechnique('diamond_body_art', player)

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
        sourceId: 'diamond_body_art',
        stat: 'hpRegenPerTurn',
        flat: 2,
      }),
    )
  })

  it('sword player + sword_control_art emits NO MP-family modifiers; hpRegenPerTurn still emits', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'
    player.realmId = 'qi_refining'

    gameManager.realmAdvanceOps.grantCanonicalTechnique('sword_control_art', player)

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
        sourceId: 'sword_control_art',
        stat: 'hpRegenPerTurn',
        flat: 1.5,
      }),
    )
  })

  it('hidden-spell way player + dao_insight_art still emits the MP family (the hidden way owns the spell domain)', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'
    player.realmId = 'qi_refining'

    gameManager.realmAdvanceOps.grantCanonicalTechnique('dao_insight_art', player)

    const modifiers = gameManager.effectOps.getAggregatedModifiers(player)

    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'dao_insight_art',
        stat: 'maxMp',
        percent: 0.03,
        domain: 'spell',
      }),
    )
    expect(modifiers).toContainEqual(
      expect.objectContaining({
        sourceType: 'technique',
        sourceId: 'dao_insight_art',
        stat: 'manaRegenPerTurn',
        flat: 0.5,
        domain: 'spell',
      }),
    )
  })
})
