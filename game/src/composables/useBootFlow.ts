import { computed, type ComputedRef } from 'vue'
import type { GamePresentationCoordinator } from '@/presentation/GamePresentationCoordinator'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'

export type BootStage = 'intro' | 'auth' | 'character' | 'game' | 'error'

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
 * a save after auth does not pay for a second full curtain transition. They
 * also no longer swap the visible screen: the subphase is bookkeeping only,
 * and the mounted screen must not change until the curtain is closed - the
 * save load runs while the auth/character screen the user just used is still
 * displayed, then the route transition covers the swap.
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
    //
    // The targetRoute signal only counts once the curtain is CLOSED (phase
    // 'loading' onward): the coordinator publishes it at transition start,
    // and promoting while the panels are still sliding shut swaps the
    // mounted screen mid-animation - the scene visibly changes before the
    // curtain has finished closing. Post-close promotion still precedes
    // every step that needs the host: ensureFor's waitForLoaderScene and
    // the adapter's waitForGameReady already wait for it asynchronously.
    const curtainClosed =
      routeAdapter.phase.value !== 'idle' && routeAdapter.phase.value !== 'closing'
    const pendingGameRoute =
      (curtainClosed ? routeAdapter.targetRoute.value : null) ??
      routeAdapter.error.value?.failedRequest.target ??
      null

    if (GAME_ROUTES.has(route) || (pendingGameRoute !== null && GAME_ROUTES.has(pendingGameRoute))) {
      return 'game'
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
    // No setBootSubphase(null) ahead of these requests: the coordinator
    // clears it itself when the target mounts behind the closed curtain
    // (executeTransition step 5). Clearing it here would flip the stage
    // while the curtain is still open or mid-close.
    showAuth: () => {
      void coordinator.request({ target: 'auth' })
    },
    startSaveLoad: () => {
      coordinator.setBootSubphase('loading_save')
    },
    requireCharacter: () => {
      void coordinator.request({ target: 'character' })
    },
    startInitializing: () => {
      coordinator.setBootSubphase('initializing')
    },
    enterGame: () => {
      void coordinator.request({ target: 'home' })
    },
    fail: () => {
      void coordinator.request({ target: 'error' })
    },
  }
}
