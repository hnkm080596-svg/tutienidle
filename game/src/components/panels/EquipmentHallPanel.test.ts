// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) — shell now only owns
// the tab bar + shared HALL_SELECTION_KEY provide(); per-tab behavior
// tests moved to src/components/panels/equipment-hall/*Tab.test.ts.
// This file only verifies: tab-bar renders all 5 tabs, switching tabs
// swaps the mounted child, and each <XTab/> actually mounts under its
// corresponding activeTab.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentHallPanel from './EquipmentHallPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { materials } from '@/data/materials/materials'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'

function equipmentInstance(instanceId: string, equipped: boolean): EquipmentInstance {
  return makeInstance({
    instanceId,
    itemId: 'base_kiem',
    equipped,
    grade: 'cuu_pham',
    quality: 'hoang',
    realmLevel: 1,
    mainStat: {
      id: `${instanceId}:main`,
      sourceId: instanceId,
      sourceType: 'equipment',
      stat: 'attack',
      flat: 12,
    },
  })
}

function mountHall(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.registerMaterials(materials)
  manager.registerEquipment(equipment)
  manager.registerAffixes(affixes)
  manager.equipmentBag.add(equipmentInstance('equipped', true))
  manager.equipmentBag.add(equipmentInstance('in-bag', false))
  prepare?.(manager)

  const app = createApp({ render: () => h(EquipmentHallPanel) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => app.unmount() }
}

// jsdom không có ResizeObserver — usePanelPagination (tab Hóa Luyện)
// tạo observer khi container render; stub theo pattern InventorySort.test.ts.
beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('EquipmentHallPanel — shell: tab bar + tab switching', () => {
  it('render đủ 5 tab trong TabBar', () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')

    expect(tabs).toHaveLength(5)
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual([
      'Cường Hóa',
      'Tẩy Luyện',
      'Tinh Luyện',
      'Hóa Luyện',
      'Phân Giải',
    ])

    mounted.unmount()
  })

  it('mặc định mount EnhanceTab (slot cường hóa)', () => {
    const mounted = mountHall()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('chuyển tab Tẩy Luyện → mount WashTab (unmount EnhanceTab)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    expect(mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tẩy luyện"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('chuyển tab Tinh Luyện → mount RefineTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[2]!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tinh luyện"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('chuyển tab Hóa Luyện → mount DissolveTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[3]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.dissolve-filters')).not.toBeNull()

    mounted.unmount()
  })

  it('chuyển tab Phân Giải → mount DecomposeTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[4]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.decompose-tab')).not.toBeNull()

    mounted.unmount()
  })

  it('quay lại tab Cường Hóa vẫn mount đúng EnhanceTab (round-trip)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click()
    await nextTick()
    tabs[0]!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })
})
