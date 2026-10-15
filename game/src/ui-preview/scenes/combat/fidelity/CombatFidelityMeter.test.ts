// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h } from 'vue'
import CombatFidelityMeter from './CombatFidelityMeter.vue'

it.each([{ value: 140, expected: '100' }, { value: -20, expected: '0' }, { value: NaN, expected: '0' }, { value: 42, expected: '42' }])('bounds visual percentage $value without changing display values', ({ value, expected }) => {
  const root = document.createElement('div')
  const app = createApp({ render: () => h(CombatFidelityMeter, { label: 'HP', value: 'Supplied value', percent: value }) })
  app.mount(root)
  try {
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(expected)
    expect(root.textContent).toContain('Supplied value')
  } finally { app.unmount() }
})
