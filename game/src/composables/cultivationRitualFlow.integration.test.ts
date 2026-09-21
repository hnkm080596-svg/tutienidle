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

    player.realmLevel = 12
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.tickOps.update(tribulationTotalSeconds('qi_refining'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.realmId).toBe('mortal')
    expect(useUiStore().standalonePanel).toBe('quan_khi')

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)
    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('spell_pathway')

    player.realmLevel = 12

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.tickOps.update(tribulationTotalSeconds('foundation_establishment'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    expect(player.artifact?.artifactId).toBe('ngu_hanh_chau')
    // P7-M3 - the Truc Co variant folded into gradeEffects[2]: the
    // holder keeps five_elements_art and advances grade via Nang Canh.
    expect(gameManager.techniqueManager.getActive()?.id).toBe('five_elements_art')
    expect(gameManager.effectOps.getAggregatedModifiers(player.$state).filter(
      modifier => modifier.sourceId === 'spell',
    )).toHaveLength(3)
  })
})
