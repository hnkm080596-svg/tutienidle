import { describe, expect, it } from 'vitest'
import { NotificationQueue } from './NotificationQueue'
import type { NotificationEvent } from '../notification/NotificationEvent'

// Hàng đợi toast trong core — drain kiểu "rút hết và xoá" để App.vue's
// tick() đẩy lên store mỗi frame (xem NotificationQueue.ts's ghi chú).

function lootEvent(itemId: string): NotificationEvent {
  return { kind: 'loot', message: `Nhặt được ${itemId}` }
}

describe('NotificationQueue — push/drain', () => {
  it('push lưu event với đúng payload, drain trả về theo thứ tự FIFO', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))
    queue.push({ kind: 'craft', message: 'Luyện đan thành công' })

    const drained = queue.drain()

    expect(drained).toHaveLength(2)
    expect(drained[0]).toEqual({ kind: 'loot', message: 'Nhặt được a' })
    expect(drained[1]!.kind).toBe('craft')
  })

  it('drain xoá sạch hàng đợi — drain lần 2 trả về mảng rỗng', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))

    expect(queue.drain()).toHaveLength(1)
    expect(queue.drain()).toEqual([])
  })

  it('drain trên hàng đợi rỗng trả về mảng rỗng, không throw', () => {
    const queue = new NotificationQueue()

    expect(queue.drain()).toEqual([])
  })

  it('push sau drain tích luỹ lại bình thường', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))
    queue.drain()
    queue.push(lootEvent('b'))

    const drained = queue.drain()

    expect(drained).toHaveLength(1)
    expect(drained[0]).toEqual({ kind: 'loot', message: 'Nhặt được b' })
  })

  it('drain trả về array độc lập — đẩy event sau drain không mutating kết quả cũ', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))

    const drained = queue.drain()

    queue.push(lootEvent('b'))

    expect(drained).toHaveLength(1)
  })

  it('không cap/dedupe — trùng message vẫn giữ nguyên từng bản (test hành vi thật)', () => {
    const queue = new NotificationQueue()

    queue.push(lootEvent('a'))
    queue.push(lootEvent('a'))

    expect(queue.drain()).toHaveLength(2)
  })

  it('giữ nguyên loot presentation payload khi qua queue', () => {
    const queue = new NotificationQueue()
    const event: NotificationEvent = {
      kind: 'loot',
      message: 'Hạ gục Quỷ Lang',
      loot: {
        icon: '/icons/sword.png',
        nameSegments: [{ text: 'Kiểm Đao' }],
        amountLabel: 'x1',
      },
    }

    queue.push(event)

    expect(queue.drain()[0]!.loot).toEqual({
      icon: '/icons/sword.png',
      nameSegments: [{ text: 'Kiểm Đao' }],
      amountLabel: 'x1',
    })
  })
})
