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

  // Audit fix 2026-08-31 — farm AoE late-game push >10 toast/s trong khi
  // drain chỉ ~1.4/s (maxVisible / 3.5s); không cap thì queue phình nghìn
  // toast stale và replay hàng phút sau.
  it('queuedToasts có cap — push vượt 100 vào queue bị bỏ, không tích vô hạn', () => {
    const notification = useNotificationStore()

    // maxVisible mặc định 5 → 5 toast đầu visible, 145 push sau vào queue,
    // chỉ 100 đầu được giữ.
    for (let i = 0; i < 150; i++) {
      notification.push('save', `msg ${i}`)
    }

    expect(notification.queuedToasts.length).toBe(100)
  })

  it('toast bị bỏ vì vượt cap là toast MỚI — toast cũ đã chờ lâu hơn được giữ', () => {
    const notification = useNotificationStore()
    notification.setMaxVisible(1)

    notification.push('loot', 'A')

    for (let i = 0; i < 120; i++) {
      notification.push('save', `msg ${i}`)
    }

    // Queue giữ "msg 0" (toast queue đầu tiên) — bỏ "msg 119" (mới nhất).
    const messages = notification.queuedToasts.map((toast) => toast.message)
    expect(messages).toHaveLength(100)
    expect(messages[0]).toBe('msg 0')
    expect(messages).not.toContain('msg 119')
  })
})
