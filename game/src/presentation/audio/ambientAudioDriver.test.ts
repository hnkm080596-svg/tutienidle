// @vitest-environment jsdom
// W4/W8 - ambientAudioDriver fetches the route's lazy audio-* bundles only
// while unlocked && enabled, re-fires the gated route on onReady, and
// crossfades the music slot on committed route changes.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { bindAmbientAudio } from './ambientAudioDriver'
import { useAudioStore } from '@/stores/audio'
import { AudioManager } from '@/core/audio/AudioManager'
import type { GamePresentationCoordinator } from '@/presentation/GamePresentationCoordinator'
import type { Route } from '@/presentation/PresentationContracts'
import type { AudioBundleLoader } from './audioAssetWiring'

type Listener = (snapshot: { currentRoute: Route }) => void

function fakeCoordinator(initial: Route): {
  coordinator: GamePresentationCoordinator
  emit: (route: Route) => void
} {
  const listeners = new Set<Listener>()
  const coordinator = {
    getSnapshot: () => ({ currentRoute: routeRef.current }),
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      listener({ currentRoute: routeRef.current })
      return () => listeners.delete(listener)
    },
  } as unknown as GamePresentationCoordinator
  const routeRef = { current: initial }
  return {
    coordinator,
    emit: (route: Route) => {
      routeRef.current = route
      for (const l of listeners) l({ currentRoute: route })
    },
  }
}

let unlocked = false
let readyCallbacks: Array<() => void>

beforeEach(() => {
  setActivePinia(createPinia())
  unlocked = false
  readyCallbacks = []
  vi.spyOn(AudioManager.getInstance(), 'isUnlocked').mockImplementation(() => unlocked)
  vi.spyOn(AudioManager.getInstance(), 'onReady').mockImplementation((cb: () => void) => {
    readyCallbacks.push(cb)
    return () => {
      readyCallbacks = readyCallbacks.filter((c) => c !== cb)
    }
  })
  vi.spyOn(AudioManager.getInstance(), 'crossfadeMusic').mockImplementation(() => {})
  vi.spyOn(AudioManager.getInstance(), 'stopMusic').mockImplementation(() => {})
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function makeBundles() {
  return { ensureLoaded: vi.fn(async () => undefined) } as unknown as AudioBundleLoader & {
    ensureLoaded: ReturnType<typeof vi.fn>
  }
}

describe('bindAmbientAudio bundle lane', () => {
  it('fetches nothing while locked; re-fires the gated route on onReady', () => {
    const store = useAudioStore()
    const bundles = makeBundles()
    const { coordinator } = fakeCoordinator('home')
    bindAmbientAudio(coordinator, store, bundles)

    expect(bundles.ensureLoaded).not.toHaveBeenCalled()

    unlocked = true
    for (const cb of readyCallbacks) cb()
    expect(bundles.ensureLoaded).toHaveBeenCalledWith(['audio-core'])
  })

  it('fetches the combat bundle set on a route change while unlocked', () => {
    const store = useAudioStore()
    const bundles = makeBundles()
    const { coordinator, emit } = fakeCoordinator('home')
    unlocked = true
    bindAmbientAudio(coordinator, store, bundles)
    expect(bundles.ensureLoaded).toHaveBeenLastCalledWith(['audio-core'])

    emit('combat')
    expect(bundles.ensureLoaded).toHaveBeenLastCalledWith(['audio-core', 'audio-combat'])
  })

  it('fetches nothing while muted and refetches on re-enable', async () => {
    const store = useAudioStore()
    const bundles = makeBundles()
    const { coordinator } = fakeCoordinator('home')
    unlocked = true
    store.enabled = false
    bindAmbientAudio(coordinator, store, bundles)
    expect(bundles.ensureLoaded).not.toHaveBeenCalled()

    store.enabled = true
    await nextTick()
    expect(bundles.ensureLoaded).toHaveBeenCalledWith(['audio-core'])
  })

  it('works without a bundles loader (playback only)', () => {
    const store = useAudioStore()
    const audio = AudioManager.getInstance()
    const { coordinator, emit } = fakeCoordinator('home')
    unlocked = true
    const unbind = bindAmbientAudio(coordinator, store)
    emit('combat')
    expect(audio.crossfadeMusic).toHaveBeenLastCalledWith('music.combat', 1500)
    unbind()
  })
})
