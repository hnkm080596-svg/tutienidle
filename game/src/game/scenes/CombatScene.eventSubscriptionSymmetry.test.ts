// OPT-09 (roadmap.md §8.3) — subscribeCombatEvents/unsubscribeCombatEvents
// từng liệt kê 10 entry trong `boundHandlers` + 14 dòng eventBus.on/off thủ
// công song song. Rủi ro: thêm event vào on() mà quên off() (hoặc ngược
// lại) không có gì báo lỗi. Test này khóa bất biến "mọi event subscribe
// phải được unsubscribe đối xứng" độc lập với cách cài đặt bên trong.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'

function createSceneWithFakeEventBus() {
  const scene = Object.create(CombatScene.prototype) as any

  const counts = new Map<string, number>()
  const eventBus = {
    on: vi.fn((eventType: string) => {
      counts.set(eventType, (counts.get(eventType) ?? 0) + 1)
    }),
    off: vi.fn((eventType: string) => {
      counts.set(eventType, (counts.get(eventType) ?? 0) - 1)
    }),
  }

  scene.registry = { get: (key: string) => (key === 'eventBus' ? eventBus : undefined) }

  return { scene, eventBus, counts }
}

describe('CombatScene — combat event subscription đối xứng (OPT-09)', () => {
  it('mỗi event subscribe đúng 1 lần; sau unsubscribe toàn bộ về 0', () => {
    const { scene, counts } = createSceneWithFakeEventBus()

    scene.subscribeCombatEvents()

    const subscribedEvents = [...counts.keys()]

    expect(subscribedEvents.length).toBeGreaterThan(0)
    for (const eventType of subscribedEvents) {
      expect(counts.get(eventType)).toBe(1)
    }

    scene.unsubscribeCombatEvents()

    for (const eventType of subscribedEvents) {
      expect(counts.get(eventType)).toBe(0)
    }
  })

  it('on() và off() được gọi cùng số lần cho mỗi event (không lệch danh sách)', () => {
    const { scene, eventBus } = createSceneWithFakeEventBus()

    scene.subscribeCombatEvents()
    scene.unsubscribeCombatEvents()

    const onEvents = eventBus.on.mock.calls.map((call: unknown[]) => call[0]).sort()
    const offEvents = eventBus.off.mock.calls.map((call: unknown[]) => call[0]).sort()

    expect(offEvents).toEqual(onEvents)
  })

  it('unsubscribe khi chưa từng subscribe không throw', () => {
    const { scene } = createSceneWithFakeEventBus()

    expect(() => scene.unsubscribeCombatEvents()).not.toThrow()
  })

  it('gọi unsubscribe hai lần liên tiếp không throw và không off() lần hai', () => {
    const { scene, eventBus } = createSceneWithFakeEventBus()

    scene.subscribeCombatEvents()
    scene.unsubscribeCombatEvents()
    const offCallsAfterFirst = eventBus.off.mock.calls.length

    expect(() => scene.unsubscribeCombatEvents()).not.toThrow()
    expect(eventBus.off.mock.calls.length).toBe(offCallsAfterFirst)
  })
})
