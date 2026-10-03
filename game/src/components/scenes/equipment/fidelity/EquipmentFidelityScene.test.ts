// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import EquipmentFidelityScene from './EquipmentFidelityScene.vue'
import type { EquipmentDisplay } from './equipmentUi'
import { equipmentMessages } from '@/ui-preview/equipmentMessages'

it('reserves the character area and shows equipment details only during inspection', async () => {
  const item: EquipmentDisplay = Object.freeze({ id: 'sample', name: 'Sample sword', icon: '/sword.png', slot: 'Weapon', grade: 'Rare', level: 'I', enhancement: '+1', description: 'Sample', tone: '#567', stats: [] })
  const container = document.createElement('div')
  const app = createApp({ render: () => h(EquipmentFidelityScene, { sockets: [{ id: 'weapon', label: 'Weapon', item }], items: [item], navigation: [], notice: '' }) })
  app.use(createI18n({ legacy: false, locale: 'vi', messages: equipmentMessages })).mount(container)
  try {
    expect(container.querySelector('[data-character-socket]')).not.toBeNull()
    expect(container.querySelector('[data-character-socket] img')).toBeNull()
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    const button = container.querySelector<HTMLButtonElement>('.equipment-socket button')!
    button.dispatchEvent(new Event('pointerenter'))
    await nextTick()
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('Sample sword')
    button.dispatchEvent(new Event('pointerleave'))
    await nextTick()
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    button.dispatchEvent(new Event('focus'))
    await nextTick()
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    expect(item.id).toBe('sample')
  } finally { app.unmount() }
})
