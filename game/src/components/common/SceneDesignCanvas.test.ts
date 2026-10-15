// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import SceneDesignCanvas from './SceneDesignCanvas.vue'
afterEach(() => vi.unstubAllGlobals())
it('preserves the 16:9 design plane and uniform scale after resize', async () => {
  let resize: () => void = () => {}
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback }
    observe() {}
    disconnect() {}
  })
  const host = document.createElement('div')
  const app = createApp(SceneDesignCanvas, { overlay: true })
  app.mount(host)
  let width = 800
  let height = 600
  Object.defineProperties(host.querySelector('[data-testid="scene-viewport"]')!, {
    clientWidth: { get: () => width }, clientHeight: { get: () => height },
  })
  try {
    resize()
    await nextTick()
    expect(host.querySelector('.scene-design-canvas')!.getAttribute('style')).toContain('height: 810px')
    expect(host.querySelector('.scene-design-canvas')!.getAttribute('data-scale')).toBe(String(800 / 1440))
    expect(host.querySelector('.scene-design-canvas')!.getAttribute('style')).toContain('width: 1440px')
    width = 960
    height = 540
    resize()
    await nextTick()
    expect(host.querySelector('.scene-design-canvas')!.getAttribute('style')).toContain('height: 810px')
  } finally { app.unmount() }
})

