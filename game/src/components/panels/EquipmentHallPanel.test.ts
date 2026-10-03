// @vitest-environment jsdom
// Scene-12 fidelity update: the production surface mounts the approved
// paper composition - workspace tab bar [Trang Bi | ops | Tui Do] in
// the right region, doll + summary through the fidelity slots. This
// file verifies: the tab bar renders the view tab + all 5 op tabs +
// the bag tab, switching swaps the mounted child, and each <XTab/>
// actually mounts under its tab. Per-tab behavior tests stay in
// src/components/panels/equipment-hall/*Tab.test.ts.
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
      stat: 'might',
      flat: 12,
    },
  })
}

function mountHall(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
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

// Workspace order: Trang Bi view tab first, then the op tabs in contract
// order, then the Tui Do bag tab (beta gating happens in the surface;
// the test env unlocks all).
const TAB = {
  equip: 0,
  enhance: 1,
  wash: 2,
  refine: 3,
  dissolve: 4,
  decompose: 5,
  bag: 6,
} as const

describe('EquipmentHallPanel - fidelity surface: workspace tabs + switching', () => {
  it('render Trang Bi tab + du 5 op tab + Tui Do tab trong workspace', () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')

    expect(tabs).toHaveLength(7)
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual([
      'Trang Bị',
      'Cường Hóa',
      'Tẩy Luyện',
      'Tinh Luyện',
      'Hóa Luyện',
      'Phân Giải',
      'Túi Đồ',
    ])

    mounted.unmount()
  })

  it('mac dinh mount item detail (Trang Bi), chua mount EnhanceTab', () => {
    const mounted = mountHall()

    expect(mounted.container.querySelector('.equipment-item-detail')).not.toBeNull()
    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()

    mounted.unmount()
  })

  it('tab Cuong Hoa -> mount EnhanceTab (slot cuong hoa)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.enhance]!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('tab Tay Luyen -> mount WashTab (unmount detail)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.wash]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    expect(mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tẩy luyện"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('tab Tinh Luyen -> mount RefineTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.refine]!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tinh luyện"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('tab Hoa Luyen -> mount DissolveTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.dissolve]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.dissolve-filters')).not.toBeNull()

    mounted.unmount()
  })

  it('tab Phan Giai -> mount DecomposeTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.decompose]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.decompose-tab')).not.toBeNull()

    mounted.unmount()
  })

  it('tab Tui Do -> mount canonical BagGrid', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.bag]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.equipment-item-detail')).toBeNull()
    expect(mounted.container.querySelector('[data-hk-region="bag-grid"]')).not.toBeNull()

    mounted.unmount()
  })

  it('tab Trang Bi quay ve detail (round-trip)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-workspace nav button')
    tabs[TAB.enhance]!.click()
    await nextTick()
    tabs[TAB.equip]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    expect(mounted.container.querySelector('.equipment-item-detail')).not.toBeNull()

    mounted.unmount()
  })
})
