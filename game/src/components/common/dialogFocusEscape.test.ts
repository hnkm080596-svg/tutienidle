// @vitest-environment jsdom
// Adversarial QA: Escape propagation semantics of useDialogFocus (QA-003 quick).
// The composable stopPropagation()s Escape at the card (brief-specified isolation:
// background window/document handlers must not react to modal Escape). These tests
// document both sides of that trade-off.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App, type Ref } from 'vue'
import OverlayPanel from './OverlayPanel.vue'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mountOverlayPanel(open: Ref<boolean>, onClose?: () => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(OverlayPanel, { open: open.value, title: 'Túi Đồ', onClose }, {
    default: () => [h('button', {}, 'Nút')],
  }) })
  app.mount(container)
  mounted.push({ app, container })
  return container
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
  document.body.innerHTML = ''
})

describe('useDialogFocus Escape propagation (QA-003 quick)', () => {
  it('Escape on dialog card is isolated: document-level handlers do NOT receive it', async () => {
    const documentEscapeSpy = vi.fn()
    document.addEventListener('keydown', documentEscapeSpy)
    try {
      const onClose = vi.fn()
      const open = ref(true)
      const container = mountOverlayPanel(open, onClose)
      await nextTick()

      container.querySelector('[role="dialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(documentEscapeSpy).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', documentEscapeSpy)
    }
  })

  it('Escape with focus outside the card (body) does not close; card Escape still closes', async () => {
    const onClose = vi.fn()
    const open = ref(true)
    const container = mountOverlayPanel(open, onClose)
    await nextTick()
    ;(document.activeElement as HTMLElement | null)?.blur()

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).not.toHaveBeenCalled()

    container.querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
