// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import ExplorationPaperMap from './ExplorationPaperMap.vue'

it('keeps locked stages inspectable and emits supplied identity without mutating nodes', () => {
  const chapters = [{ id: 'a', label: 'Chapter', tone: '', nodes: [{ id: 'locked-stage', label: '7', x: 300, y: 80, state: 'locked' as const, boss: false, perfect: false }], edges: [] }]
  const before = JSON.stringify(chapters)
  const chosen: string[] = []
  const container = document.createElement('div')
  const app = createApp({ render: () => h(ExplorationPaperMap, { chapters, terrain: '/terrain.png', selected: 'locked-stage', onSelect: (id: string) => chosen.push(id) }) })
  app.use(createI18n({ legacy: false, locale: 'vi', messages: { vi: { exploration: { stageLabel: '{chapter} · {stage} · {state}', state: { locked: 'Locked' }, boss: 'Boss' } } } })).mount(container)
  try {
    const button = container.querySelector<HTMLButtonElement>('button')!
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    button.click()
    expect(chosen).toEqual(['locked-stage'])
    expect(JSON.stringify(chapters)).toBe(before)
  } finally { app.unmount() }
})
