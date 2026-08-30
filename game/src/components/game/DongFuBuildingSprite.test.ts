// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import DongFuBuildingSprite from './DongFuBuildingSprite.vue'
import { DONG_FU_BUILDING_ART } from '@/game/support/DongFuBuildingArt'

const pillRoomArt = DONG_FU_BUILDING_ART.find((entry) => entry.buildingId === 'pill_room')!

function mountSprite(options?: { reducedMotion?: boolean; onAssetError?: (id: string) => void }) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    render: () => h(DongFuBuildingSprite, {
      art: pillRoomArt,
      status: 'locked',
      selected: false,
      disabled: false,
      season: 'spring',
      time: 'night',
      reducedMotion: options?.reducedMotion ?? false,
      onAssetError: options?.onAssetError,
    }),
  })

  app.mount(container)

  return {
    container,
    root: () => container.querySelector<HTMLElement>('.dong-fu-building-sprite')!,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DongFuBuildingSprite', () => {
  it('renders aligned decorative layers for the requested building state', () => {
    const mounted = mountSprite()
    const root = mounted.root()
    const base = root.querySelector<HTMLImageElement>('[data-layer="base"]')!
    const mask = root.querySelector<HTMLImageElement>('[data-layer="silhouette-mask"]')!
    const locked = root.querySelector<HTMLImageElement>('[data-layer="locked-overlay"]')!

    expect(root.dataset.buildingId).toBe('pill_room')
    expect(root.classList).toContain('is-locked')
    expect(root.classList).toContain('is-time-night')
    expect(base.getAttribute('src')).toBe('/assets/buildings/dong-fu/v2/pill_room/base.png')
    expect(mask.getAttribute('src')).toBe('/assets/buildings/dong-fu/v2/pill_room/silhouette-mask.png')
    expect(
      Array.from(root.querySelectorAll<HTMLElement>('[data-layer]')).map((layer) => layer.dataset.layer),
    ).toEqual(['ground-shadow', 'silhouette-mask', 'base', 'locked-overlay'])
    expect(locked.hidden).toBe(false)
    expect(base.alt).toBe('')
    expect(base.draggable).toBe(false)

    mounted.unmount()
  })

  it('reports a failed base while preserving the sprite stack', async () => {
    const onAssetError = vi.fn()
    const mounted = mountSprite({ onAssetError })
    const base = mounted.root().querySelector<HTMLImageElement>('[data-layer="base"]')!

    base.dispatchEvent(new Event('error'))
    await Promise.resolve()

    expect(onAssetError).toHaveBeenCalledWith('pill_room')
    expect(mounted.root().classList).toContain('has-asset-error')
    expect(mounted.root().querySelector('[data-layer="locked-overlay"]')).not.toBeNull()

    mounted.unmount()
  })

  it('disables hover elevation when reduced motion is requested', () => {
    const mounted = mountSprite({ reducedMotion: true })

    expect(mounted.root().classList).toContain('is-reduced-motion')
    expect(mounted.root().classList).not.toContain('has-hover-motion')

    mounted.unmount()
  })
})
