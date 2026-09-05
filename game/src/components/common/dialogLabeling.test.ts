// @vitest-environment jsdom
//
// Remediation Task 6 (2026-09-05) — dialog labeling: title/description
// phải được tham chiếu qua aria-labelledby/aria-describedby (screen
// reader đọc đúng tên + mô tả dialog) thay vì chỉ aria-label. ConfirmModal
// expose thêm description qua aria-describedby; OverlayPanel gắn
// aria-labelledby tới heading h3. Stable per-instance ID (useId) — nhiều
// dialog đồng thời không trùng ID tĩnh.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
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

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
  document.body.innerHTML = ''
})

describe('dialog labeling (Remediation Task 6)', () => {
  it('ConfirmModal: alertdialog có aria-labelledby → title element + aria-describedby → message element', async () => {
    const open = ref(true)
    const container = mountToBody(() =>
      h(ConfirmModal, { open: open.value, title: 'Xác nhận', message: 'Chắc chắn?' }),
    )
    await nextTick()

    const dialog = container.querySelector<HTMLElement>('[role="alertdialog"]')!

    expect(dialog).toBeDefined()

    const labelledBy = dialog.getAttribute('aria-labelledby')

    expect(labelledBy).toBeTruthy()

    const titleEl = document.getElementById(labelledBy!)

    expect(titleEl?.textContent).toBe('Xác nhận')

    const describedBy = dialog.getAttribute('aria-describedby')

    expect(describedBy).toBeTruthy()

    const messageEl = document.getElementById(describedBy!)

    expect(messageEl?.textContent).toBe('Chắc chắn?')
  })

  it('OverlayPanel: dialog có aria-labelledby → heading element', async () => {
    const open = ref(true)
    const container = mountToBody(() =>
      h(OverlayPanel, { open: open.value, title: 'Hồi thoại' }),
    )
    await nextTick()

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!

    expect(dialog).toBeDefined()

    const labelledBy = dialog.getAttribute('aria-labelledby')

    expect(labelledBy).toBeTruthy()

    const headingEl = document.getElementById(labelledBy!)

    expect(headingEl?.textContent).toContain('Hồi thoại')
  })

  it('2 ConfirmModal đồng thời → ID KHÔNG trùng (per-instance)', async () => {
    const openA = ref(true)
    const openB = ref(true)
    const container = mountToBody(() =>
      h('div', [
        h(ConfirmModal, { open: openA.value, title: 'A', message: 'mA' }),
        h(ConfirmModal, { open: openB.value, title: 'B', message: 'mB' }),
      ]),
    )
    await nextTick()

    const dialogs = container.querySelectorAll<HTMLElement>('[role="alertdialog"]')

    expect(dialogs).toHaveLength(2)

    const ids = [...dialogs].map((dialog) => dialog.getAttribute('aria-labelledby'))

    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })
})
