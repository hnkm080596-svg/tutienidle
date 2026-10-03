// artWarmWiring - committed route -> 'ui-scenes' warm.
//
// 'ui-scenes' enumerates the panel/backdrop/icon art every surface can
// reach mid-session (parallax stacks, per-scene hero art, all Dong Fu and
// Thanh Van backdrop variants, building sprites, catalog item icons). It
// stays OUT of getBundlesForRoute for the same reason the audio bundles
// do: ~150MB cannot sit inside a transition's asset deadline. This lane
// mirrors audioAssetWiring - a fire-and-forget prefetch that can never
// reject a route.
//
// The warm starts on the 'home' COMMIT, not 'character': the prefetch
// issues ~240 fetches that share the browser's connection pool with the
// required 'home'+'ui-chrome' lane, so warming during the character
// screen could starve a fast-clicking user's required assets behind lazy
// ones on slow links. At 'home' commit the required lane is already
// loaded; the curtain opens on schedule and the warm fills the panel art
// while the home scene is up - still before any panel can be opened.

import type { GamePresentationCoordinator } from '../GamePresentationCoordinator'
import type { Route } from '../PresentationContracts'
import type { AssetBundleId } from './AssetBundleCatalog'

/** Minimal surface the wiring needs - AssetBundleManager satisfies it. */
export interface ArtBundleWarmer {
  prefetch(bundleIds: readonly AssetBundleId[]): Promise<void>
}

export const ROUTE_ART_WARM_BUNDLES: Record<Route, readonly AssetBundleId[]> = {
  boot: [],
  auth: [],
  character: [],
  home: ['ui-scenes'],
  combat: ['ui-scenes'],
  tribulation: ['ui-scenes'],
  error: [],
}

/**
 * Fire-and-forget warm of the art reachable from `route`. Never rejects:
 * AssetBundleManager.prefetch swallows per-resource failures, so a cold
 * CDN or missing file degrades to the old lazy-fetch path instead of
 * failing the transition.
 */
export function warmArtForRoute(route: Route, warmer: ArtBundleWarmer): Promise<void> {
  return warmer.prefetch(ROUTE_ART_WARM_BUNDLES[route])
}

/**
 * Bind once in App.vue; the returned teardown unsubscribes. The warm fires
 * for the currently committed route immediately (covers HMR remounts that
 * rebind while already in-game), then again on every later commit -
 * already-warmed keys dedupe to no-ops inside the bundle manager.
 */
export function bindArtWarm(
  coordinator: GamePresentationCoordinator,
  warmer: ArtBundleWarmer,
): () => void {
  let route = coordinator.getSnapshot().currentRoute
  const unsubscribe = coordinator.subscribe((snapshot) => {
    if (snapshot.currentRoute !== route) {
      route = snapshot.currentRoute
      void warmArtForRoute(route, warmer)
    }
  })
  void warmArtForRoute(route, warmer)
  return unsubscribe
}
