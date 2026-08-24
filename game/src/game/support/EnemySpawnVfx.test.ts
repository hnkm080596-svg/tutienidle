// EnemySpawnVfx — MỘT pending spawn = MỘT handle instance (2 Graphics:
// ground pháp trận + cột linh khí), update() theo progress snapshot,
// complete() flash rồi tự dọn, destroy() dọn NGAY; toạ độ vẽ lấy từ
// projection.gridToScreen (đúng phối cảnh cả hàng gần lẫn hàng xa).
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import Phaser from 'phaser'
import { createBattleGridProjection } from './BattleGridProjection'
import { spawnEnemySpawnVfx, type EnemySpawnVfxParams } from './EnemySpawnVfx'

type RecordingGraphics = Record<string, unknown> & {
  __calls: Array<{ method: string; args: unknown[] }>
}

function createRecordingGraphics(): RecordingGraphics {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_obj, prop: string) {
        if (prop === '__calls') {
          return calls
        }

        return (...args: unknown[]) => {
          calls.push({ method: prop, args })
          return proxy
        }
      },
    },
  )

  return proxy as RecordingGraphics
}

function createSceneStub() {
  const graphicsList: RecordingGraphics[] = []
  const tweens: Array<Record<string, unknown>> = []

  const scene = {
    add: {
      graphics: () => {
        const gfx = createRecordingGraphics()

        graphicsList.push(gfx)

        return gfx
      },
    },
    tweens: {
      add: (config: Record<string, unknown>) => {
        tweens.push(config)
      },
    },
  }

  return { scene: scene as unknown as Phaser.Scene, graphicsList, tweens }
}

function createParams(scene: Phaser.Scene, row: number, column: number): EnemySpawnVfxParams {
  return {
    scene,
    projection: createBattleGridProjection('perspective', {
      width: 1280,
      height: 720,
      topInset: 80,
      bottomInset: 70,
    }),
    row,
    column,
    presetId: 'enemy_spawn',
    uprightDepth: 450,
  }
}

describe('spawnEnemySpawnVfx', () => {
  it('một pending spawn = đúng 2 Graphics (ground + upright cột linh khí)', () => {
    const { scene, graphicsList } = createSceneStub()

    const handle = spawnEnemySpawnVfx(createParams(scene, 4, 8))

    expect(graphicsList).toHaveLength(2)

    handle.destroy()
  })

  it('update(progress) repaint — toạ độ ellipse khớp projection.gridToScreen của ô', () => {
    const { scene, graphicsList } = createSceneStub()
    const projection = createBattleGridProjection('perspective', {
      width: 1280,
      height: 720,
      topInset: 80,
      bottomInset: 70,
    })

    const handle = spawnEnemySpawnVfx(createParams(scene, 4, 8))

    graphicsList[0]!.__calls.length = 0
    handle.update(0.5)

    const anchor = projection.gridToScreen(4, 8)
    const ellipseCall = graphicsList[0]!.__calls.find((call) => call.method === 'strokeEllipse')

    expect(ellipseCall).toBeDefined()
    expect(ellipseCall!.args[0]).toBeCloseTo(anchor.x, 6)
    expect(ellipseCall!.args[1]).toBeCloseTo(anchor.y, 6)

    handle.destroy()
  })

  it('hàng gần vs hàng XA: cùng column nhưng toạ độ vẽ khác nhau (đúng phối cảnh)', () => {
    const near = createSceneStub()
    const far = createSceneStub()

    const nearHandle = spawnEnemySpawnVfx(createParams(near.scene, 9, 8))
    const farHandle = spawnEnemySpawnVfx(createParams(far.scene, 0, 8))

    for (const gfx of near.graphicsList) {
      gfx.__calls.length = 0
    }

    for (const gfx of far.graphicsList) {
      gfx.__calls.length = 0
    }

    nearHandle.update(0.5)
    farHandle.update(0.5)

    const nearEllipse = near.graphicsList[0]!.__calls.find(
      (call) => call.method === 'strokeEllipse',
    )
    const farEllipse = far.graphicsList[0]!.__calls.find((call) => call.method === 'strokeEllipse')

    expect(nearEllipse!.args[1]).toBeGreaterThan(farEllipse!.args[1] as number)
    expect(nearEllipse!.args[2]).toBeGreaterThan(farEllipse!.args[2] as number)
  })

  it('complete(): flash qua ĐÚNG 1 tween rồi tự destroy cả 2 Graphics', () => {
    const { scene, graphicsList, tweens } = createSceneStub()

    const handle = spawnEnemySpawnVfx(createParams(scene, 4, 8))

    handle.complete()

    expect(tweens).toHaveLength(1)

    const config = tweens[0]!
    const onComplete = config.onComplete as () => void

    onComplete()

    const destroyCalls = graphicsList.filter((gfx) =>
      gfx.__calls.some((call) => call.method === 'destroy'),
    )

    expect(destroyCalls).toHaveLength(2)

    // complete() lần 2 sau destroy — no-op an toàn.
    expect(() => handle.complete()).not.toThrow()
  })

  it('destroy() dọn NGAY (không tween) — battle reset/scene shutdown', () => {
    const { scene, graphicsList, tweens } = createSceneStub()

    const handle = spawnEnemySpawnVfx(createParams(scene, 4, 8))

    handle.destroy()

    const destroyCalls = graphicsList.filter((gfx) =>
      gfx.__calls.some((call) => call.method === 'destroy'),
    )

    expect(destroyCalls).toHaveLength(2)
    expect(tweens).toHaveLength(0)

    // update sau destroy — no-op an toàn.
    expect(() => handle.update(0.5)).not.toThrow()
  })

  it('boss_spawn preset nở lớn hơn enemy_spawn cùng ô', () => {
    const normal = createSceneStub()
    const boss = createSceneStub()

    const normalHandle = spawnEnemySpawnVfx({
      ...createParams(normal.scene, 4, 8),
      presetId: 'enemy_spawn',
    })
    const bossHandle = spawnEnemySpawnVfx({
      ...createParams(boss.scene, 4, 8),
      presetId: 'boss_spawn',
    })

    for (const gfx of normal.graphicsList) {
      gfx.__calls.length = 0
    }

    for (const gfx of boss.graphicsList) {
      gfx.__calls.length = 0
    }

    normalHandle.update(0.5)
    bossHandle.update(0.5)

    const normalEllipse = normal.graphicsList[0]!.__calls.find(
      (call: { method: string }) => call.method === 'strokeEllipse',
    )
    const bossEllipse = boss.graphicsList[0]!.__calls.find(
      (call: { method: string }) => call.method === 'strokeEllipse',
    )

    expect(bossEllipse!.args[2]).toBeGreaterThan(normalEllipse!.args[2] as number)

    vi.clearAllMocks()
  })
})
