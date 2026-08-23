// Phase 4 Beta (Notification/UX) — sự kiện toast THUẦN, không phụ
// thuộc Vue (GameManager là plain class, dùng trực tiếp) — Vue layer
// (App.vue's tick()) rút ra qua GameManager.drainNotifications() rồi
// đẩy vào stores/notification.ts mỗi tick. Nguồn toast KHÔNG đi qua
// GameManager (upgrade/craft/save, đã ở Vue layer sẵn) gọi thẳng
// notificationStore, không cần type này.
export type NotificationKind = 'loot' | 'craft' | 'upgrade' | 'error' | 'warning' | 'save'

import type { NameSegment } from '../item/NameSegment'

export interface LootNotificationPresentation {
  icon?: string

  nameSegments: NameSegment[]

  amountLabel?: string

  accentColorVar?: string
}

export interface NotificationEvent {
  kind: NotificationKind

  message: string

  loot?: LootNotificationPresentation
}
