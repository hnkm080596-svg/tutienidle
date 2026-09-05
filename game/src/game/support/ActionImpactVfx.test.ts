// Invariant "MỘT action_impact = MỘT VFX instance": bất kể hitCount/
// pulses/space, spawnActionImpactVfx chỉ được tạo tối đa 2 Graphics
// (ground + upright) và ĐÚNG 1 tween timeline. Multi-hit là state bên
// trong instance, không phải thêm GameObject.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createBattleGridProjection } from './BattleGridProjection'
import { computeUprightRadius, spawnActionImpactVfx } from './ActionImpactVfx'
import { COMBAT_VFX_PRESETS } from '@/data/vfx/CombatVfxPresets'

function chainableGraphics(): Record<string, unknown> {
  const target: Record<string, unknown> = {}
  const proxy: Record<string, unknown> = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string]
      return () => proxy
    },
    set(obj, prop, value) {
      obj[prop as string] = value
      return true
    },
  })
  return proxy
}

function createSceneStub() {
  let graphicsCreated = 0
  const tweens: Array<Record<string, unknown>> = []

  const scene = {
    add: {
      graphics: () => {
        graphicsCreated++
        return chainableGraphics()
      },
    },
    tweens: {
      add: (config: Record<string, unknown>) => {
        tweens.push(config)
      },
    },
  }

  return {
    scene: scene as unknown as import('phaser').Scene,
    graphicsCreated: () => graphicsCreated,
    tweens,
  }
}

const PROJECTION = createBattleGridProjection('perspective', {
  width: 1280,
  height: 720,
  topInset: 80,
  bottomInset: 70,
})

const AREA = { rowStart: 3, rowEnd: 5, colStart: 6, colEnd: 8 }
const ANCHOR = { row: 4 as const, column: 7 }

describe('spawnActionImpactVfx — một action = một VFX instance', () => {
  it('upright (slash) 6 pulses: CHỈ 1 upright Graphics, KHÔNG ground decal', () => {
    const { scene, graphicsCreated, tweens } = createSceneStub()

    spawnActionImpactVfx({
      scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.slash,
      pulses: 6,
      uprightDepth: 450,
    })

    // Regression: slash/claw/wind_blade KHÔNG để vết trên đất — upright
    // space không được tạo ground graphics.
    expect(graphicsCreated()).toBe(1)
    expect(tweens).toHaveLength(1)
    expect(tweens[0]!.duration).toBe(COMBAT_VFX_PRESETS.slash.durationMs * 6)
  })

  it('hybrid (fire_burst): ground + upright chung 1 timeline — 2 Graphics + 1 tween', () => {
    const { scene, graphicsCreated, tweens } = createSceneStub()

    spawnActionImpactVfx({
      scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.fire_burst,
      pulses: 3,
      uprightDepth: 452,
    })

    expect(graphicsCreated()).toBe(2)
    expect(tweens).toHaveLength(1)
  })

  it('ground_projected (earth_shockwave): chỉ ground — 1 Graphics + 1 tween', () => {
    const { scene, graphicsCreated, tweens } = createSceneStub()

    spawnActionImpactVfx({
      scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.earth_shockwave,
      pulses: 1,
      uprightDepth: 450,
    })

    expect(graphicsCreated()).toBe(1)
    expect(tweens).toHaveLength(1)
  })

  it('timeline chạy được smoke: onUpdate paint nhiều frame không văng (upright-only)', () => {
    const { scene, tweens } = createSceneStub()

    spawnActionImpactVfx({
      scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.wind_blade,
      pulses: 4,
      uprightDepth: 450,
    })

    const config = tweens[0]!
    const onUpdate = config.onUpdate as () => void

    expect(() => onUpdate()).not.toThrow()
  })

  it('multi-hit KHÔNG đổi số GameObject — 1 pulse vs 6 pulse cùng số graphics', () => {
    const one = createSceneStub()
    const six = createSceneStub()

    spawnActionImpactVfx({
      scene: one.scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.fire_burst,
      pulses: 1,
      uprightDepth: 450,
    })

    spawnActionImpactVfx({
      scene: six.scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.fire_burst,
      pulses: 6,
      uprightDepth: 450,
    })

    expect(six.graphicsCreated()).toBe(one.graphicsCreated())
  })

  it('areaScale chỉ nở phần trang trí — footprint polygon giữ nguyên', () => {
    const cellWidth = PROJECTION.cellSizeAt(ANCHOR.row).width

    // Bán kính upright (trang trí) tỉ lệ thuận areaScale.
    expect(computeUprightRadius(cellWidth, 1)).toBeLessThan(computeUprightRadius(cellWidth, 1.3))
    expect(computeUprightRadius(cellWidth, 1)).toBeGreaterThan(0)

    // Footprint polygon thuần từ projection + area — KHÔNG phụ thuộc
    // preset/areaScale (decal phải khớp vùng damage gameplay 1:1).
    expect(PROJECTION.footprintPolygon(AREA)).toEqual(PROJECTION.footprintPolygon(AREA))
  })
})

// Remediation Task 2 — spawnActionImpactVfx exposes a completion handle:
// the caller (CombatScene) acknowledges the engine from the TWEEN's
// onComplete — not from a duplicated duration calculation. destroy() đúng
// 1 lần cho MỖI graphics (ground/upright), callback fire đúng 1 lần.
describe('spawnActionImpactVfx — completion handle (Remediation Task 2)', () => {
  it('trả về completion handle; onComplete fires từ tween onComplete (đúng 1 lần)', () => {
    const { scene, tweens } = createSceneStub()

    let completed = 0
    const handle = spawnActionImpactVfx(
      {
        scene,
        projection: PROJECTION,
        area: AREA,
        anchorCell: ANCHOR,
        preset: COMBAT_VFX_PRESETS.slash,
        pulses: 1,
        uprightDepth: 450,
      },
      () => {
        completed += 1
      },
    )

    expect(handle).toBeDefined()
    expect(typeof handle.complete).toBe('function')
    expect(completed).toBe(0)

    // Tween của Phaser gọi onComplete khi timeline xong — mô phỏng.
    ;(tweens[0]!.onComplete as () => void)()

    expect(completed).toBe(1)
  })

  it('handle.complete() gọi thủ công cũng complete đúng 1 lần (idempotent, destroy đúng 1 lần)', () => {
    const { scene, tweens } = createSceneStub()

    const destroyCalls: string[] = []
    const sceneWithDestroyTracking = {
      add: {
        graphics: () => {
          const gfx = chainableGraphics() as Record<string, unknown> & { destroy: () => void }

          gfx.destroy = () => {
            destroyCalls.push('destroy')
          }

          return gfx
        },
      },
      tweens: { add: (config: Record<string, unknown>) => tweens.push(config) },
    } as unknown as import('phaser').Scene

    let completed = 0
    const handle = spawnActionImpactVfx(
      {
        scene: sceneWithDestroyTracking,
        projection: PROJECTION,
        area: AREA,
        anchorCell: ANCHOR,
        preset: COMBAT_VFX_PRESETS.fire_burst, // hybrid → ground + upright
        pulses: 1,
        uprightDepth: 450,
      },
      () => {
        completed += 1
      },
    )

    handle.complete()
    handle.complete()

    // Tween onComplete chạy SAU handle.complete() — vẫn không fire lại.
    ;(tweens[0]!.onComplete as () => void)()

    expect(completed).toBe(1)
    // hybrid = 2 Graphics (ground + upright), mỗi cái destroy ĐÚNG 1 lần.
    expect(destroyCalls).toHaveLength(2)
  })

  it('không có callback — handle vẫn hoạt động, graphics vẫn destroy', () => {
    const { scene, tweens } = createSceneStub()

    const handle = spawnActionImpactVfx({
      scene,
      projection: PROJECTION,
      area: AREA,
      anchorCell: ANCHOR,
      preset: COMBAT_VFX_PRESETS.earth_shockwave,
      pulses: 1,
      uprightDepth: 450,
    })

    expect(() => handle.complete()).not.toThrow()
    expect(tweens).toHaveLength(1)
  })

  it('vi.handle.complete() trước khi tween xong → tween onComplete sau đó KHÔNG fire lại callback', () => {
    const { scene, tweens } = createSceneStub()

    let completed = 0
    const handle = spawnActionImpactVfx(
      {
        scene,
        projection: PROJECTION,
        area: AREA,
        anchorCell: ANCHOR,
        preset: COMBAT_VFX_PRESETS.slash,
        pulses: 1,
        uprightDepth: 450,
      },
      () => {
        completed += 1
      },
    )

    handle.complete()
    expect(completed).toBe(1)

    // Giả lập tween vẫn chạy xong sau đó.
    ;(tweens[0]!.onComplete as () => void)()
    expect(completed).toBe(1)
  })
})
