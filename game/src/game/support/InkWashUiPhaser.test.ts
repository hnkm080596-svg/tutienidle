import { describe, expect, it, vi } from 'vitest'
import {
  addInkWashNineSlice,
  INK_WASH_UI_ATLAS_KEY,
  queueInkWashUiAtlas,
} from './InkWashUiPhaser'

describe('InkWashUiPhaser', () => {
  it('queues the atlas only when it is missing', () => {
    const atlas = vi.fn()
    const missingScene = {
      textures: { exists: () => false },
      load: { atlas },
    } as never

    queueInkWashUiAtlas(missingScene)

    expect(atlas).toHaveBeenCalledWith(
      INK_WASH_UI_ATLAS_KEY,
      'assets/ui/ink-wash/atlas/ink-wash-ui.png',
      'assets/ui/ink-wash/atlas/ink-wash-ui.json',
    )

    atlas.mockClear()
    queueInkWashUiAtlas({
      textures: { exists: () => true },
      load: { atlas },
    } as never)
    expect(atlas).not.toHaveBeenCalled()
  })

  it('passes manifest slices and presentation options to Phaser', () => {
    const setOrigin = vi.fn().mockReturnThis()
    const setTint = vi.fn().mockReturnThis()
    const setAlpha = vi.fn().mockReturnThis()
    const nineslice = vi.fn(() => ({ setOrigin, setTint, setAlpha }))
    const scene = { add: { nineslice } } as never

    addInkWashNineSlice(scene, {
      id: 'frame-xl-ceremony',
      x: 0,
      y: 0,
      width: 900,
      height: 600,
      origin: 0,
      tint: 0x332f28,
      alpha: 0.8,
    })

    expect(nineslice).toHaveBeenCalledWith(
      0,
      0,
      INK_WASH_UI_ATLAS_KEY,
      'frame-xl-ceremony',
      900,
      600,
      80,
      80,
      80,
      80,
    )
    expect(setOrigin).toHaveBeenCalledWith(0)
    expect(setTint).toHaveBeenCalledWith(0x332f28)
    expect(setAlpha).toHaveBeenCalledWith(0.8)
  })

  it('ignores tint for a non-tintable paper surface', () => {
    const setOrigin = vi.fn().mockReturnThis()
    const setTint = vi.fn().mockReturnThis()
    const setAlpha = vi.fn().mockReturnThis()
    const nineslice = vi.fn(() => ({ setOrigin, setTint, setAlpha }))

    addInkWashNineSlice({ add: { nineslice } } as never, {
      id: 'surface-m-paper',
      x: 10,
      y: 20,
      width: 240,
      height: 180,
      tint: 0xff0000,
    })

    expect(setTint).not.toHaveBeenCalled()
  })
})
