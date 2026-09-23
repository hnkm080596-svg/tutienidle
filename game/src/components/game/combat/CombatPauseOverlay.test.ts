// @vitest-environment jsdom
// Task 8 (A11) — pause overlay's only behaviour is emitting 'continue' when
// the player presses the button; useCombatPause.ts owns the freeze/resume
// wiring itself (unit-tested separately).
// Mount theo pattern project (createApp + h, KHÔNG @vue/test-utils — chưa
// cài, xem CombatCountdownOverlay.test.ts / CombatDefeatPanel.test.ts).
import { describe, expect, it, vi, afterEach } from 'vitest'
import { createApp, h } from 'vue'
import CombatPauseOverlay from './CombatPauseOverlay.vue'
import { i18n } from '@/i18n'

function mountOverlay(onContinue: () => void) {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({
    render: () => h(CombatPauseOverlay, { onContinue }),
  })

  app.use(i18n)
  app.mount(container)

  return { container, app }
}

describe('CombatPauseOverlay', () => {
  let mounted: { container: HTMLElement; app: ReturnType<typeof createApp> } | null = null

  afterEach(() => {
    mounted?.app.unmount()
    mounted?.container.remove()
    mounted = null
  })

  it('emits continue when the button is pressed', () => {
    const onContinue = vi.fn()

    mounted = mountOverlay(onContinue)

    // SysModalBase teleports to body - query the document, not the container.
    const button = document.body.querySelector('[data-testid="combat-pause-continue"]')

    expect(button).not.toBeNull()

    button?.dispatchEvent(new Event('click', { bubbles: true }))

    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
