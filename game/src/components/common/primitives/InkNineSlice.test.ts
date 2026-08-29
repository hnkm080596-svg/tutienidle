/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import InkNineSlice from './InkNineSlice.vue'

describe('InkNineSlice', () => {
  it('renders an inert frame with manifest-derived CSS variables', () => {
    const host = document.createElement('div')
    const app = createApp({
      render: () => h(InkNineSlice, {
        assetId: 'frame-xs-ink-line',
        layer: 'frame',
      }),
    })
    app.mount(host)

    const layer = host.querySelector<HTMLElement>('[data-ink-slice="frame-xs-ink-line"]')!
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(layer.style.getPropertyValue('--ink-slice-top')).toBe('12')
    expect(layer.style.getPropertyValue('--ink-slice-layer')).toBe('2')
    expect(layer.style.getPropertyValue('--ink-slice-image')).toContain('frame-xs-ink-line@1x.png')
    expect(layer.style.getPropertyValue('--ink-slice-center')).toBe('')
    expect(layer.style.getPropertyValue('--ink-slice-border-slice')).toBe('12 12 12 12')
    expect(layer.style.pointerEvents).toBe('none')
    app.unmount()
  })

  it('marks filled surfaces and applies tint only through the isolated mask layer', () => {
    const host = document.createElement('div')
    const app = createApp({
      render: () => h(InkNineSlice, {
        assetId: 'button-s-seal',
        tintVar: '--cinnabar',
        opacity: 0.7,
      }),
    })
    app.mount(host)

    const layer = host.querySelector<HTMLElement>('[data-ink-slice="button-s-seal"]')!
    expect(layer.classList.contains('ink-nine-slice--tinted')).toBe(true)
    expect(layer.style.getPropertyValue('--ink-slice-center')).toBe('fill')
    expect(layer.style.getPropertyValue('--ink-slice-border-slice')).toBe('16 24 16 24 fill')
    expect(layer.style.getPropertyValue('--ink-slice-tint')).toBe('var(--cinnabar)')
    expect(layer.style.opacity).toBe('0.7')
    app.unmount()
  })
})
