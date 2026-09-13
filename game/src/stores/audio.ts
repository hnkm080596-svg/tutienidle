// useAudioStore — Pinia store wrap AudioManager để:
//   1. UI (vd. SettingsPanel) có thể đọc/ghi enabled + volume.
//   2. Vue reactivity đồng bộ với engine (AudioManager).
//
// AudioManager vẫn là singleton không-phụ-thuộc-Vue (test trực tiếp
// được); store chỉ là adapter mỏng, không sở hữu logic.

import { defineStore } from 'pinia'
import { AudioManager, type SoundId } from '@/core/audio/AudioManager'

export const useAudioStore = defineStore('audio', {
  state: () => ({
    enabled: true,
    masterVolume: 0.7,
  }),

  actions: {
    /** Gọi khi user thực hiện gesture đầu tiên (click/touch) để vượt autoplay policy. */
    unlock() {
      const mgr = AudioManager.getInstance()
      mgr.unlock()
      // Đồng bộ state mới nhất vào AudioManager (SettingsPanel có thể đã
      // set trước đó từ localStorage).
      mgr.setEnabled(this.enabled)
      mgr.setMasterVolume(this.masterVolume)
    },

    setEnabled(value: boolean) {
      this.enabled = value
      AudioManager.getInstance().setEnabled(value)
    },

    setMasterVolume(value: number) {
      this.masterVolume = Math.max(0, Math.min(1, value))
      AudioManager.getInstance().setMasterVolume(this.masterVolume)
    },

    play(id: SoundId) {
      AudioManager.getInstance().play(id)
    },
  },
})