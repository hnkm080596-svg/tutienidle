import type { NotificationEvent } from './NotificationEvent'

// Task A6 (roadmap 9.8) - toast tran MaterialBag: bag.add() clamp tai
// stackLimit va tra luong bi MAT; moi caller duong reward push event
// nay thay vi mat lang le. message vi la fallback, App.vue render qua
// t('bag.overflow', params) khi locale co key.
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
