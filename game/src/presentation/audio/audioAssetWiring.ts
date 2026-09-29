// audioAssetWiring - Sound System W4. Maps a committed route onto the lazy
// `audio-*` bundles and ensures them through AssetBundleManager. The caller
// (ambientAudioDriver, W8) gates on `isUnlocked() && audio.enabled` - when
// either is false this is never invoked (Q5: muted = zero fetches).
//
// Audio bundles stay OUT of getBundlesForRoute: a missing file marks its
// key missing and resolves (optional contract), so audio can never delay
// or reject a route transition.

import type { Route } from '../PresentationContracts'
import type { AssetBundleId } from '../assets/AssetBundleCatalog'

/** Minimal surface the wiring needs - AssetBundleManager satisfies it. */
export interface AudioBundleLoader {
  ensureLoaded(bundleIds: readonly AssetBundleId[], signal?: AbortSignal): Promise<void>
}

export const ROUTE_AUDIO_BUNDLES: Record<Route, readonly AssetBundleId[]> = {
  home: ['audio-core'],
  combat: ['audio-core', 'audio-combat'],
  tribulation: ['audio-core', 'audio-tribulation'],
  boot: ['audio-core'],
  auth: ['audio-core'],
  character: ['audio-core'],
  error: ['audio-core'],
}

/** Fire-and-forget lazy load for the route's audio cues. Never rejects. */
export function ensureAudioForRoute(route: Route, bundles: AudioBundleLoader): Promise<void> {
  return bundles.ensureLoaded(ROUTE_AUDIO_BUNDLES[route]).catch(() => undefined)
}
