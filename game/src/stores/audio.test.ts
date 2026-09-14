// useAudioStore.test.ts — verifies the store mirrors AudioManager both ways.

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
  it('defaults to enabled=true, masterVolume=0.7', () => {
    const store = useAudioStore()
    expect(store.enabled).toBe(true)
    expect(store.masterVolume).toBe(0.7)
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

  it('persists enabled + volume to localStorage', () => {
    const store = useAudioStore()
    store.setEnabled(false)
    store.setMasterVolume(0.4)

    const raw = localStorage.getItem('tutienidle.audio.v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { enabled: boolean; masterVolume: number }
    expect(parsed.enabled).toBe(false)
    expect(parsed.masterVolume).toBe(0.4)

    // A fresh store instance restores the persisted settings.
    setActivePinia(createPinia())
    const restored = useAudioStore()
    expect(restored.enabled).toBe(false)
    expect(restored.masterVolume).toBe(0.4)
  })

  it('ignores malformed persisted payloads', () => {
    localStorage.setItem('tutienidle.audio.v1', '{not json')
    setActivePinia(createPinia())
    const store = useAudioStore()
    expect(store.enabled).toBe(true)
    expect(store.masterVolume).toBe(0.7)
  })

  it('unlock() does NOT throw when AudioContext is unavailable', () => {
    const store = useAudioStore()
    expect(() => store.unlock()).not.toThrow()
  })
})
