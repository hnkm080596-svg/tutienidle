// @vitest-environment jsdom
// HuyenKimParallaxStack — DOM contract checks: manifest-order layers,
// srcset density pairs, decorative semantics, reduced-motion zeroing.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import HuyenKimParallaxStack from './HuyenKimParallaxStack.vue'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mountStack(stack: 'auth-creation' | 'realm-ascent' | 'skill-tree') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(HuyenKimParallaxStack, { stack }) })
  app.mount(container)
  mounted.push({ app, container })
  return container
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
})

describe('HuyenKimParallaxStack', () => {
  it('renders the auth stack in exact manifest order with density pairs', () => {
    const container = mountStack('auth-creation')
    const layers = container.querySelectorAll<HTMLImageElement>('.hk-parallax-stack__layer')

    expect(layers).toHaveLength(6)
    expect([...layers].map((img) => img.dataset.layer)).toEqual([
      'auth-creation-00-sky',
      'auth-creation-01-far-mountains',
      'auth-creation-02-mid-landscape',
      'auth-creation-03-focal-architecture',
      'auth-creation-04-low-mist',
      'auth-creation-05-foreground',
    ])
    expect([...layers].map((img) => img.dataset.order)).toEqual(['0', '1', '2', '3', '4', '5'])
    for (const img of layers) {
      expect(img.src).toContain('@1x.png')
      expect(img.srcset).toContain('@1x.png 1x')
      expect(img.srcset).toContain('@2x.png 2x')
      expect(img.getAttribute('aria-hidden')).toBeFalsy() // decorative via root
      expect(img.draggable).toBe(false)
    }
    const root = container.querySelector('.hk-parallax-stack')
    expect(root?.getAttribute('aria-hidden')).toBe('true')
    expect(root?.getAttribute('data-stack')).toBe('auth-creation')
  })

  it('renders realm (5) and skill (4) stacks in order', () => {
    expect(mountStack('realm-ascent').querySelectorAll('.hk-parallax-stack__layer')).toHaveLength(5)
    expect(mountStack('skill-tree').querySelectorAll('.hk-parallax-stack__layer')).toHaveLength(4)
  })

  it('zeroes every layer offset when prefers-reduced-motion matches', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia

    try {
      const container = mountStack('auth-creation')
      await nextTick()
      for (const img of container.querySelectorAll<HTMLElement>('.hk-parallax-stack__layer')) {
        expect(img.style.transform).toContain('translate3d(0px, 0px, 0)')
      }
      expect(container.querySelector('.hk-parallax-stack')?.classList.contains('is-reduced-motion')).toBe(true)
    } finally {
      window.matchMedia = original
    }
  })
})
