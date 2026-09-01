// @vitest-environment jsdom
// 6A-T6 (2026-09-01) — extract CombatExitConfirmModal: scene exit
// bridge `combat_exit_request` → modal mở; confirm chạy đúng luồng cũ
// (abandonBattle + battleRunMode=manual + exitCombatScene +
// combat_scene_exit); Tribulation KHÔNG mở modal.
// Mount theo pattern project (createApp + h + provide, KHÔNG
// @vue/test-utils — chưa cài).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import CombatExitConfirmModal from './CombatExitConfirmModal.vue'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'

interface MockGameManager {
  abandonBattle: ReturnType<typeof vi.fn>
  exitCombatScene: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  capturedRequestHandler: (() => void) | null
}

function makeGameManager(): MockGameManager {
  const gm: MockGameManager = {
    abandonBattle: vi.fn(),
    exitCombatScene: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    capturedRequestHandler: null,
  }

  gm.on.mockImplementation((_type: string, handler: () => void) => {
    gm.capturedRequestHandler = handler
  })

  // Modal truy cập qua gameManager.eventBus.on/off/emit — mock shape.
  ;(gm as unknown as { eventBus: MockGameManager }).eventBus = gm

  return gm
}

function mountModal(gm: MockGameManager, origin: 'stage' | 'tribulation' | null = 'stage') {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(CombatExitConfirmModal) })

  const pinia = createPinia()

  app.use(pinia)
  // Cast mock thành GameManager — provide typed chặt GameManager;
  // mock đủ shape modal cần (eventBus.on/off/emit, abandonBattle).
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)

  app.mount(container)

  // Set combatOrigin sau pinia active (store getter qua mount context).
  const ui = useUiStore(pinia)

  ui.combatOrigin = origin

  return {
    container,
    ui,
    query: () => container.querySelector('.combat-exit-confirm'),
    clickButton: async (label: string) => {
      const buttons = Array.from(container.querySelectorAll('button'))
      const target = buttons.find((b) => b.textContent?.includes(label))

      if (!target) {
        throw new Error(`button "${label}" không tồn tại`)
      }

      target.click()
      await nextTick()
    },
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

describe('CombatExitConfirmModal — extract (6A-T6)', () => {
  it('render chỉ khi combat_exit_request emit VÀ origin === stage', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm, 'stage')

    expect(modal.query()).toBeNull()

    gm.capturedRequestHandler?.()
    await nextTick()

    expect(modal.query()).not.toBeNull()

    modal.unmount()
  })

  it('Tribulation KHÔNG mở modal (gate combatOrigin)', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm, 'tribulation')

    gm.capturedRequestHandler?.()
    await nextTick()

    expect(modal.query()).toBeNull()

    modal.unmount()
  })

  it('confirm "Thoát Trận": abandonBattle + manual + ui.exitCombatScene + emit combat_scene_exit + đóng', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm, 'stage')

    // ui.exitCombatScene là action trên UI store — spy store, KHÔNG mock gm.
    const exitSpy = vi.spyOn(modal.ui, 'exitCombatScene')

    gm.capturedRequestHandler?.()
    await nextTick()

    await modal.clickButton('Thoát Trận')

    expect(gm.abandonBattle).toHaveBeenCalledOnce()
    expect(modal.ui.battleRunMode).toBe('manual')
    expect(exitSpy).toHaveBeenCalledOnce()
    expect(gm.emit).toHaveBeenCalledWith('combat_scene_exit', undefined)
    expect(modal.query()).toBeNull()

    modal.unmount()
  })

  it('cancel "Ở Lại": chỉ đóng, không đụng abandon/exit', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm, 'stage')

    const exitSpy = vi.spyOn(modal.ui, 'exitCombatScene')

    gm.capturedRequestHandler?.()
    await nextTick()

    await modal.clickButton('Ở Lại')

    expect(gm.abandonBattle).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
    expect(modal.query()).toBeNull()

    modal.unmount()
  })
})
