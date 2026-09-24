// QA repro (sealed review, BETA-HIDDEN-A @ 762d456c): a committed-but-
// undrained HIDDEN tribulation outcome loses `breakthroughType` across
// the v82 save slice. TribulationRuntimeSave/TribulationSaveSlice drop
// the field the in-memory CommittedTribulationOutcome requires (that
// omission is also the `npx vue-tsc --build` failure at
// TribulationDirector.ts:115/:801). Post-restore settle resolves the
// hidden victory as non-hidden: no hiddenBreakthroughRealmIds record,
// outcomeGrade never becomes 'great_dao', the enhanced passive never
// selects, and the pham_cot -> pham_nhan_chi_cot conversion is skipped.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from './TribulationOutcomeService'
import { asBaseStats } from '../stats/StatBlock'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { pills } from '../../data/pill/pills'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { completeHiddenBody } from '../realm/hidden/HiddenLineage'
import { getEffectiveMainStatCap } from '../stats/StatCap'
import { MAIN_STAT_KEYS } from '../stats/StatTypes'

function driveToTerminal(gameManager: GameManager) {
  let guard = 0
  while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
    gameManager.tickOps.update(1)
    const q = gameManager.tribulationDirector.getState()!.currentQuestion
    if (q) {
      gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }
  }
}

function statsAtEffectiveCap(player: ReturnType<typeof usePlayerStore>) {
  const cap = getEffectiveMainStatCap(player.$state)
  player.baseStats = asBaseStats({
    ...player.baseStats,
    ...Object.fromEntries(MAIN_STAT_KEYS.map((k) => [k, cap])),
    maxHp: 5_000_000,
    defense: 50_000,
    hpRegenPerTurn: 0,
  })
}

describe('hidden breakthroughType persistence across serializeRuntime/restoreRuntime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('committed hidden outcome keeps breakthroughType through the save slice', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)

    // Hidden mortal commit -> qi_refining.
    player.realmId = 'mortal'
    player.realmLevel = 18
    expect(completeHiddenBody(player.$state, 'mortal')).toBeDefined()
    statsAtEffectiveCap(player)
    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state),
    ).toBe(true)
    expect(player.hiddenPerfection.hiddenBreakthroughRealmIds).toEqual(['qi_refining'])

    // Hidden qi_refining body + full eligibility for the hidden foundation attempt.
    expect(completeHiddenBody(player.$state, 'qi_refining')).toBeDefined()
    player.realmLevel = 18
    player.completedStageIds = ['qi_refining_abyssal_pool']
    statsAtEffectiveCap(player)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()?.breakthroughType).toBe('hidden')
    driveToTerminal(gameManager)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(committed.outcome).toBe('victory')
    expect(committed.breakthroughType).toBe('hidden')

    // The persisted slice drops the field outright.
    const slice = JSON.parse(JSON.stringify(gameManager.tribulationDirector.serializeRuntime()))
    console.log('persisted slice breakthroughType =', slice.committedOutcome.breakthroughType)

    // Fresh boot: the restored committed record cannot be resolved as hidden.
    const restored = new GameManager()
    restored.tribulationDirector.restoreRuntime(slice)
    const restoredOutcome = restored.tribulationDirector.getCommittedOutcome()!
    console.log('restored committed breakthroughType =', restoredOutcome.breakthroughType)

    // Settling the restored record must apply the HIDDEN victory contract.
    const service = new TribulationOutcomeService()
    service.settleOutcome(player, restored, restored.tribulationDirector)
    console.log(
      'post-settle: hiddenBreakthroughRealmIds =',
      player.hiddenPerfection.hiddenBreakthroughRealmIds,
      '| highestFoundationAchieved =',
      player.highestFoundationAchieved,
      '| lineageActive =',
      player.hiddenPerfection.lineageActive,
    )
    expect(slice.committedOutcome.breakthroughType).toBe('hidden')
    expect(restoredOutcome.breakthroughType).toBe('hidden')
    expect(player.realmId).toBe('foundation_establishment')
    expect(player.hiddenPerfection.hiddenBreakthroughRealmIds).toContain(
      'foundation_establishment',
    )
    expect(player.highestFoundationAchieved).toBe('great_dao')
    expect(player.hiddenPerfection.lineageActive).toBe(true)
  })
})
