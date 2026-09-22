import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from '../core/game/GameManager'
import { createDefaultPlayer } from '../core/player/Player'
import { calculateStats } from '../core/stats/StatCalculator'
import { asBaseStats } from '../core/stats/StatBlock'
import type { Stage } from '../core/stage/Stage'
import { ENEMIES } from '../data/enemy/Enemies'
import { STAGES } from '../data/stage/Stages'
import { materials } from '../data/materials/materials'
import { SKILLS } from '../data/skill/Skills'
import { buffs } from '../data/buff/buffs'
import { equipment } from '../data/equipment/equipment'
import { affixes } from '../data/equipment/affixes'
import type { SessionRef } from '../core/presentation/PresentationSession'
import type { RouteRequest } from './PresentationContracts'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'
import { PhaserSceneAdapter, type ReadyContext } from './PhaserSceneAdapter'
import { CompositeRenderer, createVueRouteAdapter } from './VueRouteAdapter'
import { AssetBundleManager } from './assets/AssetBundleManager'
import { createGamePresentation } from './createGamePresentation'
import { triggerBreakthroughAction } from '../composables/useTribulation'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

/**
 * ARCH-004 / AUD-L03 regression suite - admitted session handoff.
 *
 * Invariant: the RouteRequest/session a domain command accepted is the
 * identity carried through admission -> resource preparation ->
 * renderer.prepare -> scene READY -> transition attach. It is NEVER
 * re-derived from ambient session state, where a retained session of a
 * DIFFERENT kind (a terminal combat battle still sitting at Home) shadows
 * the session the command just produced.
 *
 * Both executed audit diagnostics are ported here with real construction
 * (real GameManager + catalogs + coordinator + adapters):
 *
 *   COLLISION (audit-lifecycle-review L03): retained mortal_dong_1 victory
 *   session + runAdmitted('tribulation') must enter tribulation on the NEWLY
 *   ACCEPTED session - under the defect the coordinator re-queried the
 *   unscoped ambient session, got the retained combat session, and failed
 *   the transition with "Domain command produced no session".
 *
 *   ADMITTED_RENDERER_SESSION (audit-lifecycle-review L03): the request
 *   renderer.prepare receives must carry the accepted session - under the
 *   defect it received the sessionless original, so PhaserSceneAdapter sent
 *   `sessionId: undefined` to the scene and the audit observed
 *   `sceneSessionId: undefined` in the live browser.
 *
 * READY strictness: for session routes READY must echo the exact
 * {transitionId, sessionId, gameGeneration} the waiter registered - no
 * "undefined matches anything" acceptance - and a waiter resolves exactly
 * once (stale and duplicate reports rejected).
 */
describe('Admitted session handoff (ARCH-004 / L03)', () => {
  let gameManager: GameManager
  let player: ReturnType<typeof createDefaultPlayer>
  let stats: ReturnType<typeof calculateStats>
  let combatSource: ManualClockSource
  let mortalStage: Stage

  let phaserAdapter: PhaserSceneAdapter
  let compositeRenderer: CompositeRenderer
  let assetManager: AssetBundleManager
  let coordinator: GamePresentationCoordinator
  let presentation: ReturnType<typeof createGamePresentation>
  let vueAdapter: ReturnType<typeof createVueRouteAdapter>

  // The fake Phaser host records every scene.start init payload, then echoes
  // it straight back through reportReady - the same {transitionId, sessionId,
  // gameGeneration} triple the real scenes report from their init data.
  let startedScenes: Array<{
    key: string
    data: { transitionId: number; sessionId?: number; gameGeneration: number }
  }>
  let activeScenes: Set<string>

  async function waitAwaitingReady(): Promise<void> {
    await vi.waitFor(() => {
      expect(vueAdapter.phase.value).toBe('awaiting-ready')
    })
  }

  function finishVueReady(): void {
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
  }

  async function enterCombat(): Promise<SessionRef> {
    const startPromise = presentation.runAdmitted('combat', () => {
      const started = gameManager.turnBattleOps.startStage(player, mortalStage, false)
      if (!started) return null
      const session = gameManager.getCurrentPresentationSession('combat')
      return session ? { target: 'combat', session } : null
    })
    await waitAwaitingReady()
    finishVueReady()
    const result = await startPromise
    expect(result.status).toBe('entered')
    return gameManager.getCurrentPresentationSession('combat')!
  }

  async function goHome(): Promise<void> {
    const homePromise = coordinator.request({ target: 'home' })
    await waitAwaitingReady()
    finishVueReady()
    const result = await homePromise
    expect(result.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('home')
  }

  /** Drive the retained victory session fixture: enter mortal_dong_1, run to victory, return Home. */
  async function retainedVictoryCombatSession(): Promise<SessionRef> {
    const combatSession = await enterCombat()

    // Victory does not end the presentation session (only abandon/refight
    // do) - the terminal session must still be retained once we route home.
    for (
      let n = 0;
      n < 10_000 && !['victory', 'defeat'].includes(gameManager.getTurnBattle()?.state ?? '');
      n++
    ) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(gameManager.getTurnBattle()?.state).toBe('victory')

    await goHome()
    expect(gameManager.getCurrentPresentationSession('combat')).toEqual(combatSession)
    return combatSession
  }

  function playerStoreMock() {
    return {
      // Pinia flattens $state fields onto the store instance; the M7
      // ambient resolver reads baseStats/modifiers off the store directly.
      ...player,
      $state: player,
      finalStats: stats,
      realmId: player.realmId,
      setEquipmentModifiers: vi.fn(),
    } as any
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    gameManager = new GameManager()
    combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
    gameManager.catalogOps.registerStages(STAGES)
    gameManager.catalogOps.registerMaterials(materials)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerBuffs(buffs)
    gameManager.catalogOps.registerEquipment(equipment)
    gameManager.catalogOps.registerAffixes(affixes)

    const basePlayer = createDefaultPlayer()
    // ARCH-002 (M7): startStage resolves stats internally — patch the RAW
    // baseStats so the resolved snapshot keeps the guaranteed-kill might.
    player = {
      ...basePlayer,
      baseStats: asBaseStats({ ...basePlayer.baseStats, might: 1_000_000, speed: 100 }),
    }
    player.realmLevel = 12 // mortal Quan Khi breakthrough gate
    player.cultivation = 0
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram', player)
    gameManager.progressionOps.setMortalBasicSkill(player, 'tram')
    stats = calculateStats({ ...player.baseStats }, [])
    gameManager.setPresentationMode('interactive')

    mortalStage = STAGES.find((s) => s.id === 'mortal_dong_1')!

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
      curtain: { close: vi.fn(async () => {}), open: vi.fn(async () => {}) },
      assets: assetManager,
      initialRoute: 'home',
    })

    presentation = createGamePresentation({
      coordinator,
      eventBus: gameManager.eventBus,
      getCurrentSession: () => gameManager.getCurrentPresentationSession(),
    })

    vueAdapter = createVueRouteAdapter(coordinator, compositeRenderer)

    startedScenes = []
    activeScenes = new Set()
    const fakeGame = {
      scene: {
        isActive: (key: string) => activeScenes.has(key),
        start: vi.fn(
          (
            key: string,
            data?: { transitionId: number; sessionId?: number; gameGeneration: number },
          ) => {
            activeScenes.add(key)
            if (data) {
              startedScenes.push({ key, data })
              phaserAdapter.reportReady(data)
            }
          },
        ),
        stop: vi.fn((key: string) => activeScenes.delete(key)),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)
  })

  it('enters tribulation on the accepted session while a terminal combat session stays retained (L03 COLLISION)', async () => {
    const combatSession = await retainedVictoryCombatSession()

    const tribulationSession = gameManager.getCurrentPresentationSession('tribulation')
    expect(tribulationSession).toBeNull() // none yet - the command creates it

    const prepareSpy = vi.spyOn(phaserAdapter, 'prepare')

    const triggerPromise = triggerBreakthroughAction(
      playerStoreMock(),
      gameManager,
      presentation,
    ) as Promise<boolean>

    await waitAwaitingReady()

    // The session the domain command accepted - tribulation kind, a fresh id.
    const accepted = gameManager.getCurrentPresentationSession('tribulation')!
    expect(accepted.kind).toBe('tribulation')
    expect(accepted.sessionId).not.toBe(combatSession.sessionId)

    // While held at awaiting-ready the transition's identity is exactly that
    // session - not the retained combat session.
    expect(coordinator.getSnapshot().targetSession).toEqual(accepted)

    finishVueReady()
    const started = await triggerPromise

    expect(started).toBe(true)
    expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')
    expect(coordinator.getSnapshot().currentSession).toEqual(accepted)

    // The renderer saw the session-bound request, not the sessionless original.
    expect(prepareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'tribulation',
        session: accepted,
      }),
      expect.any(Number),
      expect.any(AbortSignal),
    )

    // ...and the scene start payload carried the session id down to init data.
    const tribulationStart = startedScenes.find((s) => s.key === 'TribulationScene')
    expect(tribulationStart?.data.sessionId).toBe(accepted.sessionId)

    // The unrelated retained combat session is untouched - never cleared,
    // never adopted.
    expect(gameManager.getCurrentPresentationSession('combat')).toEqual(combatSession)
  })

  it('passes the accepted session to renderer.prepare on a normal tribulation handoff (L03 ADMITTED_RENDERER_SESSION)', async () => {
    let prepared: RouteRequest | null = null
    const capturingRenderer = {
      prepare: vi.fn(async (request: RouteRequest) => {
        prepared = request
      }),
      deactivate: vi.fn(async () => {}),
    }
    const plainCoordinator = new GamePresentationCoordinator({
      sessionPort: gameManager.getPresentationPort(),
      renderer: capturingRenderer,
      curtain: { close: vi.fn(async () => {}), open: vi.fn(async () => {}) },
      assets: { ensureFor: vi.fn(async () => {}) },
      initialRoute: 'home',
    })
    const plainPresentation = createGamePresentation({
      coordinator: plainCoordinator,
      eventBus: gameManager.eventBus,
      getCurrentSession: () => gameManager.getCurrentPresentationSession(),
    })

    const result = await plainPresentation.runAdmitted('tribulation', () => {
      const started = gameManager.tribulationDirector.start(player, stats, false, 'qi_refining')
      if (!started) return null
      const session = gameManager.getCurrentPresentationSession('tribulation')
      return session ? { target: 'tribulation', session } : null
    })

    expect(result.status).toBe('entered')
    expect(prepared).not.toBeNull()
    // The audit observed `rendererHasSession: false` - the original
    // sessionless request reached prepare while the coordinator committed
    // the adopted session. After the repair the same identity is in both.
    const preparedRequest = prepared!
    expect('session' in preparedRequest && preparedRequest.session).toEqual(
      plainCoordinator.getSnapshot().currentSession,
    )
    expect(plainCoordinator.getSnapshot().currentSession?.kind).toBe('tribulation')
  })

  it('READY requires the exact sessionId and gameGeneration - no undefined-matches-anything', async () => {
    const signal = new AbortController().signal
    const generation = phaserAdapter.getGameGeneration()
    const session = { kind: 'combat' as const, sessionId: 42 }

    // Manual waiter: prepare does not auto-resolve because the fake
    // getScene returns no rebindSession and scene.start is spied to stay silent.
    const startSpy = vi.fn((key: string) => {
      activeScenes.add(key)
    })
    const silentGame = {
      scene: {
        isActive: (key: string) => activeScenes.has(key),
        start: startSpy,
        stop: vi.fn((key: string) => activeScenes.delete(key)),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(silentGame)
    const genAfterSet = phaserAdapter.getGameGeneration()

    const prepPromise = phaserAdapter.prepare({ target: 'combat', session }, 7, signal)

    // Wrong transition -> stale.
    expect(
      phaserAdapter.reportReady({ transitionId: 999, sessionId: 42, gameGeneration: genAfterSet }),
    ).toBe(false)
    // Right transition, but session missing -> not the accepted identity.
    expect(
      phaserAdapter.reportReady({ transitionId: 7, gameGeneration: genAfterSet }),
    ).toBe(false)
    // Right transition, wrong session -> a different session's READY.
    expect(
      phaserAdapter.reportReady({ transitionId: 7, sessionId: 6, gameGeneration: genAfterSet }),
    ).toBe(false)
    // Right transition + session, missing generation -> stale game host.
    expect(phaserAdapter.reportReady({ transitionId: 7, sessionId: 42 } as ReadyContext)).toBe(false)
    // Right transition + session, wrong generation.
    expect(
      phaserAdapter.reportReady({ transitionId: 7, sessionId: 42, gameGeneration: genAfterSet + 1 }),
    ).toBe(false)

    // Exact identity resolves.
    expect(
      phaserAdapter.reportReady({ transitionId: 7, sessionId: 42, gameGeneration: genAfterSet }),
    ).toBe(true)
    await expect(prepPromise).resolves.toBeUndefined()

    // The waiter is consumed: a duplicate READY is rejected.
    expect(
      phaserAdapter.reportReady({ transitionId: 7, sessionId: 42, gameGeneration: genAfterSet }),
    ).toBe(false)

    expect(generation).not.toBe(genAfterSet) // setGame above bumped it; sanity only.
  })

  it('retry() resumes the recorded session even while another kind stays retained', async () => {
    await retainedVictoryCombatSession()

    // First tribulation attempt fails AFTER the domain command was accepted
    // (renderer prepare throws once) - the failedRequest must already carry
    // the adopted session.
    const prepareSpy = vi
      .spyOn(phaserAdapter, 'prepare')
      .mockRejectedValueOnce(new Error('renderer exploded'))

    const failedStart = await triggerBreakthroughAction(
      playerStoreMock(),
      gameManager,
      presentation,
    )
    expect(failedStart).toBe(false)
    expect(coordinator.getSnapshot().phase).toBe('failed')

    const tribSession = gameManager.getCurrentPresentationSession('tribulation')!
    const failedRequest = coordinator.getSnapshot().error!.failedRequest
    expect('session' in failedRequest && failedRequest.session).toEqual(tribSession)

    prepareSpy.mockRestore()

    // Ambient state still prefers the retained combat session - retry must
    // validate the recorded session by identity, not an unscoped query.
    expect(gameManager.getCurrentPresentationSession()).toEqual(
      gameManager.getCurrentPresentationSession('combat'),
    )

    const retryPromise = coordinator.retry()
    await waitAwaitingReady()
    finishVueReady()
    const retried = await retryPromise

    expect(retried.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('tribulation')
    expect(coordinator.getSnapshot().currentSession).toEqual(tribSession)
    expect(gameManager.getCurrentPresentationSession('tribulation')).toEqual(tribSession)
  })

  it('same-route combat rebind carries the NEW session identity', async () => {
    const rebindCalls: Array<{
      transitionId: number
      sessionId?: number
      gameGeneration: number
    }> = []
    const rebindGame = {
      scene: {
        isActive: (key: string) => activeScenes.has(key),
        start: vi.fn(
          (
            key: string,
            data?: { transitionId: number; sessionId?: number; gameGeneration: number },
          ) => {
            activeScenes.add(key)
            if (data) {
              startedScenes.push({ key, data })
              phaserAdapter.reportReady(data)
            }
          },
        ),
        stop: vi.fn((key: string) => activeScenes.delete(key)),
        getScene: vi.fn((key: string) =>
          key === 'CombatScene'
            ? {
                rebindSession: (ctx: {
                  transitionId: number
                  sessionId?: number
                  gameGeneration: number
                }) => {
                  rebindCalls.push(ctx)
                  phaserAdapter.reportReady(ctx)
                },
              }
            : null,
        ),
      },
    } as any
    phaserAdapter.setGame(rebindGame)

    const session1 = await enterCombat()
    gameManager.abandonBattle()

    const session2 = await enterCombat()
    expect(session2.sessionId).toBeGreaterThan(session1.sessionId)

    // The rebind (not a scene.start) carried the new session, and READY
    // resolved against the same generation the adapter registered.
    expect(rebindCalls).toHaveLength(1)
    expect(rebindCalls[0]!.sessionId).toBe(session2.sessionId)
    expect(rebindCalls[0]!.gameGeneration).toBe(phaserAdapter.getGameGeneration())
    expect(coordinator.getSnapshot().currentSession).toEqual(session2)
  })
})
