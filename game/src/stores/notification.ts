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

// Thời gian hiện trước khi tự gỡ — đủ đọc 1 dòng ngắn không cần thao
// tác gì, khớp phong cách "Where Winds Meet" mô tả trong tài liệu
// beta (slide in -> display -> slide out -> destroy).
const TOAST_DURATION_MS = 3500

// Audit fix 2026-08-31 — cap hàng đợi: farm AoE late-game push >10 toast/s
// trong khi drain chỉ ~1.4/s (maxVisible / 3.5s); không cap thì queue phình
// + replay stale toast hàng phút sau. Vượt cap thì BỎ toast MỚI (toast cũ đã
// chờ lâu hơn, bỏ cũ làm thứ tự loot lệch).
const MAX_QUEUED_TOASTS = 100

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    // Nhiều toast có thể hiện ĐỒNG THỜI (xếp chồng), tối đa
    // `maxVisible` cái cùng lúc — vượt mới rơi vào queuedToasts.
    toasts: [] as ToastItem[],
    queuedToasts: [] as ToastItem[],
    maxVisible: 5,
  }),

  actions: {
    // ToastContainer.vue gọi lúc mount/resize — số toast hiện cùng lúc
    // tuỳ theo chiều cao màn hình thật (Teleport to body nên thoát
    // khỏi scale transform của .game-root, xem GameRoot.vue).
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
