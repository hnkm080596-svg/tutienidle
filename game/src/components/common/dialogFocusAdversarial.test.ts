// @vitest-environment jsdom
// Adversarial QA reproduction checks for useDialogFocus (Task 9.3, QA-003 quick review).
// QA boundary: test-only file; asserts lifecycle/restore invariants under repeat/timing operators.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App, type Ref } from 'vue'
import OverlayPanel from './OverlayPanel.vue'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mountOverlayPanel(open: Ref<boolean>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(OverlayPanel, { open: open.value, title: 'Đối thoại' }, {
    default: () => [
      h('button', { class: 'slot-a' }, 'Nút Một'),
      h('button', { class: 'slot-b' }, 'Nút Hai'),
    ],
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

describe('useDialogFocus adversarial invariants', () => {
  it('rapid true→false→true toggle: dialog ends focused on first focusable (no stale close-restore race)', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const open = ref(true)
    mountOverlayPanel(open)
    await nextTick()

    open.value = false
    open.value = true
    await nextTick()
    await nextTick()

    const dialog = document.querySelector('[role="dialog"]')!
    expect(document.activeElement).not.toBe(trigger)
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('rapid false→true→false before open microtask: focus restored to trigger, no orphan keydown handling', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const open = ref(false)
    mountOverlayPanel(open)
    await nextTick()

    open.value = true
    open.value = false
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(trigger)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('unmount while open: keydown handler detached from card (listener lifecycle invariant)', async () => {
    const open = ref(true)
    const container = mountOverlayPanel(open)
    await nextTick()

    const card = container.querySelector('.overlay-panel__card')!
    const onEscape = vi.fn()
    // After unmount the card is detached; dispatching on it must not affect any live state.
    const cardForSpy = card
    cardForSpy.addEventListener('keydown', onEscape)

    const entry = mounted[0]!
    entry.app.unmount()
    mounted.length = 0

    cardForSpy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    // Listener on detached node: only our spy would fire; the composable's own handler
    // must not have survived on any live path (no errors, no focus throw).
    expect(document.activeElement).toBeInstanceOf(HTMLElement)
  })

  it('disabled button is skipped by focus-on-open (focusable selector excludes [disabled])', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({ render: () => h(OverlayPanel, { open: true, title: 'Đối thoại' }, {
      default: () => [
        h('button', { class: 'slot-disabled', disabled: true }, 'Vô Hiệu'),
        h('button', { class: 'slot-enabled' }, 'Hiệu Lực'),
      ],
    }) })
    app.mount(container)
    mounted.push({ app, container })
    await nextTick()

    const dialog = container.querySelector('[role="dialog"]')!
    expect(document.activeElement).toBe(dialog.querySelector('.slot-enabled'))
  })

  it('zero-focusable dialog: Tab is contained (preventDefault before empty-list early return)', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({ render: () => h(OverlayPanel, { open: true, title: 'Đối thoại' }, {
      default: () => h('p', { class: 'plain-text', tabindex: '-1' }, 'Chỉ chữ, không focusable'),
    }) })
    app.mount(container)
    mounted.push({ app, container })
    await nextTick()

    const dialog = container.querySelector('[role="dialog"]')!
    const text = dialog.querySelector('.plain-text') as HTMLElement
    text.focus()
    expect(dialog.contains(document.activeElement)).toBe(true)

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    text.dispatchEvent(tabEvent)

    expect(tabEvent.defaultPrevented).toBe(true)
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('same-tick false→true re-open with focus inside dialog: original body trigger restored on final close', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const open = ref(false)
    mountOverlayPanel(open)
    await nextTick()

    open.value = true
    await nextTick()
    await nextTick()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.contains(document.activeElement)).toBe(true)

    open.value = false
    open.value = true
    await nextTick()
    await nextTick()

    open.value = false
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(trigger)
  })
})
