// @vitest-environment jsdom
//
// No @vue/test-utils in this project - mount via the public Vue API
// (createApp/h), same pattern as SlotView.test.ts.
import { describe, expect, it } from 'vitest'
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
