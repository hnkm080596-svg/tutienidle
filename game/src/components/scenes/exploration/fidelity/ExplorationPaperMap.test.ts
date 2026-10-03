// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import ExplorationPaperMap from './ExplorationPaperMap.vue'

// Locked stages are NOT selectable (user ruling: unqualified stages are
// locked, not clickable): the button stays focusable for its state
// label (aria-disabled, not `disabled`) but never emits `select`.
it('blocks locked stage selection while keeping the state label reachable', () => {
  const chapters = [{ id: 'a', label: 'Chapter', tone: '', nodes: [{ id: 'locked-stage', label: '7', x: 300, y: 80, state: 'locked' as const, boss: false, perfect: false }], edges: [] }]
  const before = JSON.stringify(chapters)
  const chosen: string[] = []
  const container = document.createElement('div')
  const app = createApp({ render: () => h(ExplorationPaperMap, { chapters, terrain: '/terrain.png', selected: 'locked-stage', onSelect: (id: string) => chosen.push(id) }) })
  app.use(createI18n({ legacy: false, locale: 'vi', messages: { vi: { exploration: { stageLabel: '{chapter} · {stage} · {state}', state: { locked: 'Locked' }, boss: 'Boss' } } } })).mount(container)
  try {
    const button = container.querySelector<HTMLButtonElement>('button')!
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.title).toBe('Locked')
    expect(button.querySelector('.lock-mark')).not.toBeNull()
    button.click()
    expect(chosen).toEqual([])
    expect(JSON.stringify(chapters)).toBe(before)
  } finally { app.unmount() }
})

it('emits select for unlocked stages', () => {
  const chapters = [{ id: 'a', label: 'Chapter', tone: '', nodes: [{ id: 'open-stage', label: '5', x: 300, y: 80, state: 'available' as const, boss: false, perfect: false }], edges: [] }]
  const chosen: string[] = []
  const container = document.createElement('div')
  const app = createApp({ render: () => h(ExplorationPaperMap, { chapters, terrain: '/terrain.png', selected: 'open-stage', onSelect: (id: string) => chosen.push(id) }) })
  app.use(createI18n({ legacy: false, locale: 'vi', messages: { vi: { exploration: { stageLabel: '{chapter} · {stage} · {state}', state: { available: 'Open' }, boss: 'Boss' } } } })).mount(container)
  try {
    const button = container.querySelector<HTMLButtonElement>('button')!
    expect(button.getAttribute('aria-disabled')).toBeNull()
    expect(button.querySelector('.lock-mark')).toBeNull()
    button.click()
    expect(chosen).toEqual(['open-stage'])
  } finally { app.unmount() }
})
