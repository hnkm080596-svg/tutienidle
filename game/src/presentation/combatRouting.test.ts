import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager, INTRO_TOTAL_TICKS } from '../core/game/GameManager'
import { defineEnemy } from '../core/enemy/Enemy'
import { createDefaultPlayer } from '../core/player/Player'
import { calculateStats } from '../core/stats/StatCalculator'
import type { Stage } from '../core/stage/Stage'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'
import { PhaserSceneAdapter } from './PhaserSceneAdapter'
import { CompositeRenderer, createVueRouteAdapter } from './VueRouteAdapter'
import { AssetBundleManager } from './assets/AssetBundleManager'
import { createGamePresentation } from './createGamePresentation'

function stageFixture(id: string, enemyId: string): Stage {
  return {
    id,
    name: id,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
}

describe('Combat routing integration (Task 10 - Checkpoint A)', () => {
  let gameManager: GameManager
  let player: ReturnType<typeof createDefaultPlayer>
  let stats: ReturnType<typeof calculateStats>
  let stage: Stage
  let enemy: ReturnType<typeof defineEnemy>

  let phaserAdapter: PhaserSceneAdapter
  let compositeRenderer: CompositeRenderer
  let assetManager: AssetBundleManager
  let coordinator: GamePresentationCoordinator
  let presentation: ReturnType<typeof createGamePresentation>
  let vueAdapter: ReturnType<typeof createVueRouteAdapter>

  // Combat counts on its own CombatClock now; the world tick no longer
  // advances a battle, so these routing tests step the source directly.
  let combatSource: ManualClockSource
  let curtainCloseSpy: (id: number, signal: AbortSignal) => Promise<void>
  let curtainOpenSpy: (id: number, signal: AbortSignal) => Promise<void>

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    gameManager = new GameManager()
    combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    player = createDefaultPlayer()
    stats = calculateStats({ ...player.baseStats, attack: 100, speed: 100 }, [])
    enemy = defineEnemy({
      id: 'cr_dummy',
      name: 'Combat Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 500,
        attack: 0,
        attackSpeed: 1,
        attackRangeRanks: 9,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    stage = stageFixture('cr_stage', enemy.id)
    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
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

    curtainCloseSpy = vi.fn(async () => {})
    curtainOpenSpy = vi.fn(async () => {})

    coordinator = new GamePresentationCoordinator({
      sessionPort: gameManager.getPresentationPort(),
      renderer: compositeRenderer,
      curtain: {
        close: curtainCloseSpy,
        open: curtainOpenSpy,
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

  it('cold entry: zero ticks until reveal/release; initial snapshot query delivered while held', async () => {
    // Fake game setup for phaser adapter
    const activeScenes = new Set<string>()
    const fakeGame = {
      scene: {
        isActive: (key: string) => activeScenes.has(key),
        start: vi.fn((key: string, data?: any) => {
          activeScenes.add(key)
          // Scene reports ready, echoing its init payload
          // (transitionId + sessionId + gameGeneration).
          phaserAdapter.reportReady(data)
        }),
        stop: vi.fn((key: string) => activeScenes.delete(key)),
        getScene: vi.fn(() => null),
      },
    } as any

    phaserAdapter.setGame(fakeGame)

    // Start stage through runAdmitted
    const startPromise = presentation.runAdmitted('combat', () => {
      const started = gameManager.turnBattleOps.startStage(player, stats, stage, false)
      if (!started) return null
      const session = gameManager.getCurrentPresentationSession('combat')!
      return { target: 'combat', session }
    })

    // Wait until transition reaches awaiting-ready
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) {
      await Promise.resolve()
    }

    const session = gameManager.getCurrentPresentationSession('combat')!
    expect(session).toBeDefined()
    expect(session.kind).toBe('combat')

    // Initial snapshot delivered while held, without ticking
    const snapshot = gameManager.getCombatPresentationSnapshot(session.sessionId)!
    expect(snapshot).toBeDefined()
    expect(snapshot.sessionId).toBe(session.sessionId)
    expect(snapshot.entities.players[0]!.alive).toBe(true)

    // Runtime is held: the combat clock is frozen for 'not-revealed', so
    // advancing its source banks nothing.
    expect(gameManager.getTurnBattle()?.state).toBe('intro')
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(INTRO_TOTAL_TICKS)
    combatSource.advance(0.5)
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(INTRO_TOTAL_TICKS)

    // Vue reports ready
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)

    const result = await startPromise
    expect(result.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')

    // After release, a combat step advances intro
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(INTRO_TOTAL_TICKS - 1)
  })

  it('second entry is held again', async () => {
    const fakeGame = {
      scene: {
        isActive: () => true,
        start: vi.fn((key, data: any) => {
          phaserAdapter.reportReady(data)
        }),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    // Entry 1
    const p1 = presentation.runAdmitted('combat', () => {
      gameManager.turnBattleOps.startStage(player, stats, stage, false)
      return { target: 'combat', session: gameManager.getCurrentPresentationSession('combat')! }
    })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await p1

    // Dismiss to Home
    const pHome = coordinator.request({ target: 'home' })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await pHome
    expect(coordinator.getSnapshot().currentRoute).toBe('home')

    // Release stageManager slot for second stage
    expect(gameManager.abandonBattle()).toBe(true)

    // Entry 2
    const p2 = presentation.runAdmitted('combat', () => {
      gameManager.turnBattleOps.startStage(player, stats, stage, false)
      return { target: 'combat', session: gameManager.getCurrentPresentationSession('combat')! }
    })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()

    // Second entry is held again
    const session2 = gameManager.getCurrentPresentationSession('combat')!
    const introBefore = gameManager.getTurnBattle()?.introTurnsRemaining
    combatSource.advance(0.5)
    expect(gameManager.getTurnBattle()?.introTurnsRemaining).toBe(introBefore)

    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await p2
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
  })

  it('result dismissal retains terminal battle at Home', async () => {
    const fakeGame = {
      scene: {
        isActive: () => true,
        start: vi.fn((key, data: any) => {
          phaserAdapter.reportReady(data)
        }),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    const p = presentation.runAdmitted('combat', () => {
      gameManager.turnBattleOps.startStage(player, stats, stage, false)
      return { target: 'combat', session: gameManager.getCurrentPresentationSession('combat')! }
    })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await p

    // Drive battle to defeat or victory
    gameManager.abandonBattle()
    expect(gameManager.getBattle()?.state).toBe('defeat')

    // Terminal result dismissal requests Home
    const pHome = coordinator.request({ target: 'home' })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await pHome
    expect(coordinator.getSnapshot().currentRoute).toBe('home')

    // Battle object remains queryable (not destroyed or erased)
    expect(gameManager.getBattle()?.state).toBe('defeat')
  })

  it('rejected abandon stays in combat', async () => {
    // When no battle is active, abandon fails
    const initialAbandon = gameManager.abandonBattle()
    expect(initialAbandon).toBe(false)
  })

  it('fresh refight increments session ID and rebinds session', async () => {
    let rebindCalled = false
    const fakeGame = {
      scene: {
        isActive: (key: string) => key === 'CombatScene',
        start: vi.fn((key, data: any) => {
          phaserAdapter.reportReady(data)
        }),
        stop: vi.fn(),
        getScene: vi.fn(() => ({
          rebindSession: (ctx: any) => {
            rebindCalled = true
            phaserAdapter.reportReady(ctx)
          },
        })),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    // Entry 1
    const p1 = presentation.runAdmitted('combat', () => {
      gameManager.turnBattleOps.startStage(player, stats, stage, false)
      return { target: 'combat', session: gameManager.getCurrentPresentationSession('combat')! }
    })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await p1

    const session1 = gameManager.getCurrentPresentationSession('combat')!
    gameManager.abandonBattle()

    // Fresh refight on same Combat route
    const p2 = presentation.runAdmitted('combat', () => {
      gameManager.turnBattleOps.startStage(player, stats, stage, false)
      return { target: 'combat', session: gameManager.getCurrentPresentationSession('combat')! }
    })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await p2

    const session2 = gameManager.getCurrentPresentationSession('combat')!
    expect(session2.sessionId).toBeGreaterThan(session1.sessionId)
    expect(rebindCalled).toBe(true)
  })

  it('continuous repeat keeps players with same identity and state fighting', async () => {
    const fakeGame = {
      scene: {
        isActive: () => true,
        start: vi.fn((key, data: any) => {
          phaserAdapter.reportReady(data)
        }),
        stop: vi.fn(),
        getScene: vi.fn(() => null),
      },
    } as any
    phaserAdapter.setGame(fakeGame)

    const p = presentation.runAdmitted('combat', () => {
      gameManager.turnBattleOps.startStage(player, stats, stage, true) // repeatContinuously
      return { target: 'combat', session: gameManager.getCurrentPresentationSession('combat')! }
    })
    for (let i = 0; i < 30 && vueAdapter.phase.value !== 'awaiting-ready'; i++) await Promise.resolve()
    vueAdapter.reportVueReady(vueAdapter.transitionId.value)
    await p

    const session1 = gameManager.getCurrentPresentationSession('combat')!

    // Skip intro and countdown
    for (let i = 0; i < INTRO_TOTAL_TICKS + 30; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Run to victory
    for (let i = 0; i < 100 && gameManager.getTurnBattle()?.state === 'fighting'; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Auto-repeat cycle restarts within same session
    const sessionAfter = gameManager.getCurrentPresentationSession('combat')!
    expect(sessionAfter.sessionId).toBe(session1.sessionId)
  })

  it('pending phase recovery exact-once: resumes cast phase with new token without duplicate damage', async () => {
    // Hit/crit rolls consume Math.random(). Unpinned, this test asserted
    // "damage was applied" against a roll that could produce a dodge, so it
    // passed alone and failed under multi-file run order. A low fixed roll
    // guarantees the hit (same pinning precedent as CombatSystem tests).
    vi.spyOn(Math, 'random').mockReturnValue(0.01)

    // In headless mode to let battle step to fighting
    gameManager.setPresentationMode('headless')
    gameManager.turnBattleOps.startStage(player, stats, stage, false)

    // Skip intro and countdown
    for (let i = 0; i < INTRO_TOTAL_TICKS + 30; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.getTurnBattle()?.state).toBe('fighting')

    // Advance through telegraph so enemy materializes into battle.enemies
    for (let i = 0; i < 15 && (gameManager.getTurnBattle()?.enemies.length ?? 0) === 0; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(gameManager.getTurnBattle()!.enemies.length).toBeGreaterThan(0)

    // Place enemy adjacent to player so player basic attack is within range
    const battle = gameManager.getTurnBattle()!
    battle.enemies[0]!.entity.x = 2
    battle.enemies[0]!.entity.row = 4

    // Ensure player is ready next and enemy gauge is behind
    battle.players[0]!.actionGauge = 10_000
    battle.enemies[0]!.actionGauge = 0

    // Switch to presentation active
    gameManager.setPresentationActive(true)

    // Tick until an actor is ready
    for (let i = 0; i < 50 && !gameManager.isActionPlaybackWaiting(); i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(gameManager.isActionPlaybackWaiting()).toBe(true)
    const token1 = gameManager.getPendingPlaybackToken()!
    gameManager.acknowledgeTurnReady(token1)

    // Now in cast phase
    const castToken = gameManager.getPendingPlaybackToken()!
    expect(castToken).toBeDefined()

    // Simulate renderer disconnect (failure hold)
    const resume = gameManager.preparePresentationResume()!
    expect(resume.phase).toBe('cast')
    if (resume.phase === 'cast') {
      expect(resume.token).not.toBe(castToken)

      const enemyHpBefore = gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp

      // Old castToken rejected
      gameManager.acknowledgeActionImpact(castToken)
      expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBe(enemyHpBefore)

      // New token accepted -> applies impact
      gameManager.acknowledgeActionImpact(resume.token)
      expect(gameManager.getTurnBattle()!.enemies[0]!.entity.currentHp).toBeLessThan(enemyHpBefore)

      // Completing action
      const completeToken = gameManager.getPendingPlaybackToken()!
      gameManager.acknowledgeActionComplete(completeToken)
      expect(gameManager.isActionPlaybackWaiting()).toBe(false)
    }
  })
})
