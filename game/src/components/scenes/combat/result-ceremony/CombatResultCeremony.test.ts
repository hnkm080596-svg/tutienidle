// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { i18n } from '@/i18n'
import CombatResultCeremony from './CombatResultCeremony.vue'

let cleanup: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function mountResult(outcome: 'victory' | 'defeat' = 'victory') {
  const action = vi.fn()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({
    render: () =>
      h(
        CombatResultCeremony,
        {
          outcome,
          stageName: 'Test stage',
          fast: false,
          slots: [{ id: 'spirit_stone', kind: 'currency', icon: null, name: 'Stone', amount: 128 }],
          growth: [],
        },
        { actions: () => h('button', { onClick: action }, 'Continue') },
      ),
  })
  app.use(i18n)
  app.mount(container)
  cleanup = () => {
    app.unmount()
    container.remove()
  }
  return { container, action }
}

describe('ceremony variant interaction', () => {
  it('does not install dialog listeners after an immediate result replacement', async () => {
    const addListener = vi.spyOn(document, 'addEventListener')
    mountResult()
    cleanup?.()
    cleanup = undefined
    await nextTick()
    expect(addListener.mock.calls.filter(([name]) => name === 'mousedown')).toHaveLength(0)
    addListener.mockRestore()
  })
  it('first action gesture reveals totals, second performs the action exactly once', async () => {
    const { container, action } = mountResult()
    expect(container.querySelector('[data-reward-id]')?.textContent?.trim()).toBe('+0')
    container.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    expect(action).not.toHaveBeenCalled()
    expect(container.querySelector('[data-reward-id]')?.textContent?.trim()).toBe('+128')
    await vi.advanceTimersByTimeAsync(16)
    container.querySelector<HTMLButtonElement>('button')!.click()
    expect(action).toHaveBeenCalledOnce()
  })

  it.each(['victory', 'defeat'] as const)(
    'keeps the shipped %s title PNG unchanged and keyboard focus contained',
    async (outcome) => {
      const { container } = mountResult(outcome)
      await nextTick()
      expect(container.querySelector('img')?.getAttribute('src')).toContain(
        `${outcome}-v2/${outcome}-title-v1.png`,
      )
      const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
      expect(dialog.classList.contains('combat-defeat-panel')).toBe(false)
      expect(dialog.classList.contains('combat-victory-panel')).toBe(false)
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()
      expect(dialog.dataset.complete).toBe('true')
      expect(container.querySelector('[data-reward-id]')?.getAttribute('aria-label')).toBe('+128')
      expect(dialog.contains(document.activeElement)).toBe(true)
    },
  )
})
