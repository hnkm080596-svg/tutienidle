// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App, type Ref } from 'vue'
import ConfirmModal from './ConfirmModal.vue'
import OverlayPanel from './OverlayPanel.vue'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mountToBody(render: () => ReturnType<typeof h>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render })
  app.mount(container)
  mounted.push({ app, container })
  return container
}

function mountOverlayPanel(open: Ref<boolean>, onClose?: () => void) {
  return mountToBody(() => h(OverlayPanel, { open: open.value, title: 'Đối thoại', onClose }, {
    default: () => [
      h('button', { class: 'slot-a' }, 'Nút Một'),
      h('button', { class: 'slot-b' }, 'Nút Hai'),
    ],
  }))
}

function mountConfirmModal(
  open: Ref<boolean>,
  handlers: { onCancel?: () => void; onConfirm?: () => void },
) {
  return mountToBody(() => h(ConfirmModal, {
    open: open.value,
    title: 'Xác nhận',
    message: 'Chắc chưa?',
    ...handlers,
  }))
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
  document.body.innerHTML = ''
})

describe('dialog focus management (Task 9.3, QA-003)', () => {
  it('OverlayPanel: open → focus vào focusable đầu tiên trong dialog', async () => {
    const open = ref(true)
    const container = mountOverlayPanel(open)
    await nextTick()

    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('OverlayPanel: Escape → emit close', async () => {
    const onClose = vi.fn()
    const open = ref(true)
    const container = mountOverlayPanel(open, onClose)
    await nextTick()

    container.querySelector('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('OverlayPanel: Tab cycle không thoát khỏi dialog', async () => {
    const open = ref(true)
    const container = mountOverlayPanel(open)
    await nextTick()

    const dialog = container.querySelector('[role="dialog"]')!
    const focusables = dialog.querySelectorAll('button')
    expect(focusables.length).toBeGreaterThanOrEqual(2)
    focusables[0]!.focus()
    focusables[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await nextTick()

    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(focusables[0])
  })

  it('OverlayPanel: close → restore focus về trigger', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const open = ref(true)
    mountOverlayPanel(open)
    await nextTick()
    open.value = false
    await nextTick()

    expect(document.activeElement).toBe(trigger)
  })

  it('ConfirmModal: Escape → emit cancel (KHÔNG phải confirm)', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const open = ref(true)
    const container = mountConfirmModal(open, { onCancel, onConfirm })
    await nextTick()

    container.querySelector('[role="alertdialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
