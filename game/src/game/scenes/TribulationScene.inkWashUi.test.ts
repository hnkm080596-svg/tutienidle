// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { TribulationScene } from './TribulationScene'
import {
  addInkWashNineSlice,
  queueInkWashUiAtlas,
} from '@/game/support/InkWashUiPhaser'

vi.mock('@/game/support/InkWashUiPhaser', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/game/support/InkWashUiPhaser')>()

  return {
    ...actual,
    queueInkWashUiAtlas: vi.fn(),
    addInkWashNineSlice: vi.fn(),
  }
})

interface SceneHarness {
  textures: {
    exists: (key: string) => boolean
    get: (key: string) => { getSourceImage: () => { width: number; height: number } }
  }
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
    image: ReturnType<typeof vi.fn>
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
    setDepth: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
  }
  for (const method of Object.values(target)) method.mockReturnValue(target)
  return target
}

describe('TribulationScene ink-wash environment', () => {
  beforeEach(() => vi.clearAllMocks())

  // Huyen Kim S14 (2026-10-02): no ceremony frame around the viewport -
  // the route-owned storm vista must stay full-bleed. The test pins that
  // removal so a future change cannot silently re-add the stray ring.
  it('queues the atlas, paints the storm kit full-bleed, and adds no viewport frame', () => {
    const scene = new TribulationScene()
    const harness = scene as unknown as SceneHarness
    const shutdownHandlers: Array<() => void> = []
    const resizeHandlers: Array<(size: { width: number; height: number }) => void> = []

    vi.mocked(addInkWashNineSlice).mockReturnValue(chain() as unknown as Phaser.GameObjects.NineSlice)
    harness.textures = {
      exists: () => true,
      // Static mode sizes the cultivate sprite from the live source image.
      get: () => ({ getSourceImage: () => ({ width: 1233, height: 1275 }) }),
    }
    harness.load = { multiatlas: vi.fn() }
    harness.scale = {
      width: 1600,
      height: 900,
      on: vi.fn((_event, handler) => resizeHandlers.push(handler)),
      off: vi.fn(),
    }
    const images: ReturnType<typeof chain>[] = []
    harness.add = {
      rectangle: vi.fn(() => chain()),
      circle: vi.fn(() => chain()),
      text: vi.fn(() => chain()),
      sprite: vi.fn(() => chain()),
      image: vi.fn((...args: unknown[]) => {
        const image = chain()
        ;(image as unknown as { texture: { key: string } }).texture = { key: args[2] as string }
        images.push(image)
        return image
      }),
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
    expect(addInkWashNineSlice).not.toHaveBeenCalled()
    expect(resizeHandlers).toHaveLength(1)

    resizeHandlers[0]!({ width: 1000, height: 700 })

    // Stable environment kit: four textures drawn, anchored per contract
    // (storms north, dais south, vignette centered cover).
    expect(harness.add.image).toHaveBeenCalledTimes(4)
    expect(harness.add.image.mock.calls.map((call) => call[2])).toEqual([
      'hk-tribulation-storm-far',
      'hk-tribulation-storm-near',
      'hk-tribulation-dais',
      'hk-tribulation-sky-vignette',
    ])
    const byTexture = new Map(
      images.map((image) => [(image as unknown as { texture: { key: string } }).texture.key, image]),
    )
    // create() ran layoutEnvironment at 1600x900; resize to 1000x700 re-anchored.
    expect(byTexture.get('hk-tribulation-dais')?.setPosition).toHaveBeenLastCalledWith(500, 700)
    expect(byTexture.get('hk-tribulation-storm-far')?.setPosition).toHaveBeenLastCalledWith(500, 0)
    expect(byTexture.get('hk-tribulation-sky-vignette')?.setPosition).toHaveBeenLastCalledWith(500, 350)

    shutdownHandlers[0]!()
    expect(harness.scale.off).toHaveBeenCalledWith('resize', resizeHandlers[0])
  })
})
