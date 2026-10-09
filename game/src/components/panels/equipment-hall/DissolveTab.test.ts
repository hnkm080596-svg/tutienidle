// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) - DissolveTab extracted
// from EquipmentHallPanel.test.ts. Fully self-contained (own multi-select,
// no HALL_SELECTION_KEY needed).
//
// Filter contract v2 (owner ruling 2026-10-09): the card's own
// grade/quality selects are gone - the embedded bag's Loai-item
// dropdown is the only filter, reported back via the 'filtered' emit
// so Chon Tat Ca scopes to the visible set. The old
// grade/quality-select tests are replaced by coverage of that
// visible-set contract.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import DissolveTab from './DissolveTab.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { materials } from '@/data/materials/materials'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'
import { ITEM_QUALITY_FORGE_USES } from '@/core/equipment/ItemQualityBalance'

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

/** Instance voi itemId tuy y - registry miss (save lech data, audit fix
 * 2026-08-31): candidate van phai liet ke, khong throw. */
function equipmentInstanceWithItemId(
  instanceId: string,
  itemId: string,
  equipped: boolean,
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, equipped)

  instance.itemId = itemId

  return instance
}

/** Instance voi quality tuy y - dung test dropdown Chat (merged). */
function equipmentInstanceWithQuality(
  instanceId: string,
  quality: EquipmentInstance['quality'],
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, false)

  instance.quality = quality
  instance.forgeUsesTotal = ITEM_QUALITY_FORGE_USES[quality]
  instance.forgeUsesRemaining = ITEM_QUALITY_FORGE_USES[quality]

  return instance
}

function mountTab(prepare?: (manager: GameManager) => void) {
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

  const app = createApp({ render: () => h(DissolveTab) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, version, unmount: () => app.unmount() }
}

// Teleported modals leave through a CSS transition - the DOM removal
// lands whenever the transition resolves, so assert it is GONE with a
// retry window instead of guessing a wait time.
function expectModalGone(modal: () => Element | null) {
  return vi.waitFor(() => {
    expect(modal()).toBeNull()
  })
}

// jsdom khong co ResizeObserver - usePanelPagination tao observer khi
// container render; stub theo pattern InventorySort.test.ts.
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

describe('DissolveTab — Hóa Luyện', () => {
  it('itemId lạ (registry miss) ở đồ trong túi không chết tab Hóa Luyện — ứng viên vẫn liệt kê', async () => {
    const mounted = mountTab((manager) => {
      // jsdom khong co ResizeObserver -> contentRect chua do duoc ->
      // usePanelPagination dung FALLBACK_ROWS_WHEN_UNMEASURED (6 hang);
      // bo fixture 'in-bag' de ghost la ung vien DUY NHAT, chac chan nam
      // trong trang dau bat ke pageSize that la bao nhieu.
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithItemId('ghost-bag', 'nonexistent_item', false))
    })

    await nextTick()

    // Dissolve candidates render without throw - a foreign item shows
    // its raw itemId + Pham suffix (accessibleLabel spec section 5b:
    // "{name}, {grade}"). The card embeds the whole equipment bag, so
    // count FILLED cells only (the rest are padded empties).
    const dissolveSlots = mounted.container.querySelectorAll('.bag-section__slot.slot-view--filled')

    expect(dissolveSlots.length).toBeGreaterThan(0)

    const ghost = Array.from(dissolveSlots).find(
      (el) => el.getAttribute('aria-label') === 'nonexistent_item, Cửu Phẩm',
    )

    expect(ghost).toBeDefined()

    mounted.unmount()
  })

  it('lọc Loại item của túi thu hẹp lưới + Chọn tất cả chỉ chọn tập đang hiển thị', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithItemId('d1-kiem', 'base_kiem', false))
      const bao = equipmentInstanceWithItemId('d2-bao', 'base_bao', false)
      bao.slot = 'armor'
      manager.equipmentBag.add(bao)
    })

    await nextTick()

    // Open the bag's own Loai-item dropdown (first chip select) and
    // pick the Bao socket filter.
    const typeChip = mounted.container.querySelector<HTMLElement>('.chip-select__button')!

    typeChip.click()
    await nextTick()

    const baoOption = Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.chip-select__option'),
    ).find((el) => el.textContent?.includes('Bào'))!

    expect(baoOption).toBeDefined()

    baoOption.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.bag-section__slot.slot-view--filled')).toHaveLength(1)

    // Select-all scopes to the visible set: only the Bao item is picked.
    const selectAll = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.dissolve-filters__bulk'),
    ).find((b) => b.textContent?.includes('Chọn tất cả'))!

    selectAll.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.bag-section__slot--picked')).toHaveLength(1)

    mounted.unmount()
  })

  it('món KHÓA / GHIM YÊU THÍCH vẫn hiện trong lưới nhưng mờ và không chọn được (Minh ruling: bưng nguyên túi hành trang)', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstance('locked-item', false))
      manager.equipmentBag.add(equipmentInstance('pickable-item', false))
      manager.equipmentBag.get('locked-item')!.locked = true
    })

    await nextTick()

    const inert = mounted.container.querySelector('.bag-section__slot--inert')

    expect(inert).not.toBeNull()

    // Clicking the inert cell must not add it to the selection.
    ;(inert as HTMLElement).click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.bag-section__slot--picked')).toHaveLength(0)

    // The pickable sibling still toggles normally (filled AND not inert).
    const target = Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.bag-section__slot.slot-view--filled'),
    ).find((el) => !el.classList.contains('bag-section__slot--inert'))

    expect(target).toBeDefined()

    target!.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.bag-section__slot--picked')).toHaveLength(1)

    mounted.unmount()
  })

  it('dialog xác nhận đóng khi selection bị clear - chọn lại phải mở popup mới', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithQuality('q1', 'hoang'))
      manager.equipmentBag.add(equipmentInstanceWithQuality('q2', 'hoang'))
    })

    const primary = () =>
      mounted.container.querySelector<HTMLButtonElement>('.equipment-forge-actions__submit')!
    const bulk = () =>
      Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.dissolve-filters__bulk'))
    const selectAll = () => bulk().find((b) => b.textContent?.includes('Chọn tất cả'))!
    const clearAll = () => bulk().find((b) => b.textContent?.includes('Bỏ chọn hết'))!
    const modal = () => document.body.querySelector('.confirm-modal')
    const modalConfirm = () =>
      document.body.querySelector<HTMLButtonElement>('.confirm-modal__confirm')!

    // The submit opens the confirm popup (owner ruling 2026-10-09).
    selectAll().click()
    await nextTick()
    primary().click()
    await nextTick()

    expect(modal()).toBeTruthy()
    expect(modalConfirm().textContent).toContain('XÁC NHẬN HÓA LUYỆN')

    // Clearing the selection closes the pending dialog.
    clearAll().click()
    await nextTick()
    await expectModalGone(modal)

    selectAll().click()
    await nextTick()

    // The first click on the re-selected set opens the dialog again,
    // it does not execute.
    primary().click()
    await nextTick()

    expect(mounted.manager.equipmentBag.get('q1')).toBeDefined()
    expect(modal()).toBeTruthy()

    modalConfirm().click()
    await nextTick()
    await expectModalGone(modal)

    expect(mounted.manager.equipmentBag.get('q1')).toBeUndefined()
    expect(mounted.manager.equipmentBag.get('q2')).toBeUndefined()

    mounted.unmount()
  })

  it('dialog xác nhận đóng khi selection bị prune (món rời túi)', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstance('d1', false))
      manager.equipmentBag.add(equipmentInstance('d2', false))
    })

    await nextTick()

    const primary = () =>
      mounted.container.querySelector<HTMLButtonElement>('.equipment-forge-actions__submit')!
    const selectAll = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.dissolve-filters__bulk'),
    ).find((b) => b.textContent?.includes('Chọn tất cả'))!
    const modal = () => document.body.querySelector('.confirm-modal')

    // Select both candidates and open the confirm popup.
    selectAll.click()
    await nextTick()
    primary().click()
    await nextTick()

    expect(modal()).toBeTruthy()

    // A selection member leaving the bag prunes it - the pending
    // dialog must close, so the next click re-opens a fresh review
    // instead of executing.
    // (bag mutations only surface to computeds through a version bump)
    mounted.manager.equipmentBag.remove('d1')
    mounted.version.value += 1
    await nextTick()
    await expectModalGone(modal)

    primary().click()
    await nextTick()

    expect(mounted.manager.equipmentBag.get('d2')).toBeDefined()
    expect(modal()).toBeTruthy()

    mounted.unmount()
  })

  it('chọn tất cả / bỏ chọn hết theo filter hiện hành', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithQuality('q1', 'hoang'))
      manager.equipmentBag.add(equipmentInstanceWithQuality('q2', 'hoang'))
    })

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.dissolve-filters__bulk'))
    const selectAllBtn = buttons.find((b) => b.textContent?.includes('Chọn tất cả'))!

    selectAllBtn.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.bag-section__slot--picked')).toHaveLength(2)

    const clearBtn = buttons.find((b) => b.textContent?.includes('Bỏ chọn hết'))!

    clearBtn.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.bag-section__slot--picked')).toHaveLength(0)

    mounted.unmount()
  })
})
