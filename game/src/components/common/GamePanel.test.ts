// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import GamePanel from './GamePanel.vue'

afterEach(() => { document.body.innerHTML = '' })

describe('GamePanel ownership boundary', () => {
  it('hosts instances inside its content while keeping header and backdrop under the same parent', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp({ render: () => h(GamePanel, { title: 'Panel' }, { default: () => h('button', { 'data-testid': 'instance' }, 'Action') }) })
    app.mount(host)
    const panel = host.querySelector('.game-panel')!
    const instance = host.querySelector('[data-testid="instance"]')!
    expect(instance.closest('.game-panel')).toBe(panel)
    expect(instance.parentElement).toBe(panel.querySelector('.game-panel__content'))
    expect(panel.querySelector('.game-panel__header')?.parentElement).toBe(panel)
    expect(panel.querySelector('.game-panel__title')?.textContent).toBe('Panel')
    expect(panel.querySelectorAll('h1')).toHaveLength(1)
    app.unmount()
  })
})
