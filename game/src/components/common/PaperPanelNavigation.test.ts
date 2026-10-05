// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import PaperPanelNavigation from './PaperPanelNavigation.vue'

it('keeps locked destinations visible while blocking navigation and preserving unlocked actions', () => {
  const select = vi.fn()
  const container = document.createElement('div')
  const app = createApp({ render: () => h(PaperPanelNavigation, {
    items: [{ id: 'technique', label: 'Locked', icon: '/icon.svg', locked: true }, { id: 'inventory', label: 'Bag', icon: '/icon.svg' }],
    active: 'character', label: 'Navigation', backLabel: 'Home', onSelect: select,
  }) })
  app.mount(container)
  try {
    const locked = container.querySelector<HTMLButtonElement>('[data-nav-id="technique"]')!
    expect(locked.getAttribute('aria-disabled')).toBe('true')
    locked.click()
    expect(select).not.toHaveBeenCalled()
    container.querySelector<HTMLButtonElement>('[data-nav-id="inventory"]')!.click()
    expect(select).toHaveBeenCalledExactlyOnceWith('inventory')
  } finally { app.unmount() }
})
