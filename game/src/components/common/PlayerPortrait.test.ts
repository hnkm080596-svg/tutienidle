// @vitest-environment jsdom
//
// No @vue/test-utils in this project - mount via the public Vue API
// (createApp/h), same pattern as SlotView.test.ts.
import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { createApp, h } from 'vue'
import PlayerPortrait from './PlayerPortrait.vue'
import { ENTITY_ART_MODE } from '@/presentation/art/EntityArtMode'

function mountPortrait(props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: () => h(PlayerPortrait as any, props),
  })

  // The component reads the player store for live cultivationWay/armed
  // state - mount with the same store wiring every app consumer gets.
  app.use(createPinia())
  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('PlayerPortrait — ENTITY_ART_MODE branch', () => {
  it('UI idle animation renders the existing catalogue clip without flipping global art mode', () => {
    const originalMode = ENTITY_ART_MODE
    const { container, unmount } = mountPortrait({ variant: 'portrait', animationMode: 'idle' })
    expect(container.querySelector('canvas.entity-sprite-canvas')).not.toBeNull()
    expect(container.querySelector('img.player-portrait__image')).toBeNull()
    expect(ENTITY_ART_MODE).toBe(originalMode)
    unmount()
  })
  it('static mode renders the PNG <img>, never the atlas canvas', () => {
    if (ENTITY_ART_MODE !== 'static') return

    const { container, unmount } = mountPortrait({ variant: 'portrait' })

    expect(container.querySelector('img.player-portrait__image')).not.toBeNull()
    expect(container.querySelector('canvas.entity-sprite-canvas')).toBeNull()
    unmount()
  })

  it('animated mode renders EntitySpriteCanvas instead of the PNG', () => {
    if (ENTITY_ART_MODE !== 'animated') return

    const { container, unmount } = mountPortrait({ variant: 'portrait' })

    expect(container.querySelector('canvas.entity-sprite-canvas')).not.toBeNull()
    expect(container.querySelector('img.player-portrait__image')).toBeNull()
    unmount()
  })
})
