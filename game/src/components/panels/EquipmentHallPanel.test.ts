// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) — shell now only owns
// the tab bar + shared HALL_SELECTION_KEY provide(); per-tab behavior
// tests moved to src/components/panels/equipment-hall/*Tab.test.ts.
// This file only verifies: the ops rail renders the view seal + all 5
// op tabs, switching workspaces swaps the mounted child, and each
// <XTab/> actually mounts under its corresponding seal.
//
// Scene-12 scaffold update (reason: ref 12-equipment.jpg shows the
// equipment scene opening on the item DETAIL card - "Trang Bi" state -
// with the ops rail as seals on the left). The rail gains a view seal
// before the op seals, so tab count is 6 (was 5) and op indexes shift
// +1; the default workspace is the detail card, not EnhanceTab.
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

// Rail order: Trang Bị view seal first, then the op seals in contract
// order (beta gating happens in the scene; the test env unlocks all).
const SEAL = {
  view: 0,
  enhance: 1,
  wash: 2,
  refine: 3,
  dissolve: 4,
  decompose: 5,
} as const

describe('EquipmentHallPanel — shell: ops rail + workspace switching', () => {
  it('render view seal + đủ 5 op seal trong rail', () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')

    expect(tabs).toHaveLength(6)
    // Label span only - the decorative glyph is aria-hidden text.
    expect(
      Array.from(tabs).map((t) => t.querySelector('.equipment-ops-seal__label')?.textContent?.trim()),
    ).toEqual([
      'Trang Bị',
      'Cường Hóa',
      'Tẩy Luyện',
      'Tinh Luyện',
      'Hóa Luyện',
      'Phân Giải',
    ])

    mounted.unmount()
  })

  it('mặc định mount detail card (Trang Bị), chưa mount EnhanceTab', () => {
    const mounted = mountHall()

    // Detail workspace quotes the equipped fixture via the shared
    // ItemCardBody; the enhance workspace stays unmounted until its seal.
    expect(mounted.container.querySelector('[data-hk-region="item-card"]')).not.toBeNull()
    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()

    mounted.unmount()
  })

  it('seal Cường Hóa → mount EnhanceTab (slot cường hóa)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[SEAL.enhance]!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('seal Tẩy Luyện → mount WashTab (unmount detail card)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[SEAL.wash]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    expect(mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tẩy luyện"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('seal Tinh Luyện → mount RefineTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[SEAL.refine]!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tinh luyện"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('seal Hóa Luyện → mount DissolveTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[SEAL.dissolve]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.dissolve-filters')).not.toBeNull()

    mounted.unmount()
  })

  it('seal Phân Giải → mount DecomposeTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[SEAL.decompose]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.decompose-tab')).not.toBeNull()

    mounted.unmount()
  })

  it('seal Trang Bị quay về detail card (round-trip)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[SEAL.enhance]!.click()
    await nextTick()
    tabs[SEAL.view]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    expect(mounted.container.querySelector('.equipment-item-detail')).not.toBeNull()

    mounted.unmount()
  })
})
