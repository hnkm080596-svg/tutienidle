// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import GridSheetSprite from './GridSheetSprite.vue'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('native-pixel sheet playback', () => {
  it('crops integer source cells into a stationary canvas and cancels playback on teardown', async () => {
    const drawImage = vi.fn()
    const clearRect = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, clearRect } as unknown as CanvasRenderingContext2D)
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length }))
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const host = document.createElement('div')
    const instance = ref<InstanceType<typeof GridSheetSprite> | null>(null)
    const app = createApp({ render: () => h(GridSheetSprite, { ref: instance, src: '/mortal.png', columns: 1, rows: 41, frameWidth: 128, frameHeight: 192, fps: 14 }) })
    app.mount(host)
    try {
      const image = host.querySelector('img')!
      image.decode = vi.fn(async () => {})
      Object.defineProperty(image, 'naturalWidth', { value: 128 })
      await instance.value!.prepare(new AbortController().signal)
      callbacks.shift()!(100)
      callbacks.shift()!(200)
      expect(drawImage).toHaveBeenLastCalledWith(image, 0, 192, 128, 192, 0, 0, 128, 192)
      expect(host.querySelector('canvas')?.width).toBe(128)
      expect(host.querySelector('canvas')?.height).toBe(192)
    } finally { app.unmount() }
    expect(cancel).toHaveBeenCalled()
  })
})


