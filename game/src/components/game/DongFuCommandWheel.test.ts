// @vitest-environment jsdom
//
// Command wheel tests (plan "Test plan — Command wheel"):
// - Future slot (available=false) KHÔNG render nút.
// - Shortcut mở đúng leftPanelMode/standalonePanel và ĐÓNG wheel trước.
// - Escape/backdrop click đóng wheel.
// - Ring 4: Tàng Kinh Các TRÁI / Cài Đặt PHẢI đối xứng ngang cùng ring.
// - Building shortcut đi qua building navigation controller.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import DongFuCommandWheel from './DongFuCommandWheel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { getCommandWheelOrbitDirection } from '@/game/support/commandWheelOrbit'
import { i18n } from '@/i18n'

function mountWheel(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    // Khớp production GameRoot: component luôn mount và tự điều khiển
    // visibility bằng ui.isCommandWheelOpen.
    render: () => h('div', [h(DongFuCommandWheel)]),
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())
  app.use(i18n)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  app.mount(container)

  const ui = useUiStore()

  return {
    ui,

    slot: (id: string) => container.querySelector<HTMLButtonElement>(`[data-wheel-slot="${id}"]`),

    slots: () => Array.from(container.querySelectorAll<HTMLButtonElement>('.command-wheel__slot')),

    wheel: () => container.querySelector<HTMLElement>('.command-wheel'),

    layer: () => container.querySelector<HTMLElement>('.command-wheel-layer'),

    backdrop: () => container.querySelector<HTMLElement>('.command-wheel-layer__backdrop'),

    async open() {
      ui.isCommandWheelOpen = true

      await nextTick()
    },

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('DongFuCommandWheel', () => {
  let gameManager: GameManager

  let mounted: ReturnType<typeof mountWheel>

  beforeEach(() => {
    gameManager = new GameManager()

    mounted = mountWheel(gameManager)
  })

  afterEach(() => {
    mounted.unmount()

    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('giữ wheel mounted nhưng ẩn và vô hiệu tương tác khi đóng', () => {
    expect(mounted.wheel()).not.toBeNull()
    expect(mounted.backdrop()).not.toBeNull()
    expect(mounted.slots().length).toBeGreaterThan(0)
    expect(mounted.layer()!.classList.contains('is-visible')).toBe(false)
    expect(mounted.layer()!.getAttribute('aria-hidden')).toBe('true')
  })

  it('mở từ tâm rồi fan-out slot tới offset theo ring ở frame kế tiếp', async () => {
    let frameCallback: FrameRequestCallback | undefined

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallback = callback

      return 1
    })

    await mounted.open()

    const wheel = mounted.wheel()!
    const slot = mounted.slot('character')!

    expect(wheel.classList.contains('is-ready')).toBe(false)
    expect(slot.style.getPropertyValue('--orbit-radius')).not.toBe('')
    expect(slot.style.getPropertyValue('--start-angle')).not.toBe('')
    expect(slot.style.getPropertyValue('--end-angle')).not.toBe('')
    expect(slot.style.transform).toBe('')

    frameCallback?.(16)
    await nextTick()

    expect(wheel.classList.contains('is-ready')).toBe(true)
  })

  it('future slot (Phù) KHÔNG render nút', async () => {
    await mounted.open()

    expect(mounted.slot('talisman_slot')).toBeNull()

    // Slot thật vẫn render đủ.
    expect(mounted.slot('character')).not.toBeNull()
    expect(mounted.slot('scripture_pavilion')).not.toBeNull()
  })

  // Trận Pháp (Combat Art Roster spec, 2026-09-05) — SHIPPED: formation_slot
  // không còn future, render nút mở TranPhapPanel.vue ngay (không có gate
  // disabledReason như phap_bao, mọi trận pháp mở sẵn từ đầu).
  it('slot Trận render và mở được ngay từ đầu', async () => {
    await mounted.open()

    const slot = mounted.slot('formation_slot')

    expect(slot).not.toBeNull()
  })

  // Bản Mệnh Pháp Bảo (2026-08-27) — SHIPPED: slot render ngay (khác
  // talisman_slot vẫn future) nhưng disabled trước Trúc Cơ, xem
  // commandWheelCatalog.ts's phap_bao.disabledReason().
  it('slot Pháp Bảo render nhưng disabled trước Trúc Cơ (Phàm Nhân mặc định)', async () => {
    await mounted.open()

    const slot = mounted.slot('phap_bao')

    expect(slot).not.toBeNull()
    expect(slot!.classList.contains('is-disabled')).toBe(true)
    expect(slot!.getAttribute('aria-disabled')).toBe('true')
  })

  it('shortcut Nhân Vật mở đúng leftPanelMode và đóng wheel', async () => {
    await mounted.open()

    mounted.slot('character')!.click()
    await nextTick()

    expect(mounted.ui.characterOverlayOpen).toBe(true)
    expect(mounted.ui.isCommandWheelOpen).toBe(false)
  })

  it('shortcut Kỹ Năng mở đúng standalonePanel', async () => {
    await mounted.open()

    mounted.slot('skill')!.click()
    await nextTick()

    expect(mounted.ui.standalonePanel).toBe('skill')
    expect(mounted.ui.isCommandWheelOpen).toBe(false)
  })

  it('Escape đóng wheel', async () => {
    await mounted.open()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(mounted.ui.isCommandWheelOpen).toBe(false)
  })

  it('Tab toggle mở và đóng wheel ở Động Phủ', async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    await nextTick()

    expect(mounted.ui.isCommandWheelOpen).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    await nextTick()

    expect(mounted.ui.isCommandWheelOpen).toBe(false)
  })

  it('click vùng trống (backdrop) đóng wheel', async () => {
    await mounted.open()

    mounted.backdrop()!.click()
    await nextTick()

    expect(mounted.ui.isCommandWheelOpen).toBe(false)
  })

  it('giữ wheel trong DOM để chạy cung ngược rồi mới gỡ sau khi đóng', async () => {
    vi.useFakeTimers()

    let frameCallback: FrameRequestCallback | undefined

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallback = callback

      return 1
    })

    await mounted.open()
    frameCallback?.(16)
    await nextTick()

    mounted.ui.closeCommandWheel()
    await nextTick()

    expect(mounted.layer()!.classList.contains('is-visible')).toBe(true)
    expect(mounted.wheel()!.classList.contains('is-closing')).toBe(true)

    vi.advanceTimersByTime(1_000)
    await nextTick()

    expect(mounted.wheel()).not.toBeNull()
    expect(mounted.layer()!.classList.contains('is-visible')).toBe(false)
  })

  it('building chưa xây → shortcut mở popover qua shared authority', async () => {
    gameManager.registerBuildings([
      {
        id: 'pill_room',
        name: 'Đan Phòng',
        category: 'crafting_station',
        tier: 1,
        maxLevel: 3,
        baseStorageCapacity: 0,
        upgradeCost: [[{ materialId: 'go', amount: 1 }]],
      },
    ])

    await mounted.open()

    mounted.slot('pill_room')!.click()
    await nextTick()

    expect(mounted.ui.activeBuildingPopoverId).toBe('pill_room')
    expect(mounted.ui.isCommandWheelOpen).toBe(false)
  })

  it('phân bố shortcut trên hai vòng tròn và xoay xen kẽ ngược/thuận kim đồng hồ', async () => {
    await mounted.open()

    const anchors = mounted.slots()
    const radii = new Set(
      anchors.map((anchor) => Number.parseFloat(anchor.style.getPropertyValue('--orbit-radius'))),
    )
    const innerAnchor = anchors.find((anchor) => anchor.dataset.wheelOrbit === '0')!
    const outerAnchor = anchors.find((anchor) => anchor.dataset.wheelOrbit === '1')!
    const angle = (anchor: HTMLElement, property: '--start-angle' | '--end-angle') =>
      Number.parseFloat(anchor.style.getPropertyValue(property))

    expect(radii.size).toBe(2)
    expect(angle(innerAnchor, '--start-angle')).toBeGreaterThan(angle(innerAnchor, '--end-angle'))
    expect(angle(outerAnchor, '--start-angle')).toBeLessThan(angle(outerAnchor, '--end-angle'))
    expect(getCommandWheelOrbitDirection(0)).toBe('counterclockwise')
    expect(getCommandWheelOrbitDirection(1)).toBe('clockwise')
    expect(getCommandWheelOrbitDirection(2)).toBe('counterclockwise')

    expect(mounted.slot('scripture_pavilion')!.getAttribute('aria-label')).toBe('Tàng Kinh Các')
  })
})
