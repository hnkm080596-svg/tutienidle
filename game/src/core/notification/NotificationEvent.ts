// Phase 4 Beta (Notification/UX) - su kien toast THUAN, khong phu
// thuoc Vue (GameManager la plain class, dung truc tiep) - Vue layer
// (App.vue's tick()) rut ra qua GameManager.drainNotifications() roi
// day vao stores/notification.ts moi tick. Nguon toast KHONG di qua
// GameManager (upgrade/craft/save, da o Vue layer san) goi thang
// notificationStore, khong can type nay.
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

  // i18n (9.8) - key + params de App.vue render qua t(); message vi
  // o tren la fallback khi key chua co trong locale.
  messageKey?: string

  messageParams?: Record<string, string>

  loot?: LootNotificationPresentation
}
