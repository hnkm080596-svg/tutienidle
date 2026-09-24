import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../core/game/GameManager'
import { createDefaultPlayer } from '../core/player/Player'
import { calculateStats } from '../core/stats/StatCalculator'
import { asBaseStats } from '../core/stats/StatBlock'
import { useWorldAnnouncementStore } from '../stores/worldAnnouncement'
import {
  SPIRIT_STONE_MATERIAL,
  getSpiritStoneMaterialIdForRealmTier,
} from '../core/material/SpiritStoneMaterial'
import { getRealmTier } from '../core/realm/RealmTierMap'
import {
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK,
} from '../data/tribulation/TribulationChapters'
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

/**
 * Drive a started tribulation to its real terminal through the director's
 * own tick/answer contract (headless mode keeps update() unblocked while
 * the entry transition is in-flight). M6: the outcome check keys off the
 * domain-owned committed-outcome record - writing active.state directly
 * would bypass commitOutcome and leave nothing to settle.
 */
function driveTribulationToTerminal(gameManager: GameManager, answerCorrectly = true) {
  let guard = 0
  while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 500) {
    const q = gameManager.tribulationDirector.getState()!.currentQuestion
    if (answerCorrectly && q) gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    gameManager.tickOps.update(1)
  }
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
      // Pinia flattens $state fields onto the store instance; the M7
      // ambient resolver reads baseStats/modifiers off the store directly.
      ...player,
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
      gameGeneration: phaserAdapter.getGameGeneration(),
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
    vi.spyOn(gameManager, 'getTurnBattle').mockReturnValue({
      state: 'fighting',
      players: [],
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
    gameManager.startTribulation(player, 'qi_refining')

    expect(gameManager.tribulationDirector.getState()).not.toBeNull()

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
      gameGeneration: phaserAdapter.getGameGeneration(),
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')
    })

    // Reach a real victory through the director (the M6 committed-outcome
    // record only exists because commitOutcome ran).
    driveTribulationToTerminal(gameManager)
    expect(gameManager.tribulationDirector.getCommittedOutcome()?.outcome).toBe('victory')

    const playerStoreMock = {
      ...player,
      $state: player,
      realmId: 'mortal',
      realmLevel: 10,
      cultivation: 1000,
      selectedTalentIds: [],
    } as any

    // First check settles the domain outcome SYNCHRONOUSLY (M6) and issues
    // the home transition; the run drain itself runs inside the
    // closed-curtain window, so the clear lands after the mocked curtain
    // resolves - a few microtasks, not synchronously.
    const firstCheck = checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)
    expect(firstCheck).toBe(true)

    // M-F-TALENT: the mandatory decision record holds the drain while
    // pending - settle already committed; resolving the entitlement lets
    // the next tick consume the receipt and drain normally.
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(playerStoreMock, {
      kind: 'new',
      talentId: playerStoreMock.pendingTalentEntitlement.offeredTalentIds[0],
    })).toBe(true)
    expect(checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)).toBe(true)

    await vi.waitFor(() => {
      expect(gameManager.tribulationDirector.getState()).toBeNull()
    })

    // Third check is safe no-op
    const secondCheck = checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)
    expect(secondCheck).toBe(false)
  })

  it('production outcome check (presentation wired, as App.vue calls it) routes home', async () => {
    const fakeGame = {
      scene: {
        isActive: () => true,
        start: vi.fn(),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    // Same headless entry dance as the duplicate-outcome test above.
    gameManager.setPresentationMode('headless')
    gameManager.startTribulation(player, 'qi_refining')

    await vi.waitFor(() => {
      expect(vueAdapter.phase.value).toBe('awaiting-ready')
    })
    const entrySession = gameManager.getCurrentPresentationSession()!
    phaserAdapter.reportReady({
      transitionId: vueAdapter.transitionId.value,
      sessionId: entrySession.sessionId,
      gameGeneration: phaserAdapter.getGameGeneration(),
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')
    })

    // Reach a real victory through the director (the M6 committed-outcome
    // record only exists because commitOutcome ran).
    driveTribulationToTerminal(gameManager)
    expect(gameManager.tribulationDirector.getCommittedOutcome()?.outcome).toBe('victory')

    const playerStoreMock = {
      ...player,
      $state: player,
      realmId: 'mortal',
      realmLevel: 10,
      cultivation: 1000,
      selectedTalentIds: [],
    } as any

    // This is the exact call signature App.vue's tick() uses in
    // production after the F1 fix: the presentation argument routes the
    // outcome through the coordinator, so request({ target: 'home' }) is
    // issued and the route can leave 'tribulation'. Before the fix
    // App.vue omitted the third argument: the outcome was applied
    // (director cleared) but the coordinator's route could never leave
    // 'tribulation' - home chrome stayed hidden, the overlay rendered
    // nothing (active === null), and the TribulationScene was never
    // deactivated. Soft-lock until reload. The static guard in
    // tests/architecture/tribulationOutcomeWiring.test.ts pins the
    // 3-argument call site so the wiring cannot silently regress.
    const handled = checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)
    expect(handled).toBe(true)

    // M-F-TALENT: the entitlement holds the drain until the decision
    // resolves; the modal decision unlocks the same-tick consume.
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(playerStoreMock, {
      kind: 'new',
      talentId: playerStoreMock.pendingTalentEntitlement.offeredTalentIds[0],
    })).toBe(true)
    expect(checkTribulationOutcomeAction(playerStoreMock, gameManager, presentation)).toBe(true)

    // The outcome work runs inside the closed-curtain window (the
    // director clears on a microtask), then the home transition does the
    // same readiness dance as the tribulation entry above: the
    // coordinator holds at awaiting-ready until Phaser (MainScene) and
    // Vue report.
    await vi.waitFor(() => {
      expect(gameManager.tribulationDirector.getState()).toBeNull()
      expect(vueAdapter.phase.value).toBe('awaiting-ready')
    })

    phaserAdapter.reportReady({
      transitionId: vueAdapter.transitionId.value,
      gameGeneration: phaserAdapter.getGameGeneration(),
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)

    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(coordinator.getSnapshot().currentRoute).toBe('home')
    })
  })

  it('stale READY is rejected by phaserAdapter', () => {
    const readyAccepted = phaserAdapter.reportReady({
      transitionId: 9999, // Stale transition
      sessionId: 888,
      gameGeneration: phaserAdapter.getGameGeneration(),
    })
    expect(readyAccepted).toBe(false)
  })
})

/**
 * M6 / ARCH-006 — the once-only settlement is a domain commit that lands
 * BEFORE and INDEPENDENT of the curtain. These tests run the REAL
 * coordinator (deferred curtain) so the timing windows the audit flagged
 * are exercised exactly: a rejected request while the entry transition is
 * still closing, a duplicate tick while the home request is in-flight,
 * and a curtain close failure mid-settlement. In every case consequences
 * apply exactly once and the committed record stays pending until the
 * successful transition drains it.
 */
describe('Tribulation outcome settlement vs curtain lifecycle (M6 / ARCH-006)', () => {
  let gameManager: GameManager
  let player: ReturnType<typeof setupPlayerReadyForQiRefining>
  let phaserAdapter: PhaserSceneAdapter
  let compositeRenderer: CompositeRenderer
  let coordinator: GamePresentationCoordinator
  let presentation: ReturnType<typeof createGamePresentation>
  let vueAdapter: ReturnType<typeof createVueRouteAdapter>
  let curtainCloseMock: ReturnType<typeof vi.fn>
  let pendingCloses: Array<() => void>
  let failNextClose: boolean

  function releaseNextClose() {
    const release = pendingCloses.shift()
    expect(release).toBeDefined()
    release!()
  }

  /** Drive the held entry transition (home -> tribulation) to idle. */
  async function completeTribulationEntry() {
    releaseNextClose()
    await vi.waitFor(() => {
      expect(vueAdapter.phase.value).toBe('awaiting-ready')
    })
    const entrySession = gameManager.getCurrentPresentationSession()!
    phaserAdapter.reportReady({
      transitionId: vueAdapter.transitionId.value,
      sessionId: entrySession.sessionId,
      gameGeneration: phaserAdapter.getGameGeneration(),
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')
    })
  }

  /** Drive the held exit transition (tribulation -> home) to idle. */
  async function completeHomeExit() {
    releaseNextClose()
    await vi.waitFor(() => {
      expect(vueAdapter.phase.value).toBe('awaiting-ready')
    })
    phaserAdapter.reportReady({
      transitionId: vueAdapter.transitionId.value,
      gameGeneration: phaserAdapter.getGameGeneration(),
    })
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(coordinator.getSnapshot().currentRoute).toBe('home')
    })
  }

  function playerStoreMock() {
    return {
      ...player,
      $state: player,
      finalStats: calculateStats(player.baseStats, []),
      setEquipmentModifiers: vi.fn(),
    } as any
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    gameManager = new GameManager()
    player = setupPlayerReadyForQiRefining()
    gameManager.setActivePlayer(player)
    gameManager.setPresentationMode('headless')

    pendingCloses = []
    failNextClose = false
    curtainCloseMock = vi.fn(() => {
      if (failNextClose) {
        failNextClose = false
        return Promise.reject(new Error('curtain motor burned'))
      }
      return new Promise<void>((resolve) => {
        pendingCloses.push(resolve)
      })
    })

    phaserAdapter = new PhaserSceneAdapter()
    phaserAdapter.setGame({
      scene: {
        isActive: () => true,
        start: vi.fn(),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any)
    compositeRenderer = new CompositeRenderer(phaserAdapter)
    const assetManager = new AssetBundleManager({
      loaderScene: {
        isTextureLoaded: vi.fn(() => true),
        loadDescriptors: vi.fn(async () => {}),
      } as any,
      domImageLoader: vi.fn(async () => {}),
    })

    coordinator = new GamePresentationCoordinator({
      sessionPort: gameManager.getPresentationPort(),
      renderer: compositeRenderer,
      curtain: {
        close: curtainCloseMock as (id: number, signal: AbortSignal) => Promise<void>,
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

  it('rejected request while the entry transition is in-flight leaves the outcome pending for next-tick retry', async () => {
    player.selectedTalentIds = ['loi_kiep']
    const announcements = vi.spyOn(useWorldAnnouncementStore(), 'show')

    // Entry transition is requested by the session_started event and sits
    // at 'closing' on the deferred curtain - the same window a real
    // resolve lands in when the tick outruns the animation.
    gameManager.startTribulation(player, 'qi_refining')
    expect(coordinator.getSnapshot().phase).toBe('closing')

    driveTribulationToTerminal(gameManager)
    const committed = gameManager.tribulationDirector.getCommittedOutcome()
    expect(committed?.outcome).toBe('victory')

    const store = playerStoreMock()

    // Tick 1: settlement commits SYNCHRONOUSLY (before/independent of any
    // curtain) but the home request collides with the in-flight entry and
    // is rejected - the committed record must stay pending, NOT drain.
    // M-F-TALENT: the mandatory talent entitlement written by the same
    // commit additionally locks the drain until the modal resolves it.
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)
    expect(store.modifiers.find((m: { id: string }) => m.id === 'talent_loi_kiep_strength')?.percent).toBe(0.1)
    expect(gameManager.tribulationDirector.getCommittedOutcome()!.receipt).not.toBeNull()
    expect(gameManager.tribulationDirector.getState()).not.toBeNull()
    expect(coordinator.getSnapshot().phase).toBe('closing')
    expect(announcements).not.toHaveBeenCalled()

    // The player resolves the mandatory decision - the record clears and
    // the drain path re-opens for the next tick.
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(store, {
      kind: 'new',
      talentId: store.pendingTalentEntitlement.offeredTalentIds[0],
    })).toBe(true)

    await completeTribulationEntry()

    // Tick 2 (the real app's next frame): the same receipt is re-presented
    // - nothing re-applies - and this time the request lands.
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)
    expect(store.modifiers.find((m: { id: string }) => m.id === 'talent_loi_kiep_strength')?.percent).toBe(0.1)
    expect(coordinator.getSnapshot().phase).toBe('closing')

    await completeHomeExit()

    expect(gameManager.tribulationDirector.getState()).toBeNull()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
    expect(store.modifiers.find((m: { id: string }) => m.id === 'talent_loi_kiep_strength')?.percent).toBe(0.1)
    expect(announcements).toHaveBeenCalledTimes(1)
  })

  it('duplicate tick while the home request is in-flight shares the transition - consequences and drain run once', async () => {
    player.selectedTalentIds = ['loi_kiep']
    const announcements = vi.spyOn(useWorldAnnouncementStore(), 'show')

    gameManager.startTribulation(player, 'qi_refining')
    await completeTribulationEntry()

    driveTribulationToTerminal(gameManager)
    const store = playerStoreMock()

    // Tick 1: settle commits; the home request goes in-flight and parks
    // at 'closing' (curtain still traveling).
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)
    const closeCallsAfterFirst = curtainCloseMock.mock.calls.length
    expect(store.modifiers.find((m: { id: string }) => m.id === 'talent_loi_kiep_strength')?.percent).toBe(0.1)
    const receipt = gameManager.tribulationDirector.getCommittedOutcome()!.receipt
    expect(receipt).not.toBeNull()

    // Tick 2 (same in-flight window): settlement dedupes onto the bound
    // receipt and the coordinator joins the SAME request - no second
    // curtain close, no second behindCurtain run.
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)
    expect(curtainCloseMock.mock.calls.length).toBe(closeCallsAfterFirst)
    expect(store.modifiers.find((m: { id: string }) => m.id === 'talent_loi_kiep_strength')?.percent).toBe(0.1)
    expect(gameManager.tribulationDirector.getCommittedOutcome()!.receipt).toBe(receipt)

    // M-F-TALENT: resolve the pending talent decision so the exit
    // transition can drain the run inside its curtain window.
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(store, {
      kind: 'new',
      talentId: store.pendingTalentEntitlement.offeredTalentIds[0],
    })).toBe(true)
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)

    await completeHomeExit()

    expect(gameManager.tribulationDirector.getState()).toBeNull()
    expect(store.modifiers.find((m: { id: string }) => m.id === 'talent_loi_kiep_strength')?.percent).toBe(0.1)
    expect(announcements).toHaveBeenCalledTimes(1)
  })

  it('curtain close failure still committed consequences; the pending record drains on the next-tick retry', async () => {
    const announcements = vi.spyOn(useWorldAnnouncementStore(), 'show')
    const debuffSpy = vi.spyOn(gameManager.effectOps, 'applyPersistentBuff')

    // Too weak to survive a foundation_establishment kiếp with the
    // questions left unanswered (mind fail stacks amplify the strikes) ->
    // real defeat through the director.
    player.realmId = 'qi_refining'
    player.completedStageIds = ['qi_refining_abyssal_pool']
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })
    player.cultivation = 1_000
    const stoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier('foundation_establishment'))
    gameManager.materialBag.add({ ...SPIRIT_STONE_MATERIAL, id: stoneId }, 350)

    gameManager.startTribulation(player, 'foundation_establishment')
    await completeTribulationEntry()

    driveTribulationToTerminal(gameManager, false)
    const committed = gameManager.tribulationDirector.getCommittedOutcome()
    expect(committed?.outcome).toBe('defeat')

    const store = playerStoreMock()

    // The curtain close itself blows up - the exact ARCH-006 failure the
    // audit flagged. Settlement must already be committed (domain side),
    // while the run drain (clear) must NOT have happened.
    failNextClose = true
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)

    await vi.waitFor(() => {
      expect(coordinator.getSnapshot().phase).toBe('failed')
    })

    const lossPercent = Math.max(
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM['foundation_establishment'] ??
        TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
    )
    const expectedCultivation = Math.floor(1_000 * (1 - lossPercent))
    const expectedStones =
      350 -
      Math.min(
        350,
        TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM['foundation_establishment'] ??
          TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK,
      )

    expect(store.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(expectedStones)
    expect(debuffSpy).toHaveBeenCalledTimes(1)
    // Consequences committed, but the run is still pending: the committed
    // record (with its bound receipt) survived the failed transition.
    expect(gameManager.tribulationDirector.getState()).not.toBeNull()
    expect(gameManager.tribulationDirector.getCommittedOutcome()!.receipt).not.toBeNull()
    expect(announcements).not.toHaveBeenCalled()

    // Next tick re-issues the request over the SAME bound receipt - the
    // second settle is a no-op (no re-cut cultivation, no second debuff,
    // no second stone removal) and the successful transition drains once.
    expect(checkTribulationOutcomeAction(store, gameManager, presentation)).toBe(true)
    expect(store.cultivation).toBe(expectedCultivation)
    expect(debuffSpy).toHaveBeenCalledTimes(1)

    await completeHomeExit()

    expect(gameManager.tribulationDirector.getState()).toBeNull()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
    expect(store.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(expectedStones)
    expect(debuffSpy).toHaveBeenCalledTimes(1)
    expect(announcements).toHaveBeenCalledTimes(1)
  })

  it('a throwing resolve is contained: record marks failed, exception never reaches the tick, run drains home once', async () => {
    const announcements = vi.spyOn(useWorldAnnouncementStore(), 'show')
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Fault injection: the LAST consequence write of resolveDefeat
    // throws - cultivation and stones already landed.
    const debuffSpy = vi
      .spyOn(gameManager.effectOps, 'applyPersistentBuff')
      .mockImplementation(() => {
        throw new Error('injected debuff failure')
      })

    player.realmId = 'qi_refining'
    player.completedStageIds = ['qi_refining_abyssal_pool']
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })
    player.cultivation = 1_000
    const stoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier('foundation_establishment'))
    gameManager.materialBag.add({ ...SPIRIT_STONE_MATERIAL, id: stoneId }, 350)

    gameManager.startTribulation(player, 'foundation_establishment')
    await completeTribulationEntry()

    driveTribulationToTerminal(gameManager, false)
    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(committed.outcome).toBe('defeat')

    const store = playerStoreMock()

    // Tick 1: the settle throws mid-apply INTERNALLY - the record is
    // marked terminal-failed, the exception never escapes into the tick
    // loop, and a drain-home request is issued with the failure
    // announcement behind the curtain.
    let handled = false
    expect(() => {
      handled = checkTribulationOutcomeAction(store, gameManager, presentation)
    }).not.toThrow()
    expect(handled).toBe(true)

    expect(committed.settlementError).toBeInstanceOf(Error)
    expect(committed.receipt).toBeNull()
    const expectedCultivation = Math.floor(
      1_000 * (1 - TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM['foundation_establishment']!),
    )
    expect(store.cultivation).toBe(expectedCultivation)
    expect(debuffSpy).toHaveBeenCalledTimes(1)

    // Tick 2 while the drain is in-flight: converges - no re-apply, the
    // request joins the in-flight transition.
    expect(() => {
      checkTribulationOutcomeAction(store, gameManager, presentation)
    }).not.toThrow()
    expect(store.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(150)
    expect(debuffSpy).toHaveBeenCalledTimes(1)

    await completeHomeExit()

    expect(gameManager.tribulationDirector.getState()).toBeNull()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
    expect(store.cultivation).toBe(expectedCultivation)
    expect(debuffSpy).toHaveBeenCalledTimes(1)
    // The failure surfaced once as an announcement - never as an
    // uncaught per-second exception.
    expect(announcements).toHaveBeenCalledTimes(1)
  })
})
