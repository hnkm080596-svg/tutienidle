import type { NotificationEvent } from '../notification/NotificationEvent'

// Hang doi toast phat sinh TRONG core (loot tu BattleLootSystem, upgrade
// skill tu SkillSystem callback) - GameManager la plain class khong phu
// thuoc Vue, Vue layer (App.vue's tick()) tu rut ra moi tick qua
// GameManager.drainNotifications() roi day vao stores/notification.ts.
// Nguon toast khac (upgrade/craft/save) da o Vue layer san, goi thang
// store, khong qua hang doi nay.
// Hang rong dung chung - drain() tren queue rong (duong pho bien nhat
// moi tick khi khong co loot/toast) tra ve hang so nay thay vi alloc
// mang [] moi moi lan goi vo ich.
const EMPTY_EVENTS: NotificationEvent[] = Object.freeze([]) as unknown as NotificationEvent[]

export class NotificationQueue {
  private items: NotificationEvent[] = []

  push(event: NotificationEvent): void {
    this.items.push(event)
  }

  drain(): NotificationEvent[] {
    if (this.items.length === 0) {
      return EMPTY_EVENTS
    }

    const drained = this.items

    this.items = []

    return drained
  }
}
