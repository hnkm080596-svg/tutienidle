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

export interface ChatLogLootSegment {
  name: string
  count: number
  amountLabel?: string
  icon?: string
  nameColorVar?: string
  nameTone?: string
  gradeLabel?: string
}

export interface ChatLogEntry {
  id: string
  kind: NotificationKind
  message: string
  timestampMs: number
  lootItems: ChatLogLootSegment[]
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
const MAX_LOG_ENTRIES = 60
const COALESCE_WINDOW_MS = 120

function parseAmountCount(amountLabel?: string): number {
  if (!amountLabel) return 1
  const digits = amountLabel.replace(/[^\d]/g, '')
  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function formatLootSegmentsMessage(segments: ChatLogLootSegment[]): string {
  return segments
    .map((seg) => `${seg.name}${seg.count > 1 ? ` ×${seg.count}` : seg.amountLabel ? ` ${seg.amountLabel}` : ''}`)
    .join(', ')
}

function mergeLootIntoSegments(
  segments: ChatLogLootSegment[],
  loot: LootNotificationPresentation,
): void {
  const addCount = parseAmountCount(loot.amountLabel)
  const existing = segments.find(
    (seg) => seg.name === loot.name && seg.gradeLabel === loot.gradeLabel,
  )
  if (existing) {
    existing.count += addCount
    existing.amountLabel = `×${existing.count}`
    return
  }
  segments.push({
    name: loot.name,
    count: addCount,
    amountLabel: loot.amountLabel ?? (addCount > 1 ? `×${addCount}` : undefined),
    icon: loot.icon,
    nameColorVar: loot.nameColorVar,
    nameTone: loot.nameTone,
    gradeLabel: loot.gradeLabel,
  })
}

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    // Nhieu toast co the hien DONG THOI (xep chong), toi da
    // `maxVisible` cai cung luc - vuot moi roi vao queuedToasts.
    toasts: [] as ToastItem[],
    queuedToasts: [] as ToastItem[],
    maxVisible: 5,
    logEntries: [] as ChatLogEntry[],
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

      this.recordLogEntry(kind, message, loot)

      if (this.toasts.length >= this.maxVisible) {
        if (this.queuedToasts.length >= MAX_QUEUED_TOASTS) {
          return
        }

        this.queuedToasts.push(toast)
        return
      }

      this.show(toast)
    },

    /**
     * Aggregates all notifications from a single tick/instance (e.g. battle
     * victory drops, harvest, quest claim, batch decompose, offline summary)
     * so loot from the same instance becomes a single combined entry in the
     * Dong Fu activity chatbox instead of spamming multiple popups.
     */
    pushInstanceBatch(
      events: ReadonlyArray<{
        kind: NotificationKind
        message: string
        loot?: LootNotificationPresentation
      }>,
    ) {
      if (events.length === 0) return

      const lootEvents = events.filter((e) => e.kind === 'loot' && e.loot !== undefined)
      const otherEvents = events.filter((e) => !(e.kind === 'loot' && e.loot !== undefined))

      if (lootEvents.length > 0) {
        const segments: ChatLogLootSegment[] = []
        for (const ev of lootEvents) {
          if (ev.loot) {
            mergeLootIntoSegments(segments, ev.loot)
          }
        }
        const combinedMessage = formatLootSegmentsMessage(segments)
        const nowMs = Date.now()
        this.appendLogEntry({
          id: crypto.randomUUID(),
          kind: 'loot',
          message: combinedMessage,
          timestampMs: nowMs,
          lootItems: segments,
        })
      }

      for (const ev of otherEvents) {
        this.recordLogEntry(ev.kind, ev.message, ev.loot, true)
      }
    },

    recordLogEntry(
      kind: NotificationKind,
      message: string,
      loot?: LootNotificationPresentation,
      forceNew = false,
    ) {
      const nowMs = Date.now()
      const last = this.logEntries[this.logEntries.length - 1]

      if (
        !forceNew &&
        kind === 'loot' &&
        loot &&
        last &&
        last.kind === 'loot' &&
        nowMs - last.timestampMs <= COALESCE_WINDOW_MS
      ) {
        mergeLootIntoSegments(last.lootItems, loot)
        last.message = formatLootSegmentsMessage(last.lootItems)
        last.timestampMs = nowMs
        return
      }

      const segments: ChatLogLootSegment[] = []
      if (loot) {
        mergeLootIntoSegments(segments, loot)
      }

      this.appendLogEntry({
        id: crypto.randomUUID(),
        kind,
        message: segments.length > 0 ? formatLootSegmentsMessage(segments) : message,
        timestampMs: nowMs,
        lootItems: segments,
      })
    },

    appendLogEntry(entry: ChatLogEntry) {
      this.logEntries.push(entry)
      if (this.logEntries.length > MAX_LOG_ENTRIES) {
        this.logEntries.splice(0, this.logEntries.length - MAX_LOG_ENTRIES)
      }
    },

    clearLog() {
      this.logEntries = []
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
