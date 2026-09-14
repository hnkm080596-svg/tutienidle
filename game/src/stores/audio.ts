// useAudioStore — thin Pinia adapter over AudioManager so that:
//   1. UI (e.g. SettingsPanel) can read/write enabled + volume reactively.
//   2. Vue reactivity stays in sync with the engine (AudioManager).
//
// AudioManager remains a Vue-free singleton (directly unit-testable);
// the store owns no logic — only state mirroring + localStorage
// persistence to localStorage.

import { defineStore } from 'pinia'
import { AudioManager, type SoundId } from '@/core/audio/AudioManager'

const STORAGE_KEY = 'tutienidle.audio.v1'

interface PersistedAudioSettings {
  enabled?: boolean
  masterVolume?: number
}

function loadPersisted(): PersistedAudioSettings {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as PersistedAudioSettings
  } catch {
    return {}
  }
}

function persist(state: { enabled: boolean; masterVolume: number }): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: state.enabled,
      masterVolume: state.masterVolume,
    }))
  } catch {
    // Quota/blocked storage — settings stay session-only.
  }
}

export const useAudioStore = defineStore('audio', {
  state: () => {
    const persisted = loadPersisted()
    return {
      enabled: persisted.enabled ?? true,
      masterVolume:
        typeof persisted.masterVolume === 'number' && Number.isFinite(persisted.masterVolume)
          ? Math.max(0, Math.min(1, persisted.masterVolume))
          : 0.7,
    }
  },

  actions: {
    /** Call on the first user gesture (click/touch) to pass the autoplay policy. */
    unlock() {
      const mgr = AudioManager.getInstance()
      mgr.unlock()
      // Push latest state into AudioManager (SettingsPanel may have set it
      // from localStorage before the first gesture).
      mgr.setEnabled(this.enabled)
      mgr.setMasterVolume(this.masterVolume)
    },

    setEnabled(value: boolean) {
      this.enabled = value
      AudioManager.getInstance().setEnabled(value)
      persist(this)
    },

    setMasterVolume(value: number) {
      this.masterVolume = Math.max(0, Math.min(1, value))
      AudioManager.getInstance().setMasterVolume(this.masterVolume)
      persist(this)
    },

    play(id: SoundId) {
      AudioManager.getInstance().play(id)
    },
  },
})
