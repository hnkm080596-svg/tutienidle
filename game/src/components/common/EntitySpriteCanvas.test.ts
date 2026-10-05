// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import EntitySpriteCanvas from './EntitySpriteCanvas.vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

it('paints a visible first frame under reduced motion without starting a loop', async () => {
  const drawImage = vi.fn()
  const context = { clearRect: vi.fn(), drawImage, imageSmoothingEnabled: false }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  const frame = { frame: { x: 0, y: 0, w: 4, h: 6 }, spriteSourceSize: { x: 0, y: 0 }, sourceSize: { w: 4, h: 6 } }
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ frames: { 'idle_00.png': frame } }) })))
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  let firstTick: FrameRequestCallback | undefined
  const requestFrame = vi.fn((callback: FrameRequestCallback) => { firstTick = callback; return 1 })
  vi.stubGlobal('requestAnimationFrame', requestFrame)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render: () => h(EntitySpriteCanvas, {
    sheetUrl: '/sheet.png', atlasUrl: '/atlas.json', framePrefix: 'idle_', frameSuffix: '.png',
    zeroPad: 2, firstFrame: 0, lastFrame: 0, fps: 10,
  }) })
  app.mount(container)
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(firstTick).toBeDefined()
  firstTick!(1)
  expect(drawImage).toHaveBeenCalledOnce()
  expect(container.querySelector('canvas')?.width).toBe(4)
  expect(requestFrame).toHaveBeenCalledOnce()
})
