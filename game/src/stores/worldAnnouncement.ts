import { defineStore } from 'pinia'

export interface WorldAnnouncementContent {
  title: string

  body: string
}

// Thời gian tự đóng nếu người chơi không bấm gì — đủ đọc xong 1 dòng
// title + 1 dòng body (khớp mockup mục XIII tài liệu beta).
const AUTO_CLOSE_MS = 5000

// Handle cho auto-close timer — tracked để show()/hide() huỷ timer
// cũ thay vì để nó sống tới hạn rồi nhờ identity check (timer dư vẫn
// đếm và fire callback một lần nữa).
let autoCloseHandle: ReturnType<typeof setTimeout> | undefined

export const useWorldAnnouncementStore = defineStore('worldAnnouncement', {
  state: () => ({
    active: null as WorldAnnouncementContent | null,
  }),

  actions: {
    show(title: string, body: string) {
      if (autoCloseHandle !== undefined) {
        clearTimeout(autoCloseHandle)

        autoCloseHandle = undefined
      }

      this.active = { title, body }

      autoCloseHandle = setTimeout(() => {
        // Chỉ tự đóng nếu vẫn ĐÚNG announcement này (người chơi có
        // thể đã đóng tay hoặc 1 announcement khác đã đè lên).
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
