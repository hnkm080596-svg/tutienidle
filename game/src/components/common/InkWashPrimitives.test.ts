// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, type App, type Component } from 'vue'
import GameButton from './GameButton.vue'
import Chip from './primitives/Chip.vue'
import SlotView from './SlotView.vue'
import NotificationBadge from './NotificationBadge.vue'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mount(component: Component, props: Record<string, unknown>, label = 'Nhãn dài') {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(component, props, { default: () => label }) })
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

describe('ink-wash shared primitives', () => {
  it('maps each button variant to the approved XS/S slice', () => {
    const cases = [
      ['primary', 'button-s-paper'],
      ['secondary', 'button-s-ink'],
      ['danger', 'button-s-seal'],
      ['ghost', 'frame-xs-ink-line'],
    ] as const

    for (const [variant, asset] of cases) {
      const container = mount(GameButton, { variant })
      expect(container.querySelector(`[data-ink-slice="${asset}"]`)).not.toBeNull()
    }

    const circle = mount(GameButton, { shape: 'circle' })
    expect(circle.querySelector('[data-ink-slice="frame-xs-ink-line"]')).not.toBeNull()
    expect(circle.querySelector('[data-ink-slice="button-s-paper"]')).toBeNull()
  })

  it('keeps enabled, disabled, and loading click behavior unchanged', () => {
    const enabledClick = vi.fn()
    const disabledClick = vi.fn()
    const loadingClick = vi.fn()
    const enabled = mount(GameButton, { onClick: enabledClick })
    const disabled = mount(GameButton, { disabled: true, onClick: disabledClick })
    const loading = mount(GameButton, { loading: true, onClick: loadingClick })

    enabled.querySelector('button')!.click()
    disabled.querySelector('button')!.click()
    loading.querySelector('button')!.click()

    expect(enabledClick).toHaveBeenCalledOnce()
    expect(disabledClick).not.toHaveBeenCalled()
    expect(loadingClick).not.toHaveBeenCalled()
  })

  it('adds ink frames without replacing primitive semantics', () => {
    const chip = mount(Chip, { active: true })
    const badge = mount(NotificationBadge, { count: 3 })

    expect(chip.querySelector('[data-ink-slice="frame-xs-ink-line"]')).not.toBeNull()
    expect(chip.querySelector('button')?.classList.contains('is-active')).toBe(true)
    expect(badge.querySelector('[data-ink-slice="frame-xs-ink-line"]')).not.toBeNull()
    expect(badge.textContent).toContain('3')
  })

  // SlotView KHÔNG dùng ink-wash frame — lặp lại trên lưới dày đặc (Kho
  // Vật) gây rối; giữ viền CSS đơn giản (xem SlotView.vue).
  it('SlotView stays plain CSS border, no repeated ink-wash frame', () => {
    const slot = mount(SlotView as Component, { item: null, label: 'Trống' })

    expect(slot.querySelector('[data-ink-slice]')).toBeNull()
    expect(slot.querySelector('button')?.getAttribute('aria-label')).toBe('Trống')
  })
})
