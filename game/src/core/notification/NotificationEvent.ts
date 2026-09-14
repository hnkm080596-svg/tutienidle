// Phase 4 Beta (Notification/UX) — sự kiện toast THUẦN, không phụ
// thuộc Vue (GameManager là plain class, dùng trực tiếp) — Vue layer
// (App.vue's tick()) rút ra qua GameManager.drainNotifications() rồi
// đẩy vào stores/notification.ts mỗi tick. Nguồn toast KHÔNG đi qua
// GameManager (upgrade/craft/save, đã ở Vue layer sẵn) gọi thẳng
// notificationStore, không cần type này.
export type NotificationKind = 'loot' | 'craft' | 'upgrade' | 'error' | 'warning' | 'save'

export interface LootNotificationPresentation {
  icon?: string

  // Composed display name, single color (item-info-card spec section 2).
  name: string

  nameColorVar?: string

  // 'tien' => rainbow (max-rank gradient).
  nameTone?: string

  // Muted middle-dot "{grade}" suffix after the name (e.g. ". Ngu Pham").
  gradeLabel?: string

  amountLabel?: string

  accentColorVar?: string
}

export interface NotificationEvent {
  kind: NotificationKind

  message: string

  // i18n (9.8) — key + params để App.vue render qua t(); message vi
  // ở trên là fallback khi key chưa có trong locale.
  messageKey?: string

  messageParams?: Record<string, string>

  loot?: LootNotificationPresentation
}
