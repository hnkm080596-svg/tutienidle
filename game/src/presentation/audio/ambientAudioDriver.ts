// ambientAudioDriver - route -> music crossfade driver (W8).
//
// Subscribes to the coordinator's committed route and drives the single
// AudioManager music slot through crossfadeMusic. Per OQ-A there is NO
// Tone.js ambient fallback: music.* rows resolve to empty slots until
// real assets land, so driving an un-slotted cue is a silent no-op -
// dropping the files into public/assets/audio/music/ is the only step.
//
// Gating:
//   - unlock: playMusic/crossfadeMusic only set the desired slot until
//     unlock(), so route transitions before the first gesture are
//     captured and start on unlock.
//   - enabled=false: stopMusic; re-enable resumes the current route's
//     track.
//   - visibilitychange: hidden -> suspendMusic, visible -> resumeMusic.
//
// Bind once in App.vue; the returned teardown unsubscribes, removes the
// visibility listener, and stops music.
//
// W4 lane: when a bundles loader is passed, each applied route also
// requests its lazy audio-* bundles - gated on unlock() && enabled so a
// muted or never-gestured session fetches nothing (Q5).

import { AudioManager } from '@/core/audio/AudioManager'
import type { GamePresentationCoordinator } from '@/presentation/GamePresentationCoordinator'
import type { Route } from '@/presentation/PresentationContracts'
import type { AudioCueId } from '@/core/audio/AudioCueManifest'
import type { useAudioStore } from '@/stores/audio'
import { ensureAudioForRoute, type AudioBundleLoader } from './audioAssetWiring'
import { watch } from 'vue'

const CROSSFADE_MS = 1500

/** Route -> music cue. boot/auth/character/error share the menu bed. */
const ROUTE_MUSIC: Record<Route, AudioCueId> = {
  home: 'music.home',
  combat: 'music.combat',
  tribulation: 'music.tribulation',
  boot: 'music.menu',
  auth: 'music.menu',
  character: 'music.menu',
  error: 'music.menu',
}

type AudioStore = ReturnType<typeof useAudioStore>

export function bindAmbientAudio(
  coordinator: GamePresentationCoordinator,
  audioStore: AudioStore,
  bundles?: AudioBundleLoader,
): () => void {
  const audio = AudioManager.getInstance()
  let route: Route = coordinator.getSnapshot().currentRoute

  // Lazy audio bundles follow the SAME gate as playback: no fetch before
  // the first user gesture unlocks audio, none while muted.
  function ensureRouteBundles(): void {
    if (!bundles || !audioStore.enabled || !audio.isUnlocked()) return
    void ensureAudioForRoute(route, bundles)
  }

  function applyRoute(r: Route): void {
    route = r
    ensureRouteBundles()
    if (!audioStore.enabled) return
    audio.crossfadeMusic(ROUTE_MUSIC[r], CROSSFADE_MS)
  }

  // subscribe() fires immediately with the current snapshot - the route
  // equals `route` there, so the listener is change-only; seed the
  // initial route explicitly so the first unlock() knows the track.
  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      audio.suspendMusic()
    } else {
      audio.resumeMusic()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  // Seed BEFORE the first applyRoute: on a hidden remount with unlocked
  // audio, applyRoute's crossfadeMusic would otherwise spawn a player for
  // a few ms before the seed suspends it.
  onVisibilityChange()

  // subscribe() fires immediately with the current snapshot - the route
  // equals `route` there, so the listener is change-only; seed the
  // initial route explicitly so the first unlock() knows the track.
  const unsubscribe = coordinator.subscribe((snapshot) => {
    if (snapshot.currentRoute !== route) applyRoute(snapshot.currentRoute)
  })
  applyRoute(route)

  // The route applied before the first gesture was gated on isUnlocked() -
  // re-fire once the chain is live.
  const stopReady = audio.onReady(ensureRouteBundles)

  const stopEnabledWatch = watch(
    () => audioStore.enabled,
    (enabled) => {
      if (enabled) {
        ensureRouteBundles()
        audio.crossfadeMusic(ROUTE_MUSIC[route], CROSSFADE_MS)
      } else {
        audio.stopMusic()
      }
    },
  )

  return () => {
    unsubscribe()
    stopReady()
    stopEnabledWatch()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    audio.stopMusic()
  }
}
