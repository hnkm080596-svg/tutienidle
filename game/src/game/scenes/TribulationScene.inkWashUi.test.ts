// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { TribulationScene } from './TribulationScene'
import {
  addInkWashNineSlice,
  queueInkWashUiAtlas,
} from '@/game/support/InkWashUiPhaser'

vi.mock('@/game/support/InkWashUiPhaser', () => ({
  queueInkWashUiAtlas: vi.fn(),
  addInkWashNineSlice: vi.fn(),
}))

interface SceneHarness {
  textures: { exists: (key: string) => boolean }
  load: { multiatlas: ReturnType<typeof vi.fn> }
  scale: {
    width: number
    height: number
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
  }
  add: {
    rectangle: ReturnType<typeof vi.fn>
    circle: ReturnType<typeof vi.fn>
    text: ReturnType<typeof vi.fn>
    sprite: ReturnType<typeof vi.fn>
  }
  anims: {
    exists: () => boolean
    create: ReturnType<typeof vi.fn>
    generateFrameNames: ReturnType<typeof vi.fn>
  }
  registry: { get: () => undefined }
  events: { once: ReturnType<typeof vi.fn> }
}

function chain() {
  const target = {
    setStrokeStyle: vi.fn(),
    setOrigin: vi.fn(),
    setShadow: vi.fn(),
    play: vi.fn(),
    setDisplaySize: vi.fn(),
  }
  for (const method of Object.values(target)) method.mockReturnValue(target)
  return target
}

describe('TribulationScene ink-wash viewport frame', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queues, creates, resizes, and disposes the ceremonial frame', () => {
    const scene = new TribulationScene()
    const harness = scene as unknown as SceneHarness
    const shutdownHandlers: Array<() => void> = []
    const resizeHandlers: Array<(size: { width: number; height: number }) => void> = []
    const frame = { setSize: vi.fn() } as unknown as Phaser.GameObjects.NineSlice

    vi.mocked(addInkWashNineSlice).mockReturnValue(frame)
    harness.textures = { exists: () => true }
    harness.load = { multiatlas: vi.fn() }
    harness.scale = {
      width: 1600,
      height: 900,
      on: vi.fn((_event, handler) => resizeHandlers.push(handler)),
      off: vi.fn(),
    }
    harness.add = {
      rectangle: vi.fn(() => chain()),
      circle: vi.fn(() => chain()),
      text: vi.fn(() => chain()),
      sprite: vi.fn(() => chain()),
    }
    harness.anims = {
      exists: () => true,
      create: vi.fn(),
      generateFrameNames: vi.fn(),
    }
    harness.registry = { get: () => undefined }
    harness.events = {
      once: vi.fn((_event, handler) => shutdownHandlers.push(handler)),
    }

    scene.preload()
    scene.create()

    expect(queueInkWashUiAtlas).toHaveBeenCalledWith(scene)
    expect(addInkWashNineSlice).toHaveBeenCalledWith(scene, {
      id: 'frame-xl-ceremony',
      x: 12,
      y: 12,
      width: 1576,
      height: 876,
      origin: 0,
    })
    expect(resizeHandlers).toHaveLength(1)

    resizeHandlers[0]!({ width: 1000, height: 700 })
    expect(frame.setSize).toHaveBeenCalledWith(976, 676)

    shutdownHandlers[0]!()
    expect(harness.scale.off).toHaveBeenCalledWith('resize', resizeHandlers[0])
  })
})
