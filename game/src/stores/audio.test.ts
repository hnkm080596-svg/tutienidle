// useAudioStore.test.ts — verifies the store mirrors AudioManager both ways.
// W3: v2 blob {enabled, masterVolume, musicVolume, sfxVolume, uiVolume,
// reducedShake} under 'tutienidle.audio.v2'; v1 fallback migrates forward.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from './audio'
import { AudioManager, resetAudioManagerForTest } from '@/core/audio/AudioManager'

// Node environment — minimal localStorage polyfill (same pattern as
// SaveSystem.test.ts).
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

beforeEach(() => {
  // Fresh storage per test — the store persists settings, so a previous
  // test's write must not leak into the next store's defaults.
  vi.stubGlobal('localStorage', new MemoryStorage())
  setActivePinia(createPinia())
  resetAudioManagerForTest()
})

describe('useAudioStore', () => {
  it('defaults to enabled=true, masterVolume=0.7, channel defaults, reducedShake=false', () => {
    const store = useAudioStore()
    expect(store.enabled).toBe(true)
    expect(store.masterVolume).toBe(0.7)
    expect(store.musicVolume).toBe(0.5)
    expect(store.sfxVolume).toBe(0.8)
    expect(store.uiVolume).toBe(0.7)
    expect(store.reducedShake).toBe(false)
  })

  it('setEnabled(false) syncs to AudioManager', () => {
    const store = useAudioStore()
    store.setEnabled(false)
    expect(AudioManager.getInstance().isEnabled()).toBe(false)
  })

  it('setMasterVolume(0.3) syncs to AudioManager', () => {
    const store = useAudioStore()
    store.setMasterVolume(0.3)
    expect(AudioManager.getInstance().getMasterVolume()).toBe(0.3)
  })

  it('setMasterVolume clamps out-of-[0,1] values', () => {
    const store = useAudioStore()
    store.setMasterVolume(2)
    expect(store.masterVolume).toBe(1)
    store.setMasterVolume(-1)
    expect(store.masterVolume).toBe(0)
  })

  it('setChannelVolume syncs each channel to AudioManager and clamps', () => {
    const mgr = AudioManager.getInstance()
    const store = useAudioStore()
    store.setChannelVolume('music', 0.25)
    store.setChannelVolume('sfx', 2)
    store.setChannelVolume('ui', -0.5)
    expect(store.musicVolume).toBe(0.25)
    expect(store.sfxVolume).toBe(1)
    expect(store.uiVolume).toBe(0)
    expect(mgr.getChannelVolume('music')).toBe(0.25)
    expect(mgr.getChannelVolume('sfx')).toBe(1)
    expect(mgr.getChannelVolume('ui')).toBe(0)
  })

  it('setReducedShake persists the flag', () => {
    const store = useAudioStore()
    store.setReducedShake(true)
    expect(store.reducedShake).toBe(true)

    setActivePinia(createPinia())
    const restored = useAudioStore()
    expect(restored.reducedShake).toBe(true)
  })

  it('persists the full v2 blob to localStorage', () => {
    const store = useAudioStore()
    store.setEnabled(false)
    store.setMasterVolume(0.4)
    store.setChannelVolume('music', 0.3)
    store.setChannelVolume('sfx', 0.9)
    store.setChannelVolume('ui', 0.6)
    store.setReducedShake(true)

    const raw = localStorage.getItem('tutienidle.audio.v2')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as Record<string, unknown>
    expect(parsed).toMatchObject({
      enabled: false,
      masterVolume: 0.4,
      musicVolume: 0.3,
      sfxVolume: 0.9,
      uiVolume: 0.6,
      reducedShake: true,
    })

    // A fresh store instance restores the persisted settings.
    setActivePinia(createPinia())
    const restored = useAudioStore()
    expect(restored.enabled).toBe(false)
    expect(restored.masterVolume).toBe(0.4)
    expect(restored.musicVolume).toBe(0.3)
    expect(restored.sfxVolume).toBe(0.9)
    expect(restored.uiVolume).toBe(0.6)
    expect(restored.reducedShake).toBe(true)
  })

  it('v1 blob migrates forward (enabled + masterVolume carry, rest default)', () => {
    localStorage.setItem('tutienidle.audio.v1', JSON.stringify({
      enabled: false,
      masterVolume: 0.15,
    }))
    setActivePinia(createPinia())
    const store = useAudioStore()
    expect(store.enabled).toBe(false)
    expect(store.masterVolume).toBe(0.15)
    expect(store.musicVolume).toBe(0.5)
    expect(store.reducedShake).toBe(false)
    // Writing must land on the v2 key.
    store.setEnabled(true)
    expect(localStorage.getItem('tutienidle.audio.v2')).not.toBeNull()
  })

  it('v2 blob wins over a stale v1 blob', () => {
    localStorage.setItem('tutienidle.audio.v1', JSON.stringify({ enabled: false, masterVolume: 0.1 }))
    localStorage.setItem('tutienidle.audio.v2', JSON.stringify({ enabled: true, masterVolume: 0.9, musicVolume: 0.2 }))
    setActivePinia(createPinia())
    const store = useAudioStore()
    expect(store.enabled).toBe(true)
    expect(store.masterVolume).toBe(0.9)
    expect(store.musicVolume).toBe(0.2)
  })

  it('ignores malformed persisted payloads', () => {
    localStorage.setItem('tutienidle.audio.v2', '{not json')
    setActivePinia(createPinia())
    const store = useAudioStore()
    expect(store.enabled).toBe(true)
    expect(store.masterVolume).toBe(0.7)
  })

  it('unlock() does NOT throw when AudioContext is unavailable', () => {
    const store = useAudioStore()
    expect(() => store.unlock()).not.toThrow()
  })

  it('cue() forwards to AudioManager.playCue without throwing', () => {
    const spy = vi.spyOn(AudioManager.getInstance(), 'playCue')
    const store = useAudioStore()
    store.cue('ui.click')
    expect(spy).toHaveBeenCalledWith('ui.click')
  })
})
