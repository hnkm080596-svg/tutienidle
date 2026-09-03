// @vitest-environment jsdom
// Deferred follow-up Task 2 (2026-09-03) — useDialogFocus trên
// CombatExitConfirmModal: open → focus vào card; Escape = hủy thoát
// (Ở LẠI trận, KHÔNG abandon/exit); Tab cycle không thoát khỏi modal.
// Mount theo pattern CombatExitConfirmModal.test.ts (createApp + h +
// provide mock GameManager, KHÔNG @vue/test-utils).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import CombatExitConfirmModal from './CombatExitConfirmModal.vue'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

interface MockGameManager {
  abandonBattle: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  capturedRequestHandler: (() => void) | null
}

function makeGameManager(): MockGameManager {
  const gm: MockGameManager = {
    abandonBattle: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    capturedRequestHandler: null,
  }

  gm.on.mockImplementation((_type: string, handler: () => void) => {
    gm.capturedRequestHandler = handler
  })

  ;(gm as unknown as { eventBus: MockGameManager }).eventBus = gm

  return gm
}

function mountModal(gm: MockGameManager) {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(CombatExitConfirmModal) })

  app.use(createPinia())
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)

  app.mount(container)

  const ui = useUiStore()
  ui.combatOrigin = 'stage'

  return {
    container,
    ui,
    queryCard: () => container.querySelector('.combat-exit-confirm'),
    open: async () => {
      gm.capturedRequestHandler?.()
      await nextTick()
    },
    buttons: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.combat-exit-confirm button')),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CombatExitConfirmModal — focus trap (deferred follow-up Task 2)', () => {
  it('open → focus vào focusable đầu tiên trong card', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm)

    await modal.open()

    const card = modal.queryCard()

    expect(card).not.toBeNull()
    expect(card!.contains(document.activeElement)).toBe(true)

    modal.unmount()
  })

  it('Escape → đóng modal (Ở LẠI), KHÔNG abandon/exit', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm)
    const exitSpy = vi.spyOn(modal.ui, 'exitCombatScene')

    await modal.open()

    modal.queryCard()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(modal.queryCard()).toBeNull()
    expect(gm.abandonBattle).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
    expect(gm.emit).not.toHaveBeenCalledWith('combat_scene_exit', undefined)

    modal.unmount()
  })

  it('Tab từ nút cuối cycle về nút đầu, không thoát khỏi modal', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm)

    await modal.open()

    const card = modal.queryCard()!
    const focusables = modal.buttons()

    expect(focusables.length).toBe(2)

    focusables[focusables.length - 1]!.focus()
    focusables[focusables.length - 1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await nextTick()

    expect(card.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(focusables[focusables.length - 1])

    modal.unmount()
  })

  it('nút đầu tiên nhận focus là "Ở Lại" (an toàn, không phảiThoát)', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm)

    await modal.open()

    expect(document.activeElement?.tagName).toBe('BUTTON')
    expect(document.activeElement?.querySelector('.game-button__label')?.textContent).toContain(t('combat.overlay.exitConfirm.stay'))

    modal.unmount()
  })
})
