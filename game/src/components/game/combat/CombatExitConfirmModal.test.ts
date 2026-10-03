// @vitest-environment jsdom
// 6A-T6 (2026-09-01) - extract CombatExitConfirmModal: scene exit
// bridge `combat_exit_request` -> modal mo; confirm chay dung luong cu
// (abandonBattle + battleRunMode=manual + combat_scene_exit +
// combat_scene_exit); Tribulation KHONG mo modal.
// Mount theo pattern project (createApp + h + provide, KHONG
// @vue/test-utils - chua cai).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import CombatExitConfirmModal from './CombatExitConfirmModal.vue'
import { AudioManager } from '@/core/audio/AudioManager'
import { useUiStore } from '@/stores/ui'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { i18n } from '@/i18n'

// i18n (2.2 lo 2) - component dung t() nen mount phai cai i18n; assert
// qua i18n.global.t(key) thay vi raw vi string (pattern HomeResourceStrip).
function t(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

interface MockGameManager {
  abandonBattle: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  getTurnBattle: ReturnType<typeof vi.fn>
  capturedRequestHandler: (() => void) | null
}

function makeGameManager(): MockGameManager {
  const gm: MockGameManager = {
    abandonBattle: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    // UI audit 2026-09-28: the modal also gates on a live fighting battle.
    getTurnBattle: vi.fn(() => ({ state: 'fighting' })),
    capturedRequestHandler: null,
  }

  gm.on.mockImplementation((_type: string, handler: () => void) => {
    gm.capturedRequestHandler = handler
  })

  // Modal truy cap qua gameManager.eventBus.on/off/emit - mock shape.
  ;(gm as unknown as { eventBus: MockGameManager }).eventBus = gm

  return gm
}

function mountModal(gm: MockGameManager, origin: 'stage' | 'tribulation' | null = 'stage') {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(CombatExitConfirmModal) })

  const pinia = createPinia()

  app.use(pinia)
  app.use(i18n)
  // Cast mock thanh GameManager - provide typed chat GameManager;
  // mock du shape modal can (eventBus.on/off/emit, abandonBattle).
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)
  // useBattleActions (exitCombatToHome) resolves useStateVersion at setup.
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})

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

  it('request ngoài trạng thái fighting (victory/defeat) KHÔNG mở modal', async () => {
    const gm = makeGameManager()

    gm.getTurnBattle.mockReturnValue({ state: 'victory' })

    const modal = mountModal(gm, 'stage')

    gm.capturedRequestHandler?.()
    await nextTick()

    expect(modal.query()).toBeNull()

    modal.unmount()
  })

  it('confirm "Thoát Trận": abandonBattle + manual + emit combat_scene_exit + đóng', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm, 'stage')

    gm.capturedRequestHandler?.()
    await nextTick()

    await modal.clickButton(t('combat.overlay.exitConfirm.exit'))

    expect(gm.abandonBattle).toHaveBeenCalledOnce()
    expect(modal.ui.battleRunMode).toBe('manual')
    expect(gm.emit).toHaveBeenCalledWith('combat_scene_exit', undefined)
    expect(modal.query()).toBeNull()

    modal.unmount()
  })

  it('cancel "Ở Lại": chỉ đóng, không đụng abandon/exit', async () => {
    const gm = makeGameManager()
    const modal = mountModal(gm, 'stage')

    gm.capturedRequestHandler?.()
    await nextTick()

    await modal.clickButton(t('combat.overlay.exitConfirm.stay'))

    expect(gm.abandonBattle).not.toHaveBeenCalled()
    expect(gm.emit).not.toHaveBeenCalledWith('combat_scene_exit', undefined)
    expect(modal.query()).toBeNull()

    modal.unmount()
  })
})

describe('CombatExitConfirmModal — W7 audio cues', () => {
  it('ui.modal.open on open; ui.confirm+ui.modal.close on exit; ui.cancel+ui.modal.close on stay', async () => {
    const playCue = vi.spyOn(AudioManager.getInstance(), 'playCue').mockImplementation(() => {})
    const gm = makeGameManager()
    const modal = mountModal(gm, 'stage')

    gm.capturedRequestHandler?.()
    await nextTick()
    expect(playCue).toHaveBeenCalledWith('ui.modal.open')

    playCue.mockClear()
    await modal.clickButton(t('combat.overlay.exitConfirm.exit'))
    expect(playCue).toHaveBeenCalledWith('ui.confirm')
    expect(playCue).toHaveBeenCalledWith('ui.modal.close')

    playCue.mockClear()
    gm.capturedRequestHandler?.()
    await nextTick()
    await modal.clickButton(t('combat.overlay.exitConfirm.stay'))
    expect(playCue).toHaveBeenCalledWith('ui.cancel')
    expect(playCue).toHaveBeenCalledWith('ui.modal.close')

    playCue.mockRestore()
    modal.unmount()
  })

  it('a stage-gate rejection (tribulation origin) plays no open cue', async () => {
    const playCue = vi.spyOn(AudioManager.getInstance(), 'playCue').mockImplementation(() => {})
    const gm = makeGameManager()
    const modal = mountModal(gm, 'tribulation')

    gm.capturedRequestHandler?.()
    await nextTick()
    expect(playCue).not.toHaveBeenCalled()

    playCue.mockRestore()
    modal.unmount()
  })
})
