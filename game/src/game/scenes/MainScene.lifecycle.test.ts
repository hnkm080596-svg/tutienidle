// Lifecycle regression (audit H3, model theo CombatScene.lifecycle.test.ts):
// ScaleManager la game-level - anonymous resize callback dang ky moi
// create() KHONG bi go boi scene shutdown nen TICH TUY qua moi lan
// Home <-> Combat; events.on('shutdown') anonymous cung tich luy vinh vien.
// create() phai dung handler ON DINH + events.once de shutdown tu go.
// ?raw import (vite/client types) - doc source khong can @types/node.
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

  // Audit M3b (2026-08-31) - shutdown phai null cac ref scene-scoped:
  // (a) resize callback lo trung giua shutdown khong mutate dead
  // GameObjects (applyBackgroundLayout da co null guard), (b) closure
  // khong giu scene state khoi GC qua cac lan restart.
  it('shutdownHandler null các refs scene-scoped (chặn GC retention + dead-object mutation)', () => {
    const shutdownBody = mainSceneSource.match(/shutdownHandler = \(\) => \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(shutdownBody).toContain('this.skyRect = undefined')
    expect(shutdownBody).toContain('this.groundRect = undefined')
    expect(shutdownBody).toContain('this.player = undefined')
    expect(shutdownBody).toContain('this.eventBus = undefined')
  })
})
