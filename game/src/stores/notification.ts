import { defineStore } from 'pinia'
import type {
  LootNotificationPresentation,
  NotificationKind,
} from '@/core/notification/NotificationEvent'

export interface ToastItem {
  id: string

  kind: NotificationKind

  message: string

  loot?: LootNotificationPresentation
}

// Thoi gian hien truoc khi tu go - du doc 1 dong ngan khong can thao
// tac gi, khop phong cach "Where Winds Meet" mo ta trong tai lieu
// beta (slide in -> display -> slide out -> destroy).
const TOAST_DURATION_MS = 3500

// Audit fix 2026-08-31 - cap hang doi: farm AoE late-game push >10 toast/s
// trong khi drain chi ~1.4/s (maxVisible / 3.5s); khong cap thi queue phinh
// + replay stale toast hang phut sau. Vuot cap thi BO toast MOI (toast cu da
// cho lau hon, bo cu lam thu tu loot lech).
const MAX_QUEUED_TOASTS = 100

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    // Nhieu toast co the hien DONG THOI (xep chong), toi da
    // `maxVisible` cai cung luc - vuot moi roi vao queuedToasts.
    toasts: [] as ToastItem[],
    queuedToasts: [] as ToastItem[],
    maxVisible: 5,
  }),

  actions: {
    // ToastContainer.vue goi luc mount/resize - so toast hien cung luc
    // tuy theo chieu cao man hinh that (Teleport to body nen thoat
    // khoi scale transform cua .game-root, xem GameRoot.vue).
    setMaxVisible(max: number) {
      this.maxVisible = Math.max(1, max)
      this.fillFromQueue()
    },

    push(kind: NotificationKind, message: string, loot?: LootNotificationPresentation) {
      const toast: ToastItem = { id: crypto.randomUUID(), kind, message, loot }

      if (this.toasts.length >= this.maxVisible) {
        if (this.queuedToasts.length >= MAX_QUEUED_TOASTS) {
          return
        }

        this.queuedToasts.push(toast)
        return
      }

      this.show(toast)
    },

    show(toast: ToastItem) {
      this.toasts.push(toast)
      setTimeout(() => this.dismiss(toast.id), TOAST_DURATION_MS)
    },

    dismiss(id: string) {
      if (!this.toasts.some((toast) => toast.id === id)) return

      this.toasts = this.toasts.filter((toast) => toast.id !== id)
      this.fillFromQueue()
    },

    fillFromQueue() {
      while (this.toasts.length < this.maxVisible && this.queuedToasts.length > 0) {
        this.show(this.queuedToasts.shift()!)
      }
    },
  },
})
