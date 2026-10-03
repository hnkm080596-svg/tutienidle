// @vitest-environment jsdom
// Huyen Kim SS18 (Dao Quyen) - the 10-rune rank ring: `lit` lit runes,
// `total` runes, decorative only (rank text stays the accessible source).
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import TechniqueRuneRing from './TechniqueRuneRing.vue'

function mountRing(props: { lit: number; total?: number }) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const app = createApp({ render: () => h(TechniqueRuneRing, props) })
  app.mount(container)

  return {
    container,
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

describe('TechniqueRuneRing', () => {
  it('renders 10 runes by default, only `lit` of them lit', () => {
    const { container, unmount } = mountRing({ lit: 4 })
    const runes = container.querySelectorAll('.rune-ring__rune')
    const lit = container.querySelectorAll('.rune-ring__rune.is-lit')

    expect(runes.length).toBe(10)
    expect(lit.length).toBe(4)

    unmount()
  })

  it('never lights more runes than total', () => {
    const { container, unmount } = mountRing({ lit: 12, total: 6 })

    expect(container.querySelectorAll('.rune-ring__rune').length).toBe(6)
    expect(container.querySelectorAll('.rune-ring__rune.is-lit').length).toBe(6)

    unmount()
  })

  it('is decorative (aria-hidden)', () => {
    const { container, unmount } = mountRing({ lit: 0 })

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')

    unmount()
  })
})
