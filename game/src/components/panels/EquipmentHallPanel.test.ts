// @vitest-environment jsdom
// Scene-12 rail rework (2026-10-04 owner ruling): the right region is
// [Trang Bi gear grid | Cuong Hoa | Tay Luyen | Tinh Luyen | Hoa Luyen |
// Phan Giai] - no Tui Do workspace mode, no item detail card; the gear
// grid is the canonical EquipmentBagSection (equip-on-click, sockets
// stay in the doll region). Scope-hidden ops keep a DISABLED shell in
// the nav (tab shown, op locked) - this file verifies: the rail renders
// all 6 seals, switching swaps the mounted child, locked ops are
// disabled + refuse activation, and the equip tab mounts the gear grid.
// Per-tab behavior tests stay in
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
import { lockBetaFeaturesForTests, unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

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

// jsdom khong co ResizeObserver - useBagGridLayout (gear grid) +
// usePanelPagination (tab Hoa Luyen) tao observer khi container render;
// stub theo pattern InventorySort.test.ts.
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
  // The global setup unlocks all features; a test that locks must put
  // them back so the next test mounts the admitted surface.
  unlockAllFeaturesForTests()
})

// Rail order (2026-10-04): Trang Bi gear grid first, then the op
// seals in contract order. No bag tab. Owner ruling 2026-10-08:
// Phan Giai (decompose) left the rail for the Kho Vat surface.
const TAB = {
  equip: 0,
  enhance: 1,
  wash: 2,
  refine: 3,
  dissolve: 4,
} as const

describe('EquipmentHallPanel - fidelity surface: rail tabs + switching', () => {
  it('render Trang Bi tab + du 4 op tab (khong con Tui Do, Phan Giai da chuyen sang Kho Vat)', () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')

    expect(tabs).toHaveLength(5)
    expect(Array.from(tabs).map((t) => t.textContent?.trim())).toEqual([
      'Trang Bị',
      'Cường Hóa',
      'Tẩy Luyện',
      'Tinh Luyện',
      'Hóa Luyện',
    ])

    mounted.unmount()
  })

  it('mac dinh mount gear grid (Trang Bi): .bag-section hien do chua mac', () => {
    const mounted = mountHall()

    const grid = mounted.container.querySelector('.bag-section__grid')

    expect(grid).not.toBeNull()
    // The gear grid pads out its page; the unequipped fixture instance
    // lands in a slot while the equipped one stays out of the bag list.
    expect(mounted.container.querySelectorAll('.bag-section__grid .slot-view').length).toBeGreaterThan(0)
    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()

    mounted.unmount()
  })

  it('tab Cuong Hoa -> mount EnhanceTab (slot cuong hoa), gear grid unmount', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')
    tabs[TAB.enhance]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.bag-section')).toBeNull()
    // New chrome (owner ruling): a single preview cell shows the SLOT
    // name, gear is picked straight off the doll - no 6-cell picker.
    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"].enhance-slot-single')).toHaveLength(1)

    mounted.unmount()
  })

  it('tab Tay Luyen -> mount WashTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')
    tabs[TAB.wash]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    // New chrome: before->after affix grid, no slot strip - mount by root.
    expect(mounted.container.querySelector('.forge-wash')).not.toBeNull()

    mounted.unmount()
  })

  it('tab Tinh Luyen -> mount RefineTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')
    tabs[TAB.refine]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.forge-refine')).not.toBeNull()

    mounted.unmount()
  })

  it('tab Hoa Luyen -> mount DissolveTab', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')
    tabs[TAB.dissolve]!.click()
    await nextTick()

    expect(mounted.container.querySelector('.dissolve-filters')).not.toBeNull()

    mounted.unmount()
  })

  it('Phan Giai khong con trong rail (da chuyen sang Kho Vat)', () => {
    const mounted = mountHall()

    const labels = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button'),
    ).map((t) => t.textContent?.trim())

    expect(labels).not.toContain('Phân Giải')
    expect(mounted.container.querySelector('.decompose-tab')).toBeNull()

    mounted.unmount()
  })

  it('tab Trang Bi quay ve gear grid (round-trip)', async () => {
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')
    tabs[TAB.enhance]!.click()
    await nextTick()
    tabs[TAB.equip]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn slot cường hóa"]')).toBeNull()
    expect(mounted.container.querySelector('.bag-section__grid')).not.toBeNull()

    mounted.unmount()
  })

  it('scope-locked ops: seal hien nhung disabled, click khong mount op', async () => {
    lockBetaFeaturesForTests()
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.equipment-tabs button')

    // All 5 seals still render; enhance/dissolve stay admitted (beta-
    // shipped), wash/refine disable.
    expect(tabs).toHaveLength(5)
    expect(tabs[TAB.enhance]!.disabled).toBe(false)
    expect(tabs[TAB.dissolve]!.disabled).toBe(false)
    expect(tabs[TAB.wash]!.disabled).toBe(true)
    expect(tabs[TAB.refine]!.disabled).toBe(true)

    // A disabled seal cannot activate its workspace even if clicked.
    tabs[TAB.wash]!.click()
    await nextTick()

    expect(mounted.container.querySelector('[aria-label="Chọn trang bị để tẩy luyện"]')).toBeNull()
    expect(mounted.container.querySelector('.bag-section__grid')).not.toBeNull()

    mounted.unmount()
  })
})
