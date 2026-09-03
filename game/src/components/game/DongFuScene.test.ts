// @vitest-environment jsdom
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { GameManager } from '@/core/game/GameManager'
import { buildings } from '@/data/building/buildings'
import { commitThanhVanVariant } from '@/game/support/ThanhVanArt'
import { useUiStore } from '@/stores/ui'
import { i18n } from '@/i18n'
import DongFuScene from './DongFuScene.vue'

const SPRING_MORNING_URLS = [
  '/assets/backgrounds/dong-fu/modular/times/morning/00-sky.png',
  '/assets/backgrounds/dong-fu/modular/times/morning/01-high-clouds.png',
  '/assets/backgrounds/dong-fu/modular/times/morning/02-light-veil.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/03-far-mountains.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/04-distant-ledges.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/05-mid-landscape.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/06-water-valley.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/07-sect-ground.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/08-low-mist.png',
  '/assets/backgrounds/dong-fu/modular/seasons/spring/09-foreground.png',
] as const

const LAYER_NAMES = [
  '00-sky',
  '01-high-clouds',
  '02-light-veil',
  '03-far-mountains',
  '04-distant-ledges',
  '05-mid-landscape',
  '06-water-valley',
  '07-sect-ground',
  '08-low-mist',
  '09-foreground',
] as const

interface ControlledImageRecord {
  onload: (() => void) | null
  onerror: (() => void) | null
  src: string
}

const pendingImages: ControlledImageRecord[] = []

class ControlledImage implements ControlledImageRecord {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private source = ''

  get src(): string {
    return this.source
  }

  set src(value: string) {
    this.source = value
    pendingImages.push(this)
  }
}

vi.stubGlobal(
  'fetch',
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ textures: [{ image: '', size: { w: 1, h: 1 }, frames: [] }] }),
    }),
  ),
)

vi.stubGlobal('Image', ControlledImage)

function setReducedMotion(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function mountDongFuScene() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const gameManager = new GameManager()
  gameManager.registerBuildings(buildings)
  const app = createApp({ render: () => h(DongFuScene) })
  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  app.mount(container)

  return {
    ui: useUiStore(pinia),
    root: () => container.querySelector<HTMLElement>('.home-scene'),
    activeStack: () => container.querySelector<HTMLElement>('.home-scene__parallax-stack--active'),
    activeLayers: () => Array.from(
      container.querySelectorAll<HTMLImageElement>(
        '.home-scene__parallax-stack--active .home-scene__parallax-layer',
      ),
    ),
    previousLayers: () => Array.from(
      container.querySelectorAll<HTMLImageElement>(
        '.home-scene__parallax-stack--previous .home-scene__parallax-layer',
      ),
    ),
    buildings: () => container.querySelector<HTMLElement>('.home-building-hotspots'),
    seasonOverlay: () => container.querySelector<HTMLImageElement>('.home-building-hotspots__season-overlay'),
    firstBuildingSprite: () => container.querySelector<HTMLElement>('.dong-fu-building-sprite'),
    playerTrigger: () => container.querySelector<HTMLButtonElement>('.home-player__trigger'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

async function flushSwap(): Promise<void> {
  await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  pendingImages.length = 0
  commitThanhVanVariant({ season: 'spring', time: 'morning' })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('DongFuScene seasonal parallax background', () => {
  it('renders the complete spring morning stack in depth order', () => {
    setReducedMotion(false)
    const mounted = mountDongFuScene()
    const layers = mounted.activeLayers()

    expect(layers.map((layer) => layer.getAttribute('src'))).toEqual(SPRING_MORNING_URLS)
    expect(layers.map((layer) => layer.dataset.layer)).toEqual(LAYER_NAMES)
    expect(layers.every((layer) => layer.dataset.season === 'spring')).toBe(true)
    expect(layers.every((layer) => layer.dataset.time === 'morning')).toBe(true)
    expect(layers.every((layer) => layer.alt === '' && layer.draggable === false)).toBe(true)

    const children = Array.from(mounted.root()!.children)
    expect(children.indexOf(mounted.activeStack()!)).toBeLessThan(
      children.indexOf(mounted.root()!.querySelector('.home-linhnhan')!),
    )
    expect(children.indexOf(mounted.activeStack()!)).toBeLessThan(
      children.indexOf(mounted.buildings()!),
    )
    expect(children.indexOf(mounted.buildings()!)).toBeLessThan(
      children.indexOf(mounted.root()!.querySelector('.home-player')!),
    )

    mounted.unmount()
  })

  it('moves near layers farther than far layers and only marks atmospheric layers for drift', async () => {
    setReducedMotion(false)
    const mounted = mountDongFuScene()

    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: window.innerWidth,
      clientY: window.innerHeight,
    }))
    await nextTick()

    const byLayer = (name: string) => mounted.activeLayers().find((layer) => layer.dataset.layer === name)!

    expect(byLayer('00-sky').style.getPropertyValue('--parallax-x')).toBe('0px')
    expect(byLayer('03-far-mountains').style.getPropertyValue('--parallax-x')).toBe('-4px')
    expect(byLayer('09-foreground').style.getPropertyValue('--parallax-x')).toBe('-18px')
    expect(byLayer('09-foreground').style.getPropertyValue('--parallax-y')).toBe('-9px')

    expect(byLayer('01-high-clouds').classList).toContain('home-scene__parallax-layer--cloud-slow')
    expect(byLayer('02-light-veil').classList).toContain('home-scene__parallax-layer--cloud-medium')
    expect(byLayer('08-low-mist').classList).toContain('home-scene__parallax-layer--mist-slow')
    expect(byLayer('07-sect-ground').classList).toContain('home-scene__parallax-layer--static')

    mounted.unmount()
  })

  it('keeps the complete old stack until all ten incoming images load', async () => {
    setReducedMotion(false)
    const mounted = mountDongFuScene()

    mounted.ui.enterCombatScene('stage')
    await nextTick()
    commitThanhVanVariant({ season: 'winter', time: 'night' })
    mounted.ui.exitCombatScene()
    await nextTick()

    expect(pendingImages).toHaveLength(10)
    expect(mounted.seasonOverlay()!.dataset.season).toBe('spring')
    expect(mounted.firstBuildingSprite()!.classList).toContain('is-time-morning')
    pendingImages.slice(0, 9).forEach((image) => image.onload?.())
    await flushSwap()
    expect(mounted.activeLayers().map((layer) => layer.getAttribute('src'))).toEqual(SPRING_MORNING_URLS)
    expect(mounted.previousLayers()).toHaveLength(0)
    expect(mounted.seasonOverlay()!.dataset.season).toBe('spring')
    expect(mounted.firstBuildingSprite()!.classList).toContain('is-time-morning')

    pendingImages[9]!.onload?.()
    await flushSwap()

    await vi.waitFor(() => {
      expect(mounted.activeLayers().map((layer) => layer.dataset.season)).toEqual(
        Array.from({ length: 10 }, () => 'winter'),
      )
    })
    expect(mounted.activeLayers()).toHaveLength(10)
    expect(mounted.activeLayers().map((layer) => layer.dataset.time)).toEqual(
      Array.from({ length: 10 }, () => 'night'),
    )
    expect(mounted.previousLayers().map((layer) => layer.getAttribute('src'))).toEqual(
      SPRING_MORNING_URLS,
    )
    expect(mounted.seasonOverlay()!.dataset.season).toBe('winter')
    expect(mounted.firstBuildingSprite()!.classList).toContain('is-time-night')

    mounted.unmount()
  })

  it('preserves the old complete stack when any incoming image fails', async () => {
    setReducedMotion(false)
    const mounted = mountDongFuScene()

    mounted.ui.enterCombatScene('stage')
    await nextTick()
    commitThanhVanVariant({ season: 'autumn', time: 'evening' })
    mounted.ui.exitCombatScene()
    await nextTick()

    pendingImages[4]!.onerror?.()
    pendingImages.filter((_, index) => index !== 4).forEach((image) => image.onload?.())
    await flushSwap()

    expect(mounted.activeLayers().map((layer) => layer.getAttribute('src'))).toEqual(SPRING_MORNING_URLS)
    expect(mounted.previousLayers()).toHaveLength(0)
    expect(mounted.seasonOverlay()!.dataset.season).toBe('spring')
    expect(mounted.firstBuildingSprite()!.classList).toContain('is-time-morning')

    mounted.unmount()
  })

  it('disables pointer parallax and transition motion for reduced motion', async () => {
    setReducedMotion(true)
    const mounted = mountDongFuScene()

    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: window.innerWidth,
      clientY: window.innerHeight,
    }))
    await nextTick()

    expect(mounted.activeLayers().every((layer) => (
      layer.style.getPropertyValue('--parallax-x') === '0px'
      && layer.style.getPropertyValue('--parallax-y') === '0px'
    ))).toBe(true)
    expect(mounted.activeStack()!.classList).toContain('is-reduced-motion')

    mounted.ui.enterCombatScene('stage')
    await nextTick()
    commitThanhVanVariant({ season: 'summer', time: 'noon' })
    mounted.ui.exitCombatScene()
    await nextTick()
    pendingImages.forEach((image) => image.onload?.())
    await flushSwap()

    await vi.waitFor(() => {
      expect(mounted.activeLayers().map((layer) => layer.dataset.season)).toEqual(
        Array.from({ length: 10 }, () => 'summer'),
      )
    })
    expect(mounted.previousLayers()).toHaveLength(0)

    mounted.unmount()
  })

  it('keeps the character trigger interactive', () => {
    setReducedMotion(false)
    const mounted = mountDongFuScene()

    expect(mounted.ui.isCommandWheelOpen).toBe(false)
    mounted.playerTrigger()!.click()
    expect(mounted.ui.isCommandWheelOpen).toBe(true)

    mounted.unmount()
  })
})
