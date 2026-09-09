import { computed, type ComputedRef } from 'vue'
import type { GamePresentationCoordinator } from '@/presentation/GamePresentationCoordinator'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'

export type BootStage = 'intro' | 'auth' | 'loading_save' | 'character' | 'initializing' | 'game' | 'error'

export interface BootFlow {
  readonly stage: ComputedRef<BootStage>
  showAuth(): void
  startSaveLoad(): void
  requireCharacter(): void
  startInitializing(): void
  enterGame(): void
  fail(): void
}

const GAME_ROUTES = new Set(['home', 'combat', 'tribulation'])

/**
 * Compatibility facade over the coordinator: the entry screens keep their
 * historical stage vocabulary while the coordinator remains the ONLY route
 * authority. `stage` is derived, never assigned - a local stage ref would be a
 * second writable route that can disagree with what is actually rendered.
 *
 * loading_save/initializing stay boot SUBPHASES rather than routes, so loading
 * a save after auth does not pay for a second full curtain transition.
 */
export function useBootFlow(
  coordinator: GamePresentationCoordinator,
  routeAdapter: VueRouteAdapter,
): BootFlow {
  const stage = computed<BootStage>(() => {
    const route = routeAdapter.activeRoute.value

    // Promote-only: the game branch owns the Phaser host, and a transition
    // INTO a game route cannot finish loading assets until that host exists
    // (its loader scene lives there). Demotion waits for the route to actually
    // change, so leaving the game does not unmount early - and a FAILED game
    // transition keeps the host mounted so retry reuses it instead of
    // destroying and recreating the whole Phaser.Game.
    const pendingGameRoute =
      routeAdapter.targetRoute.value ?? routeAdapter.error.value?.failedRequest.target ?? null

    if (GAME_ROUTES.has(route) || (pendingGameRoute !== null && GAME_ROUTES.has(pendingGameRoute))) {
      return 'game'
    }

    const subphase = routeAdapter.bootSubphase.value
    if (subphase === 'loading_save' || subphase === 'initializing') {
      return subphase
    }

    switch (route) {
      case 'auth':
        return 'auth'
      case 'character':
        return 'character'
      case 'error':
        return 'error'
      default:
        return 'intro'
    }
  })

  return {
    stage,
    showAuth: () => {
      coordinator.setBootSubphase(null)
      void coordinator.request({ target: 'auth' })
    },
    startSaveLoad: () => {
      coordinator.setBootSubphase('loading_save')
    },
    requireCharacter: () => {
      coordinator.setBootSubphase(null)
      void coordinator.request({ target: 'character' })
    },
    startInitializing: () => {
      coordinator.setBootSubphase('initializing')
    },
    enterGame: () => {
      coordinator.setBootSubphase(null)
      void coordinator.request({ target: 'home' })
    },
    fail: () => {
      coordinator.setBootSubphase(null)
      void coordinator.request({ target: 'error' })
    },
  }
}
