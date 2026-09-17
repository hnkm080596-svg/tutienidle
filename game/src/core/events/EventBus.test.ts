import { describe, expect, it, vi } from 'vitest'
import { EventBus } from './EventBus'

describe('EventBus — on/emit/off round trip', () => {
  it('on + emit gọi handler với đúng payload', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('damage', handler)
    bus.emit('damage', { amount: 42 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ amount: 42 })
  })

  it('off gỡ đúng handler — không còn được gọi sau off', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('loot', handler)
    bus.off('loot', handler)
    bus.emit('loot', { itemId: 'x' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('off chỉ gỡ handler chỉ định, handler khác cùng event vẫn chạy', () => {
    const bus = new EventBus()
    const removed = vi.fn()
    const kept = vi.fn()

    bus.on('heal', removed)
    bus.on('heal', kept)
    bus.off('heal', removed)
    bus.emit('heal', 10)

    expect(removed).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledTimes(1)
  })

  it('nhiều handler trên cùng event đều được gọi', () => {
    const bus = new EventBus()
    const first = vi.fn()
    const second = vi.fn()

    bus.on('cast', first)
    bus.on('cast', second)
    bus.emit('cast', 'tram')

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('emit khi không có listener là no-op an toàn, không throw', () => {
    const bus = new EventBus()

    expect(() => bus.emit('nonexistent', {})).not.toThrow()
  })

  it('emit khi event chưa từng on (sau khi handler đã off hết) không throw', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('expire', handler)
    bus.off('expire', handler)

    expect(() => bus.emit('expire', 'old')).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('cùng 1 handler đăng ký 2 lần chỉ được gọi 1 lần (Set dedupe)', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('stack', handler)
    bus.on('stack', handler)
    bus.emit('stack', 1)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('event type khác nhau không ảnh hưởng nhau', () => {
    const bus = new EventBus()
    const a = vi.fn()
    const b = vi.fn()

    bus.on('damage', a)
    bus.on('heal', b)
    bus.emit('damage', 1)

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('clear gỡ toàn bộ handler', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('regen', handler)
    bus.clear()
    bus.emit('regen', 1)

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('EventBus — dispatch isolation (audit T5-49)', () => {
  it('a throwing handler does not abort remaining handlers and does not propagate', () => {
    const bus = new EventBus()
    const after = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    bus.on('damage', () => { throw new Error('listener bug') })
    bus.on('damage', after)

    expect(() => bus.emit('damage', { amount: 1 })).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  it('a handler added during dispatch does not fire in the current emit', () => {
    const bus = new EventBus()
    const late = vi.fn()

    bus.on('loot', () => bus.on('loot', late))
    bus.emit('loot', { itemId: 'x' })

    expect(late).not.toHaveBeenCalled()

    bus.emit('loot', { itemId: 'y' })
    expect(late).toHaveBeenCalledTimes(1) // fires from the NEXT emit
  })

  it('a handler removed during dispatch still ran if already snapshotted', () => {
    const bus = new EventBus()
    const removed = vi.fn()
    const first = vi.fn(() => bus.off('tick', removed))

    bus.on('tick', first)
    bus.on('tick', removed)
    bus.emit('tick', 1)

    expect(removed).toHaveBeenCalledTimes(1)
    bus.emit('tick', 2)
    expect(removed).toHaveBeenCalledTimes(1)
  })
})
