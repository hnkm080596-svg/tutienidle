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
  it('uses one shared authored control family for all button variants', () => {
    for (const variant of ['primary', 'secondary', 'danger', 'ghost'] as const) {
      const container = mount(GameButton, { variant })
      const button = container.querySelector('button')!
      expect(button.style.getPropertyValue('--pc-primary-button')).toContain('button-primary-v1.png')
      expect(button.style.getPropertyValue('--pc-secondary-button')).toContain('button-secondary-v1.png')
      expect(container.querySelector('[data-hk-slice]')).toBeNull()
      expect(button.textContent).toBe('Nhãn dài')
    }
  })

  it('preserves the circle shape and accessible button label', () => {
    const circle = mount(GameButton, { shape: 'circle', 'aria-label': 'Đóng' })
    const button = circle.querySelector('button')!
    expect(button.classList).toContain('game-button--circle')
    expect(button.getAttribute('aria-label')).toBe('Đóng')
    expect(circle.querySelector('[data-hk-slice]')).toBeNull()
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

  it('adds chrome frames without replacing primitive semantics', () => {
    const chip = mount(Chip, { active: true })
    const badge = mount(NotificationBadge, { count: 3 })

    expect(chip.querySelector('[data-hk-slice="seal-chip"]')).not.toBeNull()
    expect(chip.querySelector('button')?.classList.contains('is-active')).toBe(true)
    expect(badge.querySelector('[data-ink-slice="frame-xs-ink-line"]')).not.toBeNull()
    expect(badge.textContent).toContain('3')
  })

  // SlotView KHONG dung ink-wash frame - lap lai tren luoi day dac (Kho
  // Vat) gay roi; giu vien CSS don gian (xem SlotView.vue).
  it('SlotView stays plain CSS border, no repeated nine-slice frame', () => {
    const slot = mount(SlotView as Component, { item: null, label: 'Trống' })

    expect(slot.querySelector('[data-ink-slice]')).toBeNull()
    expect(slot.querySelector('[data-hk-slice]')).toBeNull()
    expect(slot.querySelector('button')?.getAttribute('aria-label')).toBe('Trống')
  })
})
