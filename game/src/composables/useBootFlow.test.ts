import { describe, expect, it, vi } from 'vitest'
import { useBootFlow } from './useBootFlow'
import { GamePresentationCoordinator } from '@/presentation/GamePresentationCoordinator'
import { CompositeRenderer, createVueRouteAdapter } from '@/presentation/VueRouteAdapter'
import { PhaserSceneAdapter } from '@/presentation/PhaserSceneAdapter'
import { PresentationSession } from '@/core/presentation/PresentationSession'
import type { Route } from '@/presentation/PresentationContracts'

/**
 * Boot stages are DERIVED from the coordinator now, so a stage only changes
 * once the transition has actually mounted its target behind the curtain.
 * The screen no longer flips synchronously on the command - that instant flip
 * was the second route authority this migration removed.
 */
function createFlow() {
  const phaserAdapter = new PhaserSceneAdapter()
  const compositeRenderer = new CompositeRenderer(phaserAdapter)
  const coordinator = new GamePresentationCoordinator({
    sessionPort: new PresentationSession(),
    renderer: compositeRenderer,
    curtain: { close: async () => {}, open: async () => {} },
    assets: { ensureFor: async () => {} },
    initialRoute: 'boot',
    initialBootSubphase: 'intro',
  })
  const routeAdapter = createVueRouteAdapter(coordinator, compositeRenderer)

  // Stand in for the RouteMount witnesses that real screens provide.
  const autoMount = (route: Route) => {
    compositeRenderer.markRouteMounted(route)
  }

  return { flow: useBootFlow(coordinator, routeAdapter), coordinator, autoMount }
}

describe('useBootFlow', () => {
  it('moves through the online bootstrap stages, each gated on its screen mounting', async () => {
    const { flow, autoMount } = createFlow()

    expect(flow.stage.value).toBe('intro')

    const auth = flow.showAuth()
    autoMount('auth')
    await vi.waitFor(() => expect(flow.stage.value).toBe('auth'))
    void auth

    // Subphases are not routes: no transition, no curtain, immediate.
    flow.startSaveLoad()
    expect(flow.stage.value).toBe('loading_save')

    flow.requireCharacter()
    autoMount('character')
    await vi.waitFor(() => expect(flow.stage.value).toBe('character'))

    flow.startInitializing()
    expect(flow.stage.value).toBe('initializing')

    flow.enterGame()
    autoMount('home')
    await vi.waitFor(() => expect(flow.stage.value).toBe('game'))
  })

  it('does not leave a stage before its screen has mounted', async () => {
    const { flow, autoMount } = createFlow()

    flow.showAuth()
    await Promise.resolve()

    // No mount witness yet: the boot screen is still what the player sees.
    expect(flow.stage.value).toBe('intro')

    autoMount('auth')
    await vi.waitFor(() => expect(flow.stage.value).toBe('auth'))
  })

  it('maps a failed boot to the error stage', async () => {
    const { flow, autoMount } = createFlow()

    flow.fail()
    autoMount('error')
    await vi.waitFor(() => expect(flow.stage.value).toBe('error'))
  })

  it('keeps the game branch mounted after a failed game transition so retry reuses the host', async () => {
    const failing = new PhaserSceneAdapter()
    const renderer = new CompositeRenderer(failing)
    renderer.prepare = async () => {
      throw new Error('host exploded')
    }

    const coordinator = new GamePresentationCoordinator({
      sessionPort: new PresentationSession(),
      renderer,
      curtain: { close: async () => {}, open: async () => {} },
      assets: { ensureFor: async () => {} },
      initialRoute: 'character',
    })
    const routeAdapter = createVueRouteAdapter(coordinator, renderer)
    const flow = useBootFlow(coordinator, routeAdapter)

    expect(flow.stage.value).toBe('character')

    flow.enterGame()
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('failed'))

    // Falling back to 'character' here would unmount GameRoot and destroy the
    // Phaser game the retry is about to need.
    expect(flow.stage.value).toBe('game')
  })

  it('a game route wins over a stale boot subphase', async () => {
    const { flow, coordinator, autoMount } = createFlow()

    flow.enterGame()
    autoMount('home')
    await vi.waitFor(() => expect(flow.stage.value).toBe('game'))

    coordinator.setBootSubphase('initializing')

    expect(flow.stage.value).toBe('game')
  })
})
