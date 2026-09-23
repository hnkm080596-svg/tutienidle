// CompanionGifts seam wiring (M-F-COMPANION-GIFT Step 4) - proves the
// authored fire seams call issueCompanionGifts with the right trigger
// shape. The real impl stays under the spy so records land for real and
// idempotency is observable end-to-end.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from '../tribulation/TribulationOutcomeService'
import type { ActiveTribulationState } from '../tribulation/TribulationDirector'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import type { Stage } from '../stage/Stage'
import type { BattleLootSystem } from '../game/BattleLootSystem'
import type { StageWaveSystem } from '../game/StageWaveSystem'
import { EventBus } from '../events/EventBus'
import { GameManagerBattleRewardOps } from '../game/GameManagerBattleRewardOps'
import { issueCompanionGifts } from './CompanionGifts'
import { COMPANION_GIFT_MOMENTS } from '../../data/companion/CompanionGiftMoments'
import { createDefaultPlayer } from '../player/Player'
import { pills } from '../../data/pill/pills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { CORE_REALM_LEVEL } from '../realm/realmSystem'

vi.mock('./CompanionGifts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CompanionGifts')>()
  return {
    ...actual,
    issueCompanionGifts: vi.fn(actual.issueCompanionGifts),
  }
})

const issueSpy = vi.mocked(issueCompanionGifts)

function makeActive(
  state: 'victory' | 'defeat',
  targetRealmId: string,
  grade: 'heaven' | 'great_dao' = 'heaven',
): ActiveTribulationState {
  return {
    targetRealmId,
    grade,
    chapterIndex: 0,
    chaptersTotal: 1,
    chapterName: '',
    state,
    currentQuestion: null,
    questionSecondsRemaining: 0,
    questionSecondsLimit: 0,
    secondsRemaining: 0,
  } as ActiveTribulationState
}

describe('realm_entered gift seam', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    issueSpy.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a Truc Co tribulation victory issues the authored entry gift exactly once', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    const result = service.resolveVictory(
      player,
      gameManager,
      makeActive('victory', 'foundation_establishment'),
    )

    expect(result.realmEntered).toBe('foundation_establishment')
    expect(issueSpy).toHaveBeenCalledWith(player, {
      kind: 'realm_entered',
      realmId: 'foundation_establishment',
    })
    expect(player.companionGifts).toEqual([
      {
        id: 'gift_than_nong_foundation_entry',
        definitionId: 'than_nong',
        claimed: false,
      },
    ])

    // Repeat fire (e.g. a settled outcome re-applied) is write-if-absent.
    issueSpy.mockClear()
    gameManager.realmAdvanceOps.applyCompanionGiftRealmTransition(player.$state)
    expect(issueSpy).toHaveBeenCalledTimes(1)
    expect(player.companionGifts).toHaveLength(1)
  })

  it('a qi_refining victory is announcement-only: no realm write, no gift seam', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    const result = service.resolveVictory(
      player,
      gameManager,
      makeActive('victory', 'qi_refining'),
    )

    expect(result.realmEntered).toBeNull()
    expect(player.realmId).toBe('mortal')
    expect(issueSpy).not.toHaveBeenCalled()
    expect(player.companionGifts).toHaveLength(0)
  })

  it('chooseCultivationPath promotion fires the realm_entered seam', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = createDefaultPlayer()
    // The initiation ritual requires a max-level mortal.
    player.realmLevel = CORE_REALM_LEVEL

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player),
    ).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(issueSpy).toHaveBeenCalledWith(player, {
      kind: 'realm_entered',
      realmId: 'qi_refining',
    })
    // No authored moment targets qi_refining (deferred list) - wired but
    // correctly silent.
    expect(player.companionGifts).toHaveLength(0)
  })
})

describe('stage_completed gift seam', () => {
  function makeOps(player: ReturnType<typeof createDefaultPlayer>, stageId: string) {
    const battle = {
      state: 'victory',
      enemies: [{ entity: { id: 'e1', alive: false } }],
      players: [{ entity: { id: 'p1', alive: true } }],
      roundsElapsed: 5,
    } as unknown as TurnBattle
    const stage = { id: stageId, perfectClearTurnLimit: undefined } as unknown as Stage

    const ops = new GameManagerBattleRewardOps({
      getTurnBattle: () => battle,
      getActiveStage: () => stage,
      getPlayerData: () => player,
      getStartedAtMs: () => null,
      getRepeatContinuously: () => false,
      battleLoot: {
        processDefeatedEnemies: vi.fn(),
        settleTechniqueMastery: vi.fn(),
      } as unknown as BattleLootSystem,
      stageWaves: { stopRepeat: vi.fn() } as unknown as StageWaveSystem,
      eventBus: new EventBus(),
      bankPassiveCarry: vi.fn(),
    })
    return ops
  }

  beforeEach(() => {
    issueSpy.mockClear()
  })

  it('the first floor-10 victory appends the khai_minh gift record', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    const ops = makeOps(player, 'foundation_floor_10')

    ops.grantBattleRewardIfNeeded()

    expect(player.completedStageIds).toContain('foundation_floor_10')
    expect(issueSpy).toHaveBeenCalledWith(player, {
      kind: 'stage_completed',
      stageId: 'foundation_floor_10',
    })
    expect(player.companionGifts).toEqual([
      {
        id: 'gift_khai_minh_foundation_floor_10',
        definitionId: 'khai_minh',
        claimed: false,
      },
    ])
  })

  it('a refight win on an already-completed stage issues nothing', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.completedStageIds.push('foundation_floor_10')
    const ops = makeOps(player, 'foundation_floor_10')

    ops.grantBattleRewardIfNeeded()

    expect(issueSpy).not.toHaveBeenCalled()
    expect(player.companionGifts).toHaveLength(0)
  })

  it('a victory on a stage with no authored moment issues nothing', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    const ops = makeOps(player, 'foundation_floor_9')

    ops.grantBattleRewardIfNeeded()

    expect(
      COMPANION_GIFT_MOMENTS.some(
        (moment) =>
          moment.trigger.kind === 'stage_completed' &&
          moment.trigger.stageId === 'foundation_floor_9',
      ),
    ).toBe(false)
    expect(player.companionGifts).toHaveLength(0)
  })
})
