// Lifecycle regression (audit H3, model theo CombatScene.lifecycle.test.ts):
// ScaleManager là game-level — anonymous resize callback đăng ký mỗi
// create() KHÔNG bị gỡ bởi scene shutdown nên TÍCH TỤY qua mỗi lần
// Home ↔ Combat; events.on('shutdown') anonymous cũng tích lũy vĩnh viễn.
// create() phải dùng handler ỔN ĐỊNH + events.once để shutdown tự gỡ.
// ?raw import (vite/client types) — đọc source không cần @types/node.
import { describe, expect, it } from 'vitest'
import mainSceneSource from './MainScene.ts?raw'

describe('MainScene lifecycle — listener không tích lũy qua restart', () => {
  it('scale.on resize KHÔNG anonymous inline (phải qua named handler)', () => {
    expect(mainSceneSource).not.toMatch(/scale\.on\('resize', \(/)
  })

  it('scale.off được gọi trong shutdown path', () => {
    expect(mainSceneSource).toContain("this.scale.off('resize', this.resizeHandler)")
  })

  it('events.shutdown dùng once + KHÔNG anonymous', () => {
    expect(mainSceneSource).not.toMatch(/events\.on\('shutdown', \(\) =>/)
    expect(mainSceneSource).toContain("this.events.once('shutdown', this.shutdownHandler)")
  })

  // Audit M3b (2026-08-31) — shutdown phải null các ref scene-scoped:
  // (a) resize callback lỡ trúng giữa shutdown không mutate dead
  // GameObjects (applyBackgroundLayout đã có null guard), (b) closure
  // không giữ scene state khỏi GC qua các lần restart.
  it('shutdownHandler null các refs scene-scoped (chặn GC retention + dead-object mutation)', () => {
    const shutdownBody = mainSceneSource.match(/shutdownHandler = \(\) => \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(shutdownBody).toContain('this.skyRect = undefined')
    expect(shutdownBody).toContain('this.groundRect = undefined')
    expect(shutdownBody).toContain('this.player = undefined')
    expect(shutdownBody).toContain('this.eventBus = undefined')
  })
})
