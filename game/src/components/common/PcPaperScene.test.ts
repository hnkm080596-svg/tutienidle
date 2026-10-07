// @vitest-environment jsdom
import { createApp, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import PcPaperScene from './PcPaperScene.vue'
import PcPaperTabs from './PcPaperTabs.vue'
import PcBodyMeridianOverlay from './PcBodyMeridianOverlay.vue'

describe('PC paper presentation contracts', () => {
  it('keeps navigation optional and exposes the same content regions', async () => {
    const navigation = ref(false)
    const container = document.createElement('div')
    const app = createApp({ render: () => h(PcPaperScene, { title: 'Title', navigation: navigation.value }, { navigation: () => h('button', 'Navigation'), default: () => h('p', 'Workspace'), footer: () => h('p', 'Footer') }) })
    app.mount(container)
    try {
      expect(container.querySelector('.pc-paper-scene__navigation')).toBeNull()
      expect(container.querySelector('main')?.textContent).toBe('Workspace')
      expect(container.querySelector('footer')?.textContent).toBe('Footer')
      navigation.value = true
      await nextTick()
      expect(container.querySelector('.pc-paper-scene__navigation')?.textContent).toBe('Navigation')
    } finally { app.unmount() }
  })

  it('requests a tab selection while selection remains caller owned', async () => {
    const select = vi.fn()
    const container = document.createElement('div')
    const app = createApp({ render: () => h(PcPaperTabs, { items: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second' }], selected: 'first', label: 'Tabs', onSelect: select }) })
    app.mount(container)
    try {
      container.querySelectorAll('button')[1]!.click()
      expect(select).toHaveBeenCalledExactlyOnceWith('second')
      expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('true')
    } finally { app.unmount() }
  })

  it('isolates SVG effect identities when a scene shows multiple figures', () => {
    const container = document.createElement('div')
    const app = createApp({ render: () => h('div', [h(PcBodyMeridianOverlay), h(PcBodyMeridianOverlay)]) })
    app.mount(container)
    try {
      const ids = [...container.querySelectorAll('[id]')].map(node => node.id)
      expect(new Set(ids).size).toBe(ids.length)
    } finally { app.unmount() }
  })
})
