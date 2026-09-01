// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import SettingsPanel from './SettingsPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { useNotificationStore } from '@/stores/notification'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('SettingsPanel reset save', () => {
  it('yêu cầu App dừng autosave trước khi xóa save', async () => {
    const container = document.createElement('div')
    const app = createApp({ render: () => h(SettingsPanel) })
    const requested = vi.fn()

    document.body.appendChild(container)
    app.use(createPinia())
    app.provide(GAME_MANAGER_KEY, new GameManager())
    window.addEventListener(SAVE_RESET_REQUEST_EVENT, requested)
    app.mount(container)

    // ConfirmModal thay window.confirm() native (UI/UX rework) — bấm nút
    // reset chỉ MỞ modal, phải bấm "Xác Nhận" trong ConfirmModal mới thật
    // sự dispatch event.
    container.querySelector<HTMLButtonElement>('.settings-panel__danger')!.click()
    await nextTick()

    expect(requested).not.toHaveBeenCalled()

    container.querySelector<HTMLButtonElement>('.confirm-modal__confirm')!.click()
    await nextTick()

    expect(requested).toHaveBeenCalledOnce()

    window.removeEventListener(SAVE_RESET_REQUEST_EVENT, requested)
    app.unmount()
  })
})

describe('SettingsPanel — toast kind khi save thất bại', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    localStorage.clear()
  })

  function mountPanel() {
    const container = document.createElement('div')
    const app = createApp({ render: () => h(SettingsPanel) })

    document.body.appendChild(container)
    app.use(createPinia())
    app.provide(GAME_MANAGER_KEY, new GameManager())
    app.mount(container)

    return {
      container,

      saveButton: () =>
        container.querySelector<HTMLButtonElement>('[data-testid="settings-save-button"]')!,

      unmount: () => {
        app.unmount()
        container.remove()
      },
    }
  }

  it('Lưu thất bại (quota) → toast kind "error" đỏ, không còn kind "save" xanh', async () => {
    // Audit fix 2026-08-31 — Task 2 để failure toast kind 'save' (màu
    // xanh nhạt) trong khi App.vue autosave fail push kind 'error'
    // (đỏ); thông báo thất bại phải đồng nhất màu đỏ để người chơi
    // nhận biết mất nguy cơ.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const mounted = mountPanel()
    const notification = useNotificationStore()

    mounted.saveButton().click()

    // handleSave await cả chuỗi coordinator → service → writeGameSave;
    // setTimeout(0) chờ hết chuỗi microtask trước khi assert.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Failure toast phải là kind 'error' (đỏ), không phải 'save' (xanh).
    const failureToast = notification.toasts.find(
      (toast) => toast.message.includes('Không lưu được'),
    )

    expect(failureToast).toBeDefined()
    expect(failureToast!.kind).toBe('error')

    mounted.unmount()
  })
})
