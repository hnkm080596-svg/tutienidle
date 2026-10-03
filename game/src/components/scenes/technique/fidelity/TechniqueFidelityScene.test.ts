// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import TechniqueFidelityScene from './TechniqueFidelityScene.vue'
import type { TechniqueUiModel } from './techniqueUi'
import { techniqueMessages } from '@/ui-preview/techniqueMessages'
const mounted: { app: App; container: HTMLElement }[] = []
afterEach(() => { for (const entry of mounted.splice(0)) { entry.app.unmount(); entry.container.remove() } })
describe('Technique paper presentation', () => {
  it('renders supplied values and emits intents without mutating the input', () => {
    const model: TechniqueUiModel = { name: 'Example', quality: 'Sample', description: 'Description', art: '/sample.png', sections: [], stages: [{ id: 'first', label: 'First', state: 'current' }], rankLabel: 'Rank', masteryLabel: '50 / 100', masteryPercent: 50, currentGrade: '1', nextGrade: '2', material: { name: 'Material', amountLabel: '10 / 5' }, materialNote: '', advanceDisabled: false, disabledReason: '', artTemporary: false }
    const original = JSON.stringify(model)
    let advances = 0
    let selected = ''
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({ render: () => h(TechniqueFidelityScene, { model, selected: 'first', notice: '', navigation: [], onAdvance: () => advances++, onSelect: id => { selected = id } }) })
    app.use(createI18n({ legacy: false, locale: 'vi', messages: techniqueMessages })).mount(container)
    mounted.push({ app, container })
    expect(container.querySelector('h1')?.textContent).toBe('Example')
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50')
    container.querySelector<HTMLButtonElement>('.technique-advance')!.click()
    container.querySelector<HTMLButtonElement>('.technique-stage')!.click()
    expect(advances).toBe(1)
    expect(selected).toBe('first')
    expect(JSON.stringify(model)).toBe(original)
  })
})
