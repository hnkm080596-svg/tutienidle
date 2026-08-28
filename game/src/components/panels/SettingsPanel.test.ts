// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import SettingsPanel from './SettingsPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'

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
