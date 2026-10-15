// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import GameCard from './GameCard.vue'

afterEach(() => { document.body.innerHTML = '' })
describe('GameCard standalone primitive', () => {
  it('owns one decorative frame outside a panel and exposes the DOM element for interaction measurement', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const card = ref<InstanceType<typeof GameCard> | null>(null)
    const app = createApp({ render: () => h(GameCard, { as: 'aside', ref: card, 'aria-label': 'Card' }, { default: () => h('button', 'Action') }) })
    app.mount(host)
    expect(host.querySelector('aside')).toBe(card.value?.element)
    expect(card.value?.element?.getBoundingClientRect).toBeTypeOf('function')
    expect(host.querySelector('.game-panel')).toBeNull()
    expect(host.querySelectorAll('.game-card__frame')).toHaveLength(1)
    expect(host.querySelector('.game-card__frame')?.getAttribute('aria-hidden')).toBe('true')
    expect(host.querySelector('button')?.textContent).toBe('Action')
    app.unmount()
  })
})
