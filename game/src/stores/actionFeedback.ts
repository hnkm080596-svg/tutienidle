import { defineStore } from 'pinia'

// Workstream A §4.3 — "Nhật ký thao tác": panel phản hồi RIÊNG cho action
// gameplay (thành công/thất bại), tách khỏi toast loot (stores/notification.ts).
// Không persist vào save — thuần runtime UX.
export type ActionFeedbackTone = 'success' | 'warning' | 'error'

export interface ActionFeedbackEntry {
  id: string

  tone: ActionFeedbackTone

  message: string

  /** Key-form entry (i18n): hiển thị qua t(messageKey, params) — message rỗng. */
  messageKey?: string

  /** Giá trị param là locale key, được t() tại điểm render (ActionFeedbackLog). */
  messageParams?: Record<string, string>

  count: number
  updatedAt: number
}

const MAX_VISIBLE_ENTRIES = 5

// Gộp message giống nhau xuất hiện trong khoảng ngắn (§3.3) — tránh spam
// khi người chơi click nhanh lặp lại một action đang thất bại.
const MERGE_WINDOW_MS = 4000

// Auto-hide (user request 2026-09-11): hide the whole log after 5s with no
// new entry. Any new entry (including a merged count bump) reopens the window.
const AUTO_HIDE_MS = 5000

type KeyPayload = { messageKey: string; messageParams?: Record<string, string> }

/** Bản sắc định danh để gộp entry: entry key-form so sánh key + params
 * (locale-independent), entry thường so sánh chuỗi message như cũ. */
function entryIdentity(entry: Pick<ActionFeedbackEntry, 'message' | 'messageKey' | 'messageParams'>): string {
  return entry.messageKey
    ? entry.messageKey + JSON.stringify(entry.messageParams ?? {})
    : entry.message
}

/** Auto-hide timer ownership lives in the store - one authority, always
 * cleared before re-arming (no leaked handles) and cleared on empty. */
function scheduleAutoHide(callback: () => void, existing: ReturnType<typeof setTimeout> | null): ReturnType<typeof setTimeout> {
  if (existing !== null) {
    clearTimeout(existing)
  }

  return setTimeout(callback, AUTO_HIDE_MS)
}

export const useActionFeedbackStore = defineStore('actionFeedback', {
  state: () => ({
    entries: [] as ActionFeedbackEntry[],
    collapsed: false,
    isVisible: false,
    autoHideTimer: null as ReturnType<typeof setTimeout> | null,
  }),

  actions: {
    push(tone: ActionFeedbackTone, message: string, keyPayload?: KeyPayload) {
      const now = Date.now()

      const last = this.entries[this.entries.length - 1]

      const identity = keyPayload
        ? entryIdentity({ message: '', ...keyPayload })
        : message

      if (last && entryIdentity(last) === identity && last.tone === tone && now - last.updatedAt <= MERGE_WINDOW_MS) {
        last.count += 1
        last.updatedAt = now
      } else {
        this.entries.push({
          id: crypto.randomUUID(),
          tone,
          message,
          messageKey: keyPayload?.messageKey,
          messageParams: keyPayload?.messageParams,
          count: 1,
          updatedAt: now,
        })

        if (this.entries.length > MAX_VISIBLE_ENTRIES) {
          this.entries.splice(0, this.entries.length - MAX_VISIBLE_ENTRIES)
        }
      }

      // Any entry/merge reopens the log and restarts the 5s window from
      // scratch. A new entry also always un-collapses the log (it should
      // be "alive" while there is activity, never left forgotten folded).
      this.isVisible = true
      this.collapsed = false
      this.autoHideTimer = scheduleAutoHide(() => {
        this.isVisible = false
        this.autoHideTimer = null
      }, this.autoHideTimer)
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

    successKey(messageKey: string, messageParams?: Record<string, string>) {
      this.push('success', '', { messageKey, messageParams })
    },

    errorKey(messageKey: string, messageParams?: Record<string, string>) {
      this.push('error', '', { messageKey, messageParams })
    },

    toggleCollapsed() {
      this.collapsed = !this.collapsed
    },

    clear() {
      this.entries = []

      if (this.autoHideTimer !== null) {
        clearTimeout(this.autoHideTimer)
        this.autoHideTimer = null
      }

      this.isVisible = false
    },
  },
})
