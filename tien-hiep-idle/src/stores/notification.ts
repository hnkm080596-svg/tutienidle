import { defineStore } from 'pinia'
import type { NotificationKind } from '@/core/notification/NotificationEvent'

export interface ToastItem {
  id: string

  kind: NotificationKind

  message: string
}

// Thời gian hiện trước khi tự gỡ — đủ đọc 1 dòng ngắn không cần thao
// tác gì, khớp phong cách "Where Winds Meet" mô tả trong tài liệu
// beta (slide in -> display -> slide out -> destroy).
const TOAST_DURATION_MS = 3500

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    toasts: [] as ToastItem[],
  }),

  actions: {
    push(kind: NotificationKind, message: string) {
      const id = crypto.randomUUID()

      this.toasts.push({ id, kind, message })

      setTimeout(() => this.dismiss(id), TOAST_DURATION_MS)
    },

    dismiss(id: string) {
      this.toasts = this.toasts.filter(toast => toast.id !== id)
    },
  },
})
