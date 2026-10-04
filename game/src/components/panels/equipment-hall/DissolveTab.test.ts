// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) - DissolveTab extracted
// from EquipmentHallPanel.test.ts. Fully self-contained (own multi-select,
// no HALL_SELECTION_KEY needed).
//
// The old "ca hai filter bridge doc truc quality da hop nhat" test
// documented a KNOWN TEMPORARY bridge (its own comment: "Task 19 se hop
// nhat UI/filter contract") - 3 dropdowns where 2 secretly read the same
// ITEM_QUALITY-aliased axis. Task 19 replaces it with the real 2-dropdown
// contract (grade = ProfessionGrade axis, Chat = merged ITEM_QUALITY
// dropdown), so this file replaces that test with coverage of the new
// contract rather than moving it verbatim.
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
import type { ProfessionGrade } from '@/core/profession/ProfessionGrade'

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

/** Instance voi grade (ProfessionGrade) tuy y - dung test dropdown Pham. */
function equipmentInstanceWithProfessionGrade(
  instanceId: string,
  grade: ProfessionGrade,
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, false)

  instance.grade = grade

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

  return { container, manager, unmount: () => app.unmount() }
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
    // "{name}, {grade}").
    const dissolveSlots = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')

    expect(dissolveSlots.length).toBeGreaterThan(0)

    const ghost = Array.from(dissolveSlots).find(
      (el) => el.getAttribute('aria-label') === 'nonexistent_item, Cửu Phẩm',
    )

    expect(ghost).toBeDefined()

    mounted.unmount()
  })

  it('dropdown Phẩm liệt kê đủ 10 Cửu Phẩm (Task 19: đổi trục realm → ProfessionGrade)', () => {
    const mounted = mountTab()

    const gradeSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters .dissolve-filters__field:nth-of-type(1) select',
    )!

    expect(gradeSelect.options.length).toBe(11) // 10 pham + "Moi pham"

    mounted.unmount()
  })

  it('lọc theo Phẩm (grade) và Chất (quality) độc lập, kết hợp thu hẹp đúng giao', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('d1', 'cuu_pham'))
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('d2', 'luc_pham'))
    })

    const gradeSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters .dissolve-filters__field:nth-of-type(1) select',
    )!

    gradeSelect.value = 'luc_pham'
    gradeSelect.dispatchEvent(new Event('change'))
    await nextTick()

    let visible = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')
    expect(visible).toHaveLength(1)

    // Reset pham, loc theo Chat thay vao do - 2 fixture deu 'hoang' nen
    // van khop ca 2; doi 1 fixture sang 'dia' de kiem tra thu hep.
    gradeSelect.value = 'any'
    gradeSelect.dispatchEvent(new Event('change'))

    const qualitySelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters .dissolve-filters__field:nth-of-type(2) select',
    )!

    mounted.manager.equipmentBag.get('d2')!.quality = 'dia'

    qualitySelect.value = 'dia'
    qualitySelect.dispatchEvent(new Event('change'))
    await nextTick()

    visible = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')
    expect(visible).toHaveLength(1)

    // Pham + Chat mau thuan thi khong con ung vien (giao rong).
    gradeSelect.value = 'cuu_pham'
    gradeSelect.dispatchEvent(new Event('change'))
    await nextTick()

    expect(mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')).toHaveLength(0)

    mounted.unmount()
  })

  it('món KHÔNG khớp phẩm cảnh giới hiện tại (canUseItemGrade) được đánh dấu mờ (hint, KHÔNG bị ẩn)', async () => {
    // Player mac dinh realmId 'mortal' -> pham nghe 'cuu_pham'. Mon
    // 'luc_pham' khong khop nhung van phai liet ke (Hoa Luyen khong can
    // dung duoc mon moi thao tac duoc) - chi la hint truc quan.
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('mismatch', 'luc_pham'))
    })

    await nextTick()

    const wrap = mounted.container.querySelector('.dissolve-slot-wrap')

    expect(wrap).not.toBeNull()
    expect(wrap!.classList.contains('dissolve-slot-wrap--grade-mismatch')).toBe(true)

    mounted.unmount()
  })

  it('confirm đã gài bị hủy khi selection bị clear - chọn lại phải xác nhận 2 bước mới', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithQuality('q1', 'hoang'))
      manager.equipmentBag.add(equipmentInstanceWithQuality('q2', 'hoang'))
    })

    const primary = () =>
      mounted.container.querySelector<HTMLButtonElement>('.qi-hall__primary-action')!
    const bulk = () =>
      Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.dissolve-filters__bulk'))
    const selectAll = () => bulk().find((b) => b.textContent?.includes('Chọn tất cả'))!
    const clearAll = () => bulk().find((b) => b.textContent?.includes('Bỏ chọn hết'))!

    // Arm the 2-step confirm on the full selection.
    selectAll().click()
    await nextTick()
    primary().click()
    await nextTick()

    expect(primary().textContent).toContain('XÁC NHẬN HÓA LUYỆN')

    // Clearing the selection disarms the pending confirm.
    clearAll().click()
    await nextTick()
    selectAll().click()
    await nextTick()

    // The first click on the re-selected set must arm again, not execute.
    primary().click()
    await nextTick()

    expect(mounted.manager.equipmentBag.get('q1')).toBeDefined()
    expect(primary().textContent).toContain('XÁC NHẬN HÓA LUYỆN')

    primary().click()
    await nextTick()

    expect(mounted.manager.equipmentBag.get('q1')).toBeUndefined()
    expect(mounted.manager.equipmentBag.get('q2')).toBeUndefined()

    mounted.unmount()
  })

  it('confirm đã gài bị hủy khi filter prune khỏi selection', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('d1', 'cuu_pham'))
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('d2', 'luc_pham'))
    })

    const primary = () =>
      mounted.container.querySelector<HTMLButtonElement>('.qi-hall__primary-action')!
    const gradeSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters .dissolve-filters__field:nth-of-type(1) select',
    )!
    const selectAll = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.dissolve-filters__bulk'),
    ).find((b) => b.textContent?.includes('Chọn tất cả'))!

    // Select both candidates and arm the confirm.
    selectAll.click()
    await nextTick()
    primary().click()
    await nextTick()

    expect(primary().textContent).toContain('XÁC NHẬN HÓA LUYỆN')

    // Filtering d1 out prunes it from the selection - the armed confirm
    // must disarm, so the next click arms again instead of executing.
    gradeSelect.value = 'luc_pham'
    gradeSelect.dispatchEvent(new Event('change'))
    await nextTick()

    primary().click()
    await nextTick()

    expect(mounted.manager.equipmentBag.get('d2')).toBeDefined()
    expect(primary().textContent).toContain('XÁC NHẬN HÓA LUYỆN')

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

    expect(mounted.container.querySelectorAll('.dissolve-slot-tick')).toHaveLength(2)

    const clearBtn = buttons.find((b) => b.textContent?.includes('Bỏ chọn hết'))!

    clearBtn.click()
    await nextTick()

    expect(mounted.container.querySelectorAll('.dissolve-slot-tick')).toHaveLength(0)

    mounted.unmount()
  })
})
