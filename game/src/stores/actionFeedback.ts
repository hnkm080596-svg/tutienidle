import { defineStore } from 'pinia'

// Workstream A §4.3 — "Nhật ký thao tác": panel phản hồi RIÊNG cho action
// gameplay (thành công/thất bại), tách khỏi toast loot (stores/notification.ts).
// Không persist vào save — thuần runtime UX.
export type ActionFeedbackTone = 'success' | 'warning' | 'error'

export interface ActionFeedbackEntry {
  id: string

  tone: ActionFeedbackTone

  message: string

  count: number

  updatedAt: number
}

const MAX_VISIBLE_ENTRIES = 5

// Gộp message giống nhau xuất hiện trong khoảng ngắn (§3.3) — tránh spam
// khi người chơi click nhanh lặp lại một action đang thất bại.
const MERGE_WINDOW_MS = 4000

export const useActionFeedbackStore = defineStore('actionFeedback', {
  state: () => ({
    entries: [] as ActionFeedbackEntry[],
    collapsed: false,
  }),

  actions: {
    push(tone: ActionFeedbackTone, message: string) {
      const now = Date.now()

      const last = this.entries[this.entries.length - 1]

      if (last && last.message === message && last.tone === tone && now - last.updatedAt <= MERGE_WINDOW_MS) {
        last.count += 1
        last.updatedAt = now
        return
      }

      this.entries.push({
        id: crypto.randomUUID(),
        tone,
        message,
        count: 1,
        updatedAt: now,
      })

      if (this.entries.length > MAX_VISIBLE_ENTRIES) {
        this.entries.splice(0, this.entries.length - MAX_VISIBLE_ENTRIES)
      }
    },

    success(message: string) {
      this.push('success', message)
    },

    warning(message: string) {
      this.push('warning', message)
    },

    error(message: string) {
      this.push('error', message)
    },

    toggleCollapsed() {
      this.collapsed = !this.collapsed
    },

    clear() {
      this.entries = []
    },
  },
})
