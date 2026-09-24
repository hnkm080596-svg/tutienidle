import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ManualClockSource } from '../core/battle/turn/CombatClock'
import { GameManager } from '../core/game/GameManager'
import { createDefaultPlayer } from '../core/player/Player'
import { usePlayerStore } from '../stores/player'
import { SKILLS } from '../data/skill/Skills'
import { TECHNIQUES } from '../data/technique/Techniques'
import { KIEM_TU_NODES } from '../data/progression/KiemTuNodes'
import { SKILL_CORE_NODES } from '../data/progression/SkillCoreNodes'
import { checkTribulationOutcomeAction } from './useTribulation'

// Beta seam repair (v82): F-W-3 pour, F-W-8 fail-closed admission,
// F-W-4 settlementError stale-entitlement clear.

beforeEach(() => {
  setActivePinia(createPinia())
})

function makeManager() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12

  return { gameManager, player }
}

describe('F-W-3 — mortal initiation pours banked cultivation overcharge', () => {
  it('chooseCultivationPath pours overcharge into qi_refining level 1', () => {
    const { gameManager, player } = makeManager()
    player.cultivationOvercharge = 500
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram', player)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player),
    ).toBe(true)

    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)
    // The pour lands inside the level-1 required budget; leftover stays banked.
    expect(player.cultivation).toBeGreaterThan(0)
    expect(player.cultivation + player.cultivationOvercharge).toBe(500)
  })
})

describe('F-W-8 — tribulation admission fails closed', () => {
  it('qi_refining entry without the chapter-final stage clear is refused', () => {
    const gameManager = new GameManager()
    gameManager.setCombatClockSource(new ManualClockSource())
    const player = usePlayerStore()
    player.$reset()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.completedStageIds = []

    expect(gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state)).toBe(false)
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(false)
  })
})

describe('F-W-4 — settlementError drain clears the stale pending entitlement', () => {
  it('a restored settlementError record drains and clears pendingTalentEntitlement', () => {
    const gameManager = new GameManager()
    gameManager.setCombatClockSource(new ManualClockSource())
    const player = usePlayerStore()
    player.$reset()
    player.realmId = 'qi_refining'
    player.realmLevel = 12

    // The failed run left a pending record bound to its realm.
    player.pendingTalentEntitlement = {
      realmId: 'foundation_establishment',
      offeredTalentIds: [],
    }

    gameManager.tribulationDirector.restoreRuntime({
      committedOutcome: {
        attemptId: 1,
        outcome: 'defeat',
        targetRealmId: 'foundation_establishment',
        grade: 'earth',
        breakthroughType: 'normal',
        receipt: null,
        settlementError: true,
      },
    })

    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
  })
})
