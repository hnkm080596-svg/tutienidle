// @vitest-environment jsdom
// AtlasIdleSprite — DOM mirror of the battle placeholder idle loop.
// jsdom cannot rasterize canvas 2d (getContext returns null), so these
// tests pin the mount contract + the load-failure degradation, not pixels.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import AtlasIdleSprite from './AtlasIdleSprite.vue'

function mountSprite() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({
    render: () =>
      h(AtlasIdleSprite, { imageUrl: '/missing.png', atlasUrl: '/missing.json' }),
  })
  app.mount(container)

  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AtlasIdleSprite', () => {
  it('mounts a canvas element', () => {
    const mounted = mountSprite()

    expect(mounted.container.querySelector('canvas.atlas-idle-sprite')).not.toBeNull()

    mounted.unmount()
  })

  it('flags load failure (canvas display:none) instead of throwing', async () => {
    const mounted = mountSprite()

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(
      mounted.container.querySelector('canvas.atlas-idle-sprite--failed'),
    ).not.toBeNull()

    mounted.unmount()
  })
})
