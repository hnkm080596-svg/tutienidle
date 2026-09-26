import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { PHAP_TU_NODES } from '../data/progression/PhapTuNodes'
import { SKILLS } from '../data/skill/Skills'
import { TECHNIQUES } from '../data/technique/Techniques'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { GameManager } from '../core/game/GameManager'
import { getTribulationChapters } from '../data/tribulation/TribulationChapters'
import {
  checkTribulationOutcomeAction,
  triggerBreakthroughAction,
} from './useTribulation'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

function tribulationTotalSeconds(targetRealmId: string): number {
  return getTribulationChapters(targetRealmId)!.reduce((total, chapter) => {
    if (chapter.mind) {
      return total + chapter.mind.questionCount * (chapter.mind.firstQuestionSeconds + chapter.mind.restSecondsBetweenQuestions) + 2
    }
    return total + chapter.tank!.durationSeconds + 2
  }, 0)
}

describe('chuỗi nghi lễ tu luyện Pháp Tu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Phàm Nhân → Quán Khí → chọn Pháp Tu → Trúc Cơ giữ đúng state và reward', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()

    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    player.realmLevel = 12
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.tickOps.update(tribulationTotalSeconds('qi_refining'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    // M-F-TALENT - the victory commit wrote the qi_refining entitlement;
    // the drain (standalonePanel + run clear) is held until the modal
    // resolves it. Decide, then the next check drains normally.
    const quanKhiEntitlement = player.pendingTalentEntitlement
    expect(quanKhiEntitlement?.realmId).toBe('qi_refining')
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
      kind: 'new',
      talentId: quanKhiEntitlement!.offeredTalentIds[0]!,
    })).toBe(true)
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.realmId).toBe('mortal')
    expect(useUiStore().standalonePanel).toBe('quan_khi')

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)
    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('spell_pathway')

    player.realmLevel = 12
    // M-QI-02 - Truc Co admission also requires the chapter-final clear;
    // the played LQ->TC journey is M-QI-12's scope, so this fixture seeds it.
    player.completedStageIds = ['qi_refining_abyssal_pool']

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.tickOps.update(tribulationTotalSeconds('foundation_establishment'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    // Same mandatory decision at Truc Co - the chosen Quan Khi NEW
    // talent may also appear in the upgrade list; take a NEW card again.
    const trucCoEntitlement = player.pendingTalentEntitlement
    expect(trucCoEntitlement?.realmId).toBe('foundation_establishment')
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
      kind: 'new',
      talentId: trucCoEntitlement!.offeredTalentIds[0]!,
    })).toBe(true)
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    // M-F-ARTIFACT-DEFER: the artifact domain defers to Kim Dan+ - a
    // Truc Co tribulation grants no artifact.
    expect(player.artifact).toBeUndefined()
    // P7-M3 - the Truc Co variant folded into gradeEffects[2]: the
    // holder keeps five_elements_art and advances grade via Nang Canh.
    expect(gameManager.techniqueManager.getActive()?.id).toBe('five_elements_art')
    // Three-path design (2026-09-25, sec.4-b): the Truc Co realm reward
    // also grants the five tinh_thong_<e> mastery nodes. This fixture
    // never commits an element (spellPath.element === null): a null
    // element on spell_pathway means 'not yet committed', so the grants
    // stay DORMANT - only ngo_dao activates all five at once. Committing
    // an element then activates exactly that element's mastery.
    const spellModifiers = () => gameManager.effectOps.getAggregatedModifiers(player.$state).filter(
      modifier => modifier.sourceId === 'spell',
    )
    const masteryModifiers = () => spellModifiers().filter(
      modifier => modifier.id.startsWith('tinh_thong_'),
    )
    expect(spellModifiers()).toHaveLength(3)
    expect(masteryModifiers()).toHaveLength(0)

    // Phap Tu Reimagine (spec D5) -- element-only commit; the route arg
    // is retired (runtime fails against the pre-rework op signature
    // until ENGINE lands -- sibling-caused).
    expect(gameManager.progressionOps.selectSpellPathElement('fire', player.$state)).toBe(true)
    // Exactly one mastery wakes on commit - the fire one; the other
    // four stay dormant rather than all firing during the null window.
    expect(masteryModifiers().map((modifier) => modifier.id)).toEqual([
      'tinh_thong_hoa_ailmentPotencyPercent',
    ])
  })
})
