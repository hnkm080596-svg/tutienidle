import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationStore } from './notification'

describe('notification queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('hiện đồng thời nhiều toast trong giới hạn maxVisible, vượt mới vào hàng đợi', () => {
    const notification = useNotificationStore()
    notification.setMaxVisible(2)

    notification.push('loot', 'A')
    notification.push('loot', 'B')
    notification.push('loot', 'C')

    expect(notification.toasts.map((toast) => toast.message)).toEqual(['A', 'B'])
    expect(notification.queuedToasts.map((toast) => toast.message)).toEqual(['C'])
  })

  it('gỡ 1 toast lấp đầy ngay bằng toast kế tiếp trong hàng đợi', () => {
    const notification = useNotificationStore()
    notification.setMaxVisible(2)

    notification.push('loot', 'A')
    notification.push('loot', 'B')
    notification.push('loot', 'C')

    notification.dismiss(notification.toasts[0]!.id)

    expect(notification.toasts.map((toast) => toast.message)).toEqual(['B', 'C'])
    expect(notification.queuedToasts).toEqual([])
  })

  it('tự động gỡ sau khi hết thời gian hiển thị', () => {
    const notification = useNotificationStore()
    notification.setMaxVisible(3)

    notification.push('loot', 'A')
    expect(notification.toasts).toHaveLength(1)

    vi.advanceTimersByTime(3500)

    expect(notification.toasts).toEqual([])
  })

  it('tăng maxVisible lúc resize lấp đầy ngay từ hàng đợi', () => {
    const notification = useNotificationStore()
    notification.setMaxVisible(1)

    notification.push('loot', 'A')
    notification.push('loot', 'B')

    expect(notification.toasts.map((toast) => toast.message)).toEqual(['A'])
    expect(notification.queuedToasts.map((toast) => toast.message)).toEqual(['B'])

    notification.setMaxVisible(2)

    expect(notification.toasts.map((toast) => toast.message)).toEqual(['A', 'B'])
    expect(notification.queuedToasts).toEqual([])
  })
})
