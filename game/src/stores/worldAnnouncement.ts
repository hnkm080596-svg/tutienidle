import { defineStore } from 'pinia'
import { AudioManager } from '@/core/audio/AudioManager'
import type { AudioCueId } from '@/core/audio/AudioCueManifest'

export interface WorldAnnouncementContent {
  title: string

  body: string
}

// Thoi gian tu ong neu nguoi choi khong bam gi - u oc xong 1 dong
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
      AudioManager.getInstance().playCue(cueId)

      if (autoCloseHandle !== undefined) {
        clearTimeout(autoCloseHandle)

        autoCloseHandle = undefined
      }

      this.active = { title, body }

      autoCloseHandle = setTimeout(() => {
        // Chi tu ong neu van UNG announcement nay (nguoi choi co
        // the a ong tay hoac 1 announcement khac a e len).
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
