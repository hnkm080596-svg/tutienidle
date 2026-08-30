/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import InkNineSlice from './InkNineSlice.vue'

describe('InkNineSlice', () => {
  it('renders an inert, pure-CSS painted layer keyed by assetId', () => {
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
    expect(layer.classList.contains('ink-nine-slice--frame')).toBe(true)
    expect(layer.classList.contains('ink-nine-slice--frame-xs-ink-line')).toBe(true)
    expect(layer.style.getPropertyValue('--ink-slice-layer')).toBe('2')
    expect(layer.style.pointerEvents).toBe('none')
    app.unmount()
  })

  it('marks tinted layers and exposes the resolved CSS var, independent of default layer', () => {
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
    expect(layer.classList.contains('ink-nine-slice--surface')).toBe(true)
    expect(layer.classList.contains('ink-nine-slice--tinted')).toBe(true)
    expect(layer.style.getPropertyValue('--ink-slice-tint')).toBe('var(--cinnabar)')
    expect(layer.style.getPropertyValue('--ink-slice-layer')).toBe('1')
    expect(layer.style.opacity).toBe('0.7')
    app.unmount()
  })

  it('leaves --ink-slice-tint unset when no tintVar is given, so the per-asset default color applies', () => {
    const host = document.createElement('div')
    const app = createApp({
      render: () => h(InkNineSlice, { assetId: 'surface-m-paper' }),
    })
    app.mount(host)

    const layer = host.querySelector<HTMLElement>('[data-ink-slice="surface-m-paper"]')!
    expect(layer.classList.contains('ink-nine-slice--tinted')).toBe(false)
    expect(layer.style.getPropertyValue('--ink-slice-tint')).toBe('')
    app.unmount()
  })
})
