import type { NotificationEvent } from '../notification/NotificationEvent'

// Hàng đợi toast phát sinh TRONG core (loot từ BattleLootSystem, upgrade
// skill từ SkillSystem callback) — GameManager là plain class không phụ
// thuộc Vue, Vue layer (App.vue's tick()) tự rút ra mỗi tick qua
// GameManager.drainNotifications() rồi đẩy vào stores/notification.ts.
// Nguồn toast khác (upgrade/craft/save) đã ở Vue layer sẵn, gọi thẳng
// store, không qua hàng đợi này.
export class NotificationQueue {
  private items: NotificationEvent[] = []

  push(event: NotificationEvent): void {
    this.items.push(event)
  }

  drain(): NotificationEvent[] {
    const drained = this.items

    this.items = []

    return drained
  }
}
