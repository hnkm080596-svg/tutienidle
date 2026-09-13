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
    const { flow, coordinator, autoMount } = createFlow()

    expect(flow.stage.value).toBe('intro')

    const auth = flow.showAuth()
    autoMount('auth')
    await vi.waitFor(() => expect(flow.stage.value).toBe('auth'))
    void auth

    // Subphases are bookkeeping only: the mounted screen must not change
    // until the curtain is closed, so the auth screen stays displayed while
    // the save loads - the coordinator still records the subphase.
    flow.startSaveLoad()
    expect(flow.stage.value).toBe('auth')
    expect(coordinator.getSnapshot().bootSubphase).toBe('loading_save')

    flow.requireCharacter()
    autoMount('character')
    await vi.waitFor(() => expect(flow.stage.value).toBe('character'))

    flow.startInitializing()
    expect(flow.stage.value).toBe('character')

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

  it('does not promote to the game branch while the curtain is still closing', async () => {
    let releaseClose: () => void = () => {}
    const closeLatch = new Promise<void>((resolve) => {
      releaseClose = resolve
    })

    const phaserAdapter = new PhaserSceneAdapter()
    const compositeRenderer = new CompositeRenderer(phaserAdapter)
    const coordinator = new GamePresentationCoordinator({
      sessionPort: new PresentationSession(),
      renderer: compositeRenderer,
      curtain: { close: () => closeLatch, open: async () => {} },
      assets: { ensureFor: async () => {} },
      initialRoute: 'auth',
    })
    const routeAdapter = createVueRouteAdapter(coordinator, compositeRenderer)
    const flow = useBootFlow(coordinator, routeAdapter)

    expect(flow.stage.value).toBe('auth')

    flow.enterGame()
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('closing'))

    // The target route is already published, but the mounted screen must
    // not swap until the curtain has finished closing over it.
    expect(coordinator.getSnapshot().targetRoute).toBe('home')
    expect(flow.stage.value).toBe('auth')

    releaseClose()
    compositeRenderer.markRouteMounted('home')
    await vi.waitFor(() => expect(flow.stage.value).toBe('game'))
  })

  it('keeps the current screen through the close animation of a non-game target', async () => {
    let releaseClose: () => void = () => {}
    const closeLatch = new Promise<void>((resolve) => {
      releaseClose = resolve
    })

    const phaserAdapter = new PhaserSceneAdapter()
    const compositeRenderer = new CompositeRenderer(phaserAdapter)
    const coordinator = new GamePresentationCoordinator({
      sessionPort: new PresentationSession(),
      renderer: compositeRenderer,
      curtain: { close: () => closeLatch, open: async () => {} },
      assets: { ensureFor: async () => {} },
      initialRoute: 'auth',
    })
    const routeAdapter = createVueRouteAdapter(coordinator, compositeRenderer)
    const flow = useBootFlow(coordinator, routeAdapter)

    // The save-load subphase no longer swaps the screen: auth stays
    // displayed until the curtain covers the transition.
    flow.startSaveLoad()
    expect(flow.stage.value).toBe('auth')

    flow.requireCharacter()
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('closing'))
    expect(flow.stage.value).toBe('auth')

    // The coordinator clears the subphase when the target mounts behind the
    // curtain, so the creation screen stands in before the reveal.
    releaseClose()
    compositeRenderer.markRouteMounted('character')
    await vi.waitFor(() => expect(flow.stage.value).toBe('character'))
    expect(coordinator.getSnapshot().bootSubphase).toBeNull()
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
