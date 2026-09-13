// useAudioStore.test.ts — verify store đồng bộ 2 chiều với AudioManager.

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from './audio'
import { AudioManager, resetAudioManagerForTest } from '@/core/audio/AudioManager'

beforeEach(() => {
  setActivePinia(createPinia())
  resetAudioManagerForTest()
})

describe('useAudioStore', () => {
  it('mặc định enabled=true, masterVolume=0.7', () => {
    const store = useAudioStore()
    expect(store.enabled).toBe(true)
    expect(store.masterVolume).toBe(0.7)
  })

  it('setEnabled(false) đồng bộ sang AudioManager', () => {
    const store = useAudioStore()
    store.setEnabled(false)
    expect(AudioManager.getInstance().isEnabled()).toBe(false)
  })

  it('setMasterVolume(0.3) đồng bộ sang AudioManager', () => {
    const store = useAudioStore()
    store.setMasterVolume(0.3)
    expect(AudioManager.getInstance().getMasterVolume()).toBe(0.3)
  })

  it('setMasterVolume clamp giá trị ngoài [0,1]', () => {
    const store = useAudioStore()
    store.setMasterVolume(2)
    expect(store.masterVolume).toBe(1)
    store.setMasterVolume(-1)
    expect(store.masterVolume).toBe(0)
  })

  it('unlock() KHÔNG throw khi AudioContext chưa có sẵn', () => {
    const store = useAudioStore()
    expect(() => store.unlock()).not.toThrow()
  })
})