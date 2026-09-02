// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) — DissolveTab extracted
// from EquipmentHallPanel.test.ts. Fully self-contained (own multi-select,
// no HALL_SELECTION_KEY needed).
//
// The old "cả hai filter bridge đọc trục quality đã hợp nhất" test
// documented a KNOWN TEMPORARY bridge (its own comment: "Task 19 sẽ hợp
// nhất UI/filter contract") — 3 dropdowns where 2 secretly read the same
// ITEM_QUALITY-aliased axis. Task 19 replaces it with the real 2-dropdown
// contract (grade = ProfessionGrade axis, Chất = merged ITEM_QUALITY
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
      stat: 'attack',
      flat: 12,
    },
  })
}

/** Instance với itemId tuỳ ý — registry miss (save lệch data, audit fix
 * 2026-08-31): candidate vẫn phải liệt kê, không throw. */
function equipmentInstanceWithItemId(
  instanceId: string,
  itemId: string,
  equipped: boolean,
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, equipped)

  instance.itemId = itemId

  return instance
}

/** Instance với quality tùy ý — dùng test dropdown Chất (merged). */
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

/** Instance với grade (ProfessionGrade) tùy ý — dùng test dropdown Phẩm. */
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
  manager.registerMaterials(materials)
  manager.registerEquipment(equipment)
  manager.registerAffixes(affixes)
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

// jsdom không có ResizeObserver — usePanelPagination tạo observer khi
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
      // jsdom không có ResizeObserver → usePanelPagination pageSize tối
      // thiểu 1; bỏ fixture 'in-bag' để ghost là ứng viên DUY NHẤT hiển
      // thị trang đầu.
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithItemId('ghost-bag', 'nonexistent_item', false))
    })

    await nextTick()

    // Ứng viên Hóa Luyện render không throw — item lạ hiện itemId thô.
    const dissolveSlots = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')

    expect(dissolveSlots.length).toBeGreaterThan(0)

    const ghost = Array.from(dissolveSlots).find(
      (el) => el.getAttribute('aria-label') === 'nonexistent_item',
    )

    expect(ghost).toBeDefined()

    mounted.unmount()
  })

  it('dropdown Phẩm liệt kê đủ 10 Cửu Phẩm (Task 19: đổi trục realm → ProfessionGrade)', () => {
    const mounted = mountTab()

    const gradeSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters select:nth-of-type(1)',
    )!

    expect(gradeSelect.options.length).toBe(11) // 10 phẩm + "Mọi phẩm"

    mounted.unmount()
  })

  it('lọc theo Phẩm (grade) và Chất (quality) độc lập, kết hợp thu hẹp đúng giao', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('d1', 'cuu_pham'))
      manager.equipmentBag.add(equipmentInstanceWithProfessionGrade('d2', 'luc_pham'))
    })

    const gradeSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters select:nth-of-type(1)',
    )!

    gradeSelect.value = 'luc_pham'
    gradeSelect.dispatchEvent(new Event('change'))
    await nextTick()

    let visible = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')
    expect(visible).toHaveLength(1)

    // Reset phẩm, lọc theo Chất thay vào đó — 2 fixture đều 'hoang' nên
    // vẫn khớp cả 2; đổi 1 fixture sang 'dia' để kiểm tra thu hẹp.
    gradeSelect.value = 'any'
    gradeSelect.dispatchEvent(new Event('change'))

    const qualitySelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters select:nth-of-type(2)',
    )!

    mounted.manager.equipmentBag.get('d2')!.quality = 'dia'

    qualitySelect.value = 'dia'
    qualitySelect.dispatchEvent(new Event('change'))
    await nextTick()

    visible = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')
    expect(visible).toHaveLength(1)

    // Phẩm + Chất mâu thuẫn thì không còn ứng viên (giao rỗng).
    gradeSelect.value = 'cuu_pham'
    gradeSelect.dispatchEvent(new Event('change'))
    await nextTick()

    expect(mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')).toHaveLength(0)

    mounted.unmount()
  })

  it('món KHÔNG khớp phẩm cảnh giới hiện tại (canUseItemGrade) được đánh dấu mờ (hint, KHÔNG bị ẩn)', async () => {
    // Player mặc định realmId 'mortal' → phẩm nghề 'cuu_pham'. Món
    // 'luc_pham' không khớp nhưng vẫn phải liệt kê (Hóa Luyện không cần
    // dùng được món mới thao tác được) — chỉ là hint trực quan.
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
