// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) — EnhanceTab extracted
// from EquipmentHallPanel.test.ts. Enhance is fully self-contained (slot
// selection, no shared HALL_SELECTION_KEY needed).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EnhanceTab from './EnhanceTab.vue'
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

/** Instance với mainStat tuỳ ý — dùng test hiển thị số thập phân nhỏ. */
function equipmentInstanceWithStat(
  instanceId: string,
  stat: EquipmentInstance['mainStat']['stat'],
  flat: number,
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, true)

  instance.mainStat = { ...instance.mainStat, stat, flat }

  return instance
}

/** Instance với itemId tuỳ ý — registry miss (save lệch data, audit fix
 * 2026-08-31): computed phải tra an toàn thay vì throw chết panel. */
function equipmentInstanceWithItemId(
  instanceId: string,
  itemId: string,
  equipped: boolean,
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, equipped)

  instance.itemId = itemId

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

  const app = createApp({ render: () => h(EnhanceTab) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, version, unmount: () => app.unmount() }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('EnhanceTab — Cường Hóa', () => {
  it('hiện đủ 6 slot (2026-08-30: ô luôn tồn tại, tham chiếu equip trực tiếp)', () => {
    const mounted = mountTab()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    mounted.unmount()
  })

  it('Cường Hóa mainStat thập phân nhỏ (speed 0.015) không bị làm tròn thành 0.0', async () => {
    // Bug report 2026-08-30: bảng Cường Hóa dùng toFixed(1) → mainStat
    // nhỏ hiển thị "0.0". formatStat phải giữ nguyên giá trị hiển thị
    // được. (Turn-based conversion 2026-09-04: attackSpeed→speed, giá
    // trị fixture +105 cho speed thang ~100.)
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('equipped')
      manager.equipmentBag.add(equipmentInstanceWithStat('fast-weapon', 'speed', 105.015))
    })

    // Tab Cường Hóa mặc định — slot weapon đang mặc 'fast-weapon'.
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn slot cường hóa"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const table = mounted.container.querySelector('[aria-label="So sánh trước và sau Cường Hóa"]')

    expect(table).not.toBeNull()

    const cells = Array.from(table!.querySelectorAll('td')).map((cell) => cell.textContent ?? '')

    expect(cells.some((cell) => cell.includes('105'))).toBe(true)
    expect(cells.some((cell) => cell.trim() === '0.0')).toBe(false)

    mounted.unmount()
  })

  it('itemId lạ (registry miss) không chết panel — trang bị đang mặc vẫn render slot, hiện itemId thô', async () => {
    // Audit fix 2026-08-31 — equipmentRegistry.get() throw với itemId lạ
    // (data edit/save lệch) từng chết cả panel qua ErrorBoundary; các
    // computed phải dùng getEquipmentTemplate() an toàn + fallback hiển
    // thị (pattern Task 13 EquipmentBagSection.vue).
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('equipped')
      manager.equipmentBag.add(equipmentInstanceWithItemId('ghost-item', 'nonexistent_item', true))
    })

    // Không throw khi render — slot weapon vẫn hiện (caption = itemId thô
    // vì template không tra được).
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn slot cường hóa"] .slot-view',
    )

    expect(slots).toHaveLength(6)

    mounted.unmount()
  })

  it('Task 1 (perf-optimize-pass, Phase 0 safety-net): equip trang bị mới vào 1 slot → enhanceRows phản ánh đúng slot đó sau lần recompute kế tiếp', async () => {
    // Khóa hành vi HIỆN TẠI của enhanceRows (đọc gameManager.equipmentBag
    // qua stateVersion) trước khi Task 4/5 đụng vào cách nó recompute —
    // nếu Task 4/5 phá reactivity, test này đỏ ngay.
    const mounted = mountTab()

    const slots = () =>
      mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')

    // Slot helmet (index 1 trong EQUIPMENT_SLOTS) ban đầu trống — chưa có
    // equipment nào trong bag mang slot 'helmet'.
    expect(slots()[1]!.classList.contains('slot-view--empty')).toBe(true)

    // Equip trang bị mới vào slot helmet, rồi bump stateVersion — đúng
    // pattern app thật (useEquipmentActions gọi bumpState sau khi mutate
    // gameManager); enhanceRows đọc `stateVersion.value` làm dependency
    // tường minh (xem EnhanceTab.vue) nên PHẢI bump version mới recompute.
    mounted.manager.equipmentBag.add(equipmentInstance('new-helmet', true))
    mounted.manager.equipmentBag.get('new-helmet')!.slot = 'helmet'
    mounted.manager.equipmentBag.get('new-helmet')!.itemId = 'base_quan'

    mounted.version.value += 1
    await nextTick()

    expect(slots()[1]!.classList.contains('slot-view--filled')).toBe(true)

    mounted.unmount()
  })
})
