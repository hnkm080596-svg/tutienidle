// useAudioStore — thin Pinia adapter over AudioManager so that:
//   1. UI (e.g. SettingsPanel) can read/write enabled + volumes reactively.
//   2. Vue reactivity stays in sync with the engine (AudioManager).
//
// AudioManager remains a Vue-free singleton (directly unit-testable);
// the store owns no logic — only state mirroring + localStorage
// persistence.
//
// Sound System W3: v2 blob adds per-channel volumes + reducedShake (W10).
// Device-scope localStorage - no saveVersion bump (same decision as
// uiFlagsPersistence).

import { defineStore } from 'pinia'
import { AudioManager } from '@/core/audio/AudioManager'
import type { AudioChannelId } from '@/core/audio/AudioChannels'
import { DEFAULT_CHANNEL_VOLUMES } from '@/core/audio/AudioChannels'

const STORAGE_KEY = 'tutienidle.audio.v2'
const STORAGE_KEY_V1 = 'tutienidle.audio.v1'

interface PersistedAudioSettings {
  enabled?: boolean
  masterVolume?: number
  musicVolume?: number
  sfxVolume?: number
  uiVolume?: number
  reducedShake?: boolean
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : fallback
}

function loadPersisted(): PersistedAudioSettings {
  if (typeof localStorage === 'undefined') return {}
  // v2 first; fall back to the v1 blob (only enabled + masterVolume carry).
  for (const key of [STORAGE_KEY, STORAGE_KEY_V1]) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) continue
      return parsed as PersistedAudioSettings
    } catch {
      return {}
    }
  }
  return {}
}

function persist(state: {
  enabled: boolean
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  uiVolume: number
  reducedShake: boolean
}): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: state.enabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      uiVolume: state.uiVolume,
      reducedShake: state.reducedShake,
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
      masterVolume: finiteOr(persisted.masterVolume, 0.7),
      musicVolume: finiteOr(persisted.musicVolume, DEFAULT_CHANNEL_VOLUMES.music),
      sfxVolume: finiteOr(persisted.sfxVolume, DEFAULT_CHANNEL_VOLUMES.sfx),
      uiVolume: finiteOr(persisted.uiVolume, DEFAULT_CHANNEL_VOLUMES.ui),
      reducedShake: persisted.reducedShake ?? false,
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
      mgr.setChannelVolume('music', this.musicVolume)
      mgr.setChannelVolume('sfx', this.sfxVolume)
      mgr.setChannelVolume('ui', this.uiVolume)
    },

    setEnabled(value: boolean) {
      this.enabled = value
      AudioManager.getInstance().setEnabled(value)
      persist(this)
    },

    setMasterVolume(value: number) {
      this.masterVolume = clamp01(value)
      AudioManager.getInstance().setMasterVolume(this.masterVolume)
      persist(this)
    },

    setChannelVolume(channel: AudioChannelId, value: number) {
      const v = clamp01(value)
      if (channel === 'music') this.musicVolume = v
      else if (channel === 'sfx') this.sfxVolume = v
      else this.uiVolume = v
      AudioManager.getInstance().setChannelVolume(channel, v)
      persist(this)
    },

    setReducedShake(value: boolean) {
      this.reducedShake = value
      persist(this)
    },

    /** Fire a manifest cue (domain.verb[.qualifier]). */
    cue(id: string) {
      AudioManager.getInstance().playCue(id)
    },
  },
})
