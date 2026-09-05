// OPT-09 (roadmap.md Â§8.3) â€” subscribeCombatEvents/unsubscribeCombatEvents
// tá»«ng liá»‡t kÃª 10 entry trong `boundHandlers` + 14 dÃ²ng eventBus.on/off thá»§
// cÃ´ng song song. Rá»§i ro: thÃªm event vÃ o on() mÃ  quÃªn off() (hoáº·c ngÆ°á»£c
// láº¡i) khÃ´ng cÃ³ gÃ¬ bÃ¡o lá»—i. Test nÃ y khÃ³a báº¥t biáº¿n "má»i event subscribe
// pháº£i Ä‘Æ°á»£c unsubscribe Ä‘á»‘i xá»©ng" Ä‘á»™c láº­p vá»›i cÃ¡ch cÃ i Ä‘áº·t bÃªn trong.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'

function createSceneWithFakeEventBus() {
  const scene = createTestScene('bare')

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

describe('CombatScene â€” combat event subscription Ä‘á»‘i xá»©ng (OPT-09)', () => {
  it('má»—i event subscribe Ä‘Ãºng 1 láº§n; sau unsubscribe toÃ n bá»™ vá» 0', () => {
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

  it('on() vÃ  off() Ä‘Æ°á»£c gá»i cÃ¹ng sá»‘ láº§n cho má»—i event (khÃ´ng lá»‡ch danh sÃ¡ch)', () => {
    const { scene, eventBus } = createSceneWithFakeEventBus()

    scene.subscribeCombatEvents()
    scene.unsubscribeCombatEvents()

    const onEvents = eventBus.on.mock.calls.map((call: unknown[]) => call[0]).sort()
    const offEvents = eventBus.off.mock.calls.map((call: unknown[]) => call[0]).sort()

    expect(offEvents).toEqual(onEvents)
  })

  it('unsubscribe khi chÆ°a tá»«ng subscribe khÃ´ng throw', () => {
    const { scene } = createSceneWithFakeEventBus()

    expect(() => scene.unsubscribeCombatEvents()).not.toThrow()
  })

  it('gá»i unsubscribe hai láº§n liÃªn tiáº¿p khÃ´ng throw vÃ  khÃ´ng off() láº§n hai', () => {
    const { scene, eventBus } = createSceneWithFakeEventBus()

    scene.subscribeCombatEvents()
    scene.unsubscribeCombatEvents()
    const offCallsAfterFirst = eventBus.off.mock.calls.length

    expect(() => scene.unsubscribeCombatEvents()).not.toThrow()
    expect(eventBus.off.mock.calls.length).toBe(offCallsAfterFirst)
  })
})
