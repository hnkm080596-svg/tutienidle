import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../core/game/GameManager'
import { createDefaultPlayer } from '../core/player/Player'
import { calculateStats } from '../core/stats/StatCalculator'
import { MERIDIANS } from '../data/realm/Meridians'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'
import { PhaserSceneAdapter } from './PhaserSceneAdapter'
import { CompositeRenderer, createVueRouteAdapter } from './VueRouteAdapter'
import { AssetBundleManager } from './assets/AssetBundleManager'
import { createGamePresentation } from './createGamePresentation'
import {
  checkTribulationOutcomeAction,
  triggerBreakthroughAction,
} from '../composables/useTribulation'

function setupPlayerReadyForQiRefining() {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.cultivation = 1000
  return player
}

describe('Tribulation routing integration (Task 11)', () => {
  let gameManager: GameManager
  let player: ReturnType<typeof setupPlayerReadyForQiRefining>
  let phaserAdapter: PhaserSceneAdapter
  let compositeRenderer: CompositeRenderer
  let assetManager: AssetBundleManager
  let coordinator: GamePresentationCoordinator
  let presentation: ReturnType<typeof createGamePresentation>
  let vueAdapter: ReturnType<typeof createVueRouteAdapter>

  beforeEach(() => {
    setActivePinia(createPinia())
    gameManager = new GameManager()
    player = setupPlayerReadyForQiRefining()
    gameManager.setActivePlayer(player)
    gameManager.setPresentationMode('interactive')

    phaserAdapter = new PhaserSceneAdapter()
    compositeRenderer = new CompositeRenderer(phaserAdapter)
    const mockLoaderScene = {
      isTextureLoaded: vi.fn(() => true),
      loadDescriptors: vi.fn(async () => {}),
    } as any
    assetManager = new AssetBundleManager({
      loaderScene: mockLoaderScene,
      domImageLoader: vi.fn(async () => {}),
    })

    coordinator = new GamePresentationCoordinator({
      sessionPort: gameManager.getPresentationPort(),
      renderer: compositeRenderer,
      curtain: {
        close: vi.fn(async () => {}),
        open: vi.fn(async () => {}),
      },
      assets: assetManager,
      initialRoute: 'home',
    })

    presentation = createGamePresentation({
      coordinator,
      eventBus: gameManager.eventBus,
      getCurrentSession: () => gameManager.getCurrentPresentationSession(),
    })

    vueAdapter = createVueRouteAdapter(coordinator, compositeRenderer)
  })

  it('no mind timeout, question advance, or lightning strike during interactive hold', async () => {
    const fakeGame = {
      scene: {
        isActive: () => true,
        start: vi.fn(),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    const playerStore = {
      $state: player,
      finalStats: calculateStats(player.baseStats, []),
      realmId: player.realmId,
      setEquipmentModifiers: vi.fn(),
    } as any

    const triggerPromise = triggerBreakthroughAction(
      playerStore,
      gameManager,
      presentation,
    )

    // Wait until transition reaches awaiting-ready
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) {
      await Promise.resolve()
    }

    const session = gameManager.getCurrentPresentationSession()!
    expect(session).toBeDefined()
    expect(session.kind).toBe('tribulation')

    const trib = gameManager.tribulationDirector.getState()!
    expect(trib).toBeDefined()
    expect(trib.state).toBe('ongoing')

    const hpBefore = trib.hp
    const questionLimit = trib.questionSecondsLimit
    const strikesBefore = trib.lightningStrikesTaken

    // Advance 30 seconds while held: nothing changes!
    gameManager.tickOps.update(30)

    const tribDuringHold = gameManager.tribulationDirector.getState()!
    expect(tribDuringHold.hp).toBe(hpBefore)
    expect(tribDuringHold.questionSecondsLimit).toBe(questionLimit)
    expect(tribDuringHold.lightningStrikesTaken).toBe(strikesBefore)
    expect(tribDuringHold.state).toBe('ongoing')

    // Answering question while held is rejected
    expect(gameManager.tribulationDirector.answerQuestion(0)).toBe(false)

    // Reveal and release
    phaserAdapter.reportReady({
      transitionId: vueAdapter.transitionId.value,
      sessionId: session.sessionId,
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)

    const started = await triggerPromise
    expect(started).toBe(true)
    expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')

    // Now answering question is accepted
    expect(gameManager.tribulationDirector.answerQuestion(0)).toBe(true)
  })

  it('rejected breakthrough attempt during battle does not unequip player gear', async () => {
    // Equip an item mock on player
    const playerWithGear = {
      $state: player,
      setEquipmentModifiers: vi.fn(),
    } as any

    const unequipSpy = vi.spyOn(gameManager.equipmentOps, 'unequipAllEquipment')

    // Simulate active battle
    vi.spyOn(gameManager, 'getBattle').mockReturnValue({
      state: 'fighting',
      id: 'mock_battle',
      player: {} as any,
      enemies: [],
    } as any)

    const started = await triggerBreakthroughAction(playerWithGear, gameManager, presentation)
    expect(started).toBe(false)

    // Unequip must NOT have been called!
    expect(unequipSpy).not.toHaveBeenCalled()
  })

  it('duplicate outcome check after clear is no-op and does not double-settle', async () => {
    const fakeGame = {
      scene: {
        isActive: () => true,
        start: vi.fn(),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    // Start in headless mode
    gameManager.setPresentationMode('headless')
    gameManager.startTribulation(player, calculateStats(player.baseStats, []), 'qi_refining')

    const active = gameManager.tribulationDirector.getState()!
    expect(active).toBeDefined()

    // The session-started event kicked off the home -> tribulation entry
    // transition; it is still in-flight here, and an outcome request issued
    // now would be rejected. In the real app the tick loop retries the
    // pending outcome until it lands - the test drives entry to completion
    // first (same readiness dance as the interactive-hold test above).
    await vi.waitFor(() => {
      expect(vueAdapter.phase.value).toBe('awaiting-ready')
    })
    const entrySession = gameManager.getCurrentPresentationSession()!
    phaserAdapter.reportReady({
      transitionId: vueAdapter.transitionId.value,
      sessionId: entrySession.sessionId,
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')
    })

    // Force victory
    active.state = 'victory'

    const playerStoreMock = {
      $state: player,
      realmId: 'mortal',
      realmLevel: 10,
      cultivation: 1000,
      selectedTalentIds: [],
    } as any

    // First check issues the home transition; the outcome work itself runs
    // inside the closed-curtain window, so the clear lands after the mocked
    // curtain resolves - a few microtasks, not synchronously.
    const firstCheck = checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)
    expect(firstCheck).toBe(true)
    await vi.waitFor(() => {
      expect(gameManager.tribulationDirector.getState()).toBeNull()
    })

    // Second check is safe no-op
    const secondCheck = checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)
    expect(secondCheck).toBe(false)
  })

  it('stale READY is rejected by phaserAdapter', () => {
    const readyAccepted = phaserAdapter.reportReady({
      transitionId: 9999, // Stale transition
      sessionId: 888,
    })
    expect(readyAccepted).toBe(false)
  })
})
