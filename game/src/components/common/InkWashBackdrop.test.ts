// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, type App } from 'vue'
import InkWashBackdrop from './InkWashBackdrop.vue'
import authSource from '@/components/onboarding/AuthEntryScreen.vue?raw'
import creationSource from '@/components/onboarding/CharacterCreationScreen.vue?raw'
import victorySource from '@/components/game/combat/CombatVictoryPanel.vue?raw'
import defeatSource from '@/components/game/combat/CombatDefeatPanel.vue?raw'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mountBackdrop(props: Record<string, unknown> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(InkWashBackdrop, props) })
  app.mount(container)
  mounted.push({ app, container })
  return container.querySelector<HTMLElement>('.ink-wash-backdrop')!
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
})

describe('InkWashBackdrop', () => {
  it('renders inert default painting layers', () => {
    const root = mountBackdrop()
    const images = [...root.querySelectorAll('img')]

    expect(getComputedStyle(root).pointerEvents).toBe('none')
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/assets/ui/ink-wash/overlays/wash-corner-mountain-left.png',
      '/assets/ui/ink-wash/overlays/wash-bottom-mist.png',
    ])
    for (const image of images) {
      expect(image.getAttribute('alt')).toBe('')
      expect(image.getAttribute('aria-hidden')).toBe('true')
      expect(image.getAttribute('draggable')).toBe('false')
    }
  })

  it('selects exact optional mountain, bamboo, and seal assets', () => {
    const root = mountBackdrop({
      leftMountain: false,
      rightMountain: true,
      bottomMist: false,
      bamboo: true,
      seal: 'large',
    })

    expect([...root.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual([
      '/assets/ui/ink-wash/overlays/wash-corner-mountain-right.png',
      '/assets/ui/ink-wash/overlays/wash-bamboo-right.png',
      '/assets/ui/ink-wash/overlays/seal-cinnabar-large.png',
    ])
  })

  it('composes the approved painting bridges into all four full-screen flows', () => {
    expect(authSource).toContain('<InkWashBackdrop left-mountain bamboo seal="small"')
    expect(creationSource).toContain('<InkWashBackdrop left-mountain right-mountain bottom-mist')
    expect(victorySource).toContain('<InkWashBackdrop :left-mountain="false" bottom-mist seal="large"')
    expect(defeatSource).toContain('<InkWashBackdrop left-mountain bottom-mist')
  })

  it('keeps onboarding controls legible on white paper', () => {
    expect(authSource).toContain('.auth-tabs button.active { color: var(--paper-text')
    expect(authSource).toContain('border-bottom: 2px solid var(--cinnabar')
    expect(creationSource).toContain('background: color-mix(in srgb, var(--paper-50')
    expect(creationSource).toContain('.stepper i.active { color: var(--cinnabar')
  })
})
