import { defineStore } from 'pinia'
import type { AudioCueId } from '@/core/audio/AudioCueManifest'
import { useAudioStore } from '@/stores/audio'

export interface WorldAnnouncementContent {
  title: string

  body: string
}

// Thoi gian tu dong neu nguoi choi khong bam gi - du doc xong 1 dong
// title + 1 dong body (khop mockup muc XIII tai lieu beta).
const AUTO_CLOSE_MS = 5000

// Handle for the auto-close timer - tracked so show()/hide() cancels
// the old timer instead of letting it live to expiry and relying on
// the identity check (a stray timer still fires its callback once).
let autoCloseHandle: ReturnType<typeof setTimeout> | undefined

export const useWorldAnnouncementStore = defineStore('worldAnnouncement', {
  state: () => ({
    active: null as WorldAnnouncementContent | null,
  }),

  actions: {
    show(title: string, body: string, cueId: AudioCueId = 'stinger.announce') {
      // W7: every announcement lands a stinger; callers override with a
      // beat-specific cue (breakthrough, tribulation verdict, ...).
      useAudioStore().cue(cueId)

      if (autoCloseHandle !== undefined) {
        clearTimeout(autoCloseHandle)

        autoCloseHandle = undefined
      }

      this.active = { title, body }

      autoCloseHandle = setTimeout(() => {
        // Chi tu dong neu van DUNG announcement nay (nguoi choi co
        // the da dong tay hoac 1 announcement khac da de len).
        if (this.active?.title === title && this.active?.body === body) {
          this.hide()
        }
      }, AUTO_CLOSE_MS)
    },

    hide() {
      if (autoCloseHandle !== undefined) {
        clearTimeout(autoCloseHandle)

        autoCloseHandle = undefined
      }

      this.active = null
    },
  },
})
