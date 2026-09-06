import type { NotificationEvent } from './NotificationEvent'

// Task A6 (roadmap 9.8) — toast tràn MaterialBag: bag.add() clamp tại
// stackLimit và trả lượng bị MẤT; mọi caller đường reward push event
// này thay vì mất lặng lẽ. message vi là fallback, App.vue render qua
// t('bag.overflow', params) khi locale có key.
export function createBagOverflowEvent(
  materialName: string,
  lostAmount: number,
): NotificationEvent {
  return {
    kind: 'warning',

    message: `Túi đầy — mất ${lostAmount} ${materialName}`,

    messageKey: 'bag.overflow',

    messageParams: {
      amount: String(lostAmount),

      name: materialName,
    },
  }
}
