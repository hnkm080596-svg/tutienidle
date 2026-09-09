import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGamePresentation } from './createGamePresentation'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'
import type {
  AssetPort,
  CurtainPort,
  RendererPort,
  RouteRequest,
} from './PresentationContracts'
import {
  PresentationSession,
  type SessionPresentationPort,
} from '../core/presentation/PresentationSession'
import { GameManager } from '../core/game/GameManager'
import { defineEnemy } from '../core/enemy/Enemy'
import { createDefaultPlayer } from '../core/player/Player'
import { calculateStats } from '../core/stats/StatCalculator'
import type { Stage } from '../core/stage/Stage'

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

describe('createGamePresentation and runAdmitted', () => {
  let sessionPort: SessionPresentationPort
  let renderer: RendererPort
  let curtain: CurtainPort
  let assets: AssetPort
  let coordinator: GamePresentationCoordinator

  beforeEach(() => {
    sessionPort = new PresentationSession()
    renderer = {
      prepare: vi.fn(async () => {}),
      deactivate: vi.fn(async () => {}),
    }
    curtain = {
      close: vi.fn(async () => {}),
      open: vi.fn(async () => {}),
    }
    assets = {
      ensureFor: vi.fn(async () => {}),
    }
    coordinator = new GamePresentationCoordinator({
      sessionPort,
      renderer,
      curtain,
      assets,
      initialRoute: 'home',
    })
  })

  it('rejects second immediate click without calling callback spy twice', async () => {
    const presentation = createGamePresentation({ coordinator })
    let resolveFirst!: () => void
    const blocker = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })

    const callbackSpy = vi.fn(() => {
      return {
        target: 'combat' as const,
        session: { kind: 'combat' as const, sessionId: 1 },
      }
    })

    renderer.prepare = vi.fn(async () => {
      await blocker
    })

    ;(sessionPort as PresentationSession).begin(
      { kind: 'combat', sessionId: 1 },
      'interactive',
    )

    const call1 = presentation.runAdmitted('combat', () => {
      return callbackSpy()
    })

    // Immediate second click while first is in flight
    const call2 = await presentation.runAdmitted('combat', () => {
      return callbackSpy()
    })

    expect(call2.status).toBe('rejected')
    expect(callbackSpy).toHaveBeenCalledTimes(1)

    resolveFirst()
    const res1 = await call1
    expect(res1.status).toBe('entered')
  })

  it('releases reservation and retains current route when command returns null', async () => {
    const presentation = createGamePresentation({ coordinator })

    const result = await presentation.runAdmitted('combat', () => null)
    expect(result.status).toBe('rejected')
    expect(presentation.getSnapshot().currentRoute).toBe('home')

    // Future call can run because reservation was released
    const session = { kind: 'combat' as const, sessionId: 2 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const nextCall = await presentation.runAdmitted('combat', () => ({
      target: 'combat',
      session,
    }))
    expect(nextCall.status).toBe('entered')
    expect(presentation.getSnapshot().currentRoute).toBe('combat')
  })

  it('catches callback exceptions and releases reservation', async () => {
    const presentation = createGamePresentation({ coordinator })

    const result = await presentation.runAdmitted('combat', () => {
      throw new Error('Domain validation failed unexpectedly')
    })

    expect(result.status).toBe('rejected')
    expect(presentation.getSnapshot().currentRoute).toBe('home')

    // Reservation was released
    const session = { kind: 'combat' as const, sessionId: 3 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const nextCall = await presentation.runAdmitted('combat', () => ({
      target: 'combat',
      session,
    }))
    expect(nextCall.status).toBe('entered')
  })

  it('integrates with real GameManager: notification plus returned request cause exactly one transition', async () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])
    const enemy = defineEnemy({
      id: 'admit_dummy',
      name: 'Dummy',
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
    const stage = stageFixture('admit_stage', enemy.id)
    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.setPresentationMode('interactive')

    // Wire coordinator to real gameManager presentation port
    const port = gameManager.getPresentationPort()
    const realCoordinator = new GamePresentationCoordinator({
      sessionPort: port,
      renderer,
      curtain,
      assets,
      initialRoute: 'home',
    })

    const requestSpy = vi.spyOn(realCoordinator, 'request')

    const presentation = createGamePresentation({
      coordinator: realCoordinator,
      eventBus: gameManager.eventBus,
      getCurrentSession: () => gameManager.getCurrentPresentationSession(),
    })

    const result = await presentation.runAdmitted('combat', () => {
      const started = gameManager.startStage(player, stats, stage, false)
      if (!started) return null
      const session = gameManager.getCurrentPresentationSession('combat')
      return session ? { target: 'combat', session } : null
    })

    expect(result.status).toBe('entered')
    expect(realCoordinator.getSnapshot().currentRoute).toBe('combat')

    // Notification was deduped with reservation: request was called exactly ONCE
    expect(requestSpy).toHaveBeenCalledTimes(1)
  })

  it('observes external accepted session start through notification bridge without runAdmitted', async () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])
    const enemy = defineEnemy({
      id: 'ext_dummy',
      name: 'Dummy',
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
    const stage = stageFixture('ext_stage', enemy.id)
    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.setPresentationMode('interactive')

    const realCoordinator = new GamePresentationCoordinator({
      sessionPort: gameManager.getPresentationPort(),
      renderer,
      curtain,
      assets,
      initialRoute: 'home',
    })

    const presentation = createGamePresentation({
      coordinator: realCoordinator,
      eventBus: gameManager.eventBus,
    })

    // Start stage externally (simulating external caller or debug command)
    gameManager.startStage(player, stats, stage, false)

    // Wait for async transition initiated by notification to reach idle
    for (let i = 0; i < 50 && realCoordinator.getSnapshot().phase !== 'idle'; i++) {
      await Promise.resolve()
    }

    expect(realCoordinator.getSnapshot().currentRoute).toBe('combat')
    expect(realCoordinator.getSnapshot().phase).toBe('idle')
  })

  it('recovers already-active session via late registration query', async () => {
    const session = { kind: 'combat' as const, sessionId: 50 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    const presentation = createGamePresentation({
      coordinator,
      getCurrentSession: () => session,
    })

    for (let i = 0; i < 50 && coordinator.getSnapshot().phase !== 'idle'; i++) {
      await Promise.resolve()
    }

    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
  })

  it('does NOT run the domain command when the target route is inadmissible', async () => {
    const bootCoordinator = new GamePresentationCoordinator({
      sessionPort,
      renderer,
      curtain,
      assets,
      initialRoute: 'boot',
    })
    const presentation = createGamePresentation({ coordinator: bootCoordinator })
    const command = vi.fn(() => ({
      target: 'combat' as const,
      session: { kind: 'combat' as const, sessionId: 41 },
    }))

    const result = await presentation.runAdmitted('combat', command)

    expect(result.status).toBe('rejected')
    // The critical part: the stage was never started, so nothing is left
    // running held and unrendered behind a route that cannot show it.
    expect(command).not.toHaveBeenCalled()
    expect(bootCoordinator.getSnapshot().currentRoute).toBe('boot')
  })

  it('compensates an accepted domain command when the transition is still rejected', async () => {
    const presentation = createGamePresentation({ coordinator })
    const compensate = vi.fn()
    const session = { kind: 'combat' as const, sessionId: 42 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    // Force the unreachable disagreement between canEnter and request.
    vi.spyOn(coordinator, 'request').mockResolvedValue({
      status: 'rejected',
      transitionId: 0,
    })

    const result = await presentation.runAdmitted(
      'combat',
      () => ({ target: 'combat', session }),
      { compensate },
    )

    expect(result.status).toBe('rejected')
    expect(compensate).toHaveBeenCalledTimes(1)
  })

  it('does NOT compensate a failed transition: the session is valid and retryable', async () => {
    const presentation = createGamePresentation({ coordinator })
    const compensate = vi.fn()
    const session = { kind: 'combat' as const, sessionId: 43 }
    ;(sessionPort as PresentationSession).begin(session, 'interactive')

    renderer.prepare = vi.fn(async () => {
      throw new Error('scene create exploded')
    })

    const result = await presentation.runAdmitted(
      'combat',
      () => ({ target: 'combat', session }),
      { compensate },
    )

    expect(result.status).toBe('failed')
    expect(compensate).not.toHaveBeenCalled()
  })

  it('kind-scoped session query keeps a lingering combat session out of a tribulation request', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])
    const enemy = defineEnemy({
      id: 'kind_dummy', name: 'Dummy', level: 1, realmId: 'mortal', lane: 'ground',
      statsInput: {
        maxHp: 500, attack: 0, attackSpeed: 1, attackRangeRanks: 9,
        criticalRate: 0, criticalDamage: 1.5, armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    const stage = stageFixture('kind_stage', enemy.id)
    gameManager.registerEnemyTemplates([enemy])
    gameManager.registerStages([stage])
    gameManager.setActivePlayer(player)
    gameManager.setPresentationMode('interactive')

    gameManager.startStage(player, stats, stage, false)

    const combatSession = gameManager.getCurrentPresentationSession('combat')
    expect(combatSession?.kind).toBe('combat')

    // Unscoped read prefers the live combat session - which is exactly why an
    // entry point must never use it to identify the session it just started.
    expect(gameManager.getCurrentPresentationSession()?.kind).toBe('combat')
    expect(gameManager.getCurrentPresentationSession('tribulation')).toBeNull()
  })

  it('disposes and unregisters event bus listeners', () => {
    const offSpy = vi.fn()
    const fakeBus = {
      on: vi.fn(),
      off: offSpy,
    }

    const presentation = createGamePresentation({
      coordinator,
      eventBus: fakeBus,
    })

    presentation.dispose()
    expect(offSpy).toHaveBeenCalledWith(
      'presentation_session_started',
      expect.any(Function),
    )
  })
})
