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

    gameManager.registerSkillTemplates(SKILLS)
    gameManager.registerTechniqueTemplates(TECHNIQUES)
    gameManager.registerProgressionNodes(PHAP_TU_NODES)

    player.realmLevel = 12
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.update(tribulationTotalSeconds('qi_refining'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.realmId).toBe('mortal')
    expect(useUiStore().standalonePanel).toBe('quan_khi')

    expect(gameManager.chooseCultivationPath('phap_tu', player.$state)).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)

    player.realmLevel = 12

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.update(tribulationTotalSeconds('foundation_establishment'))
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)

    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    expect(player.artifact?.artifactId).toBe('ngu_hanh_chau')
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('dai_ngu_hanh_quyet_truc_co')
    expect(gameManager.getAggregatedModifiers(player.$state).filter(
      modifier => modifier.sourceId === 'phap_tu',
    )).toHaveLength(3)
  })
})
