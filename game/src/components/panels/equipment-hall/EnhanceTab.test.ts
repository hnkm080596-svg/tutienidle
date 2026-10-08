// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) - EnhanceTab extracted
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
      stat: 'might',
      flat: 12,
    },
  })
}

/** Instance voi mainStat tuy y - dung test hien thi so thap phan nho. */
function equipmentInstanceWithStat(
  instanceId: string,
  stat: EquipmentInstance['mainStat']['stat'],
  flat: number,
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, true)

  instance.mainStat = { ...instance.mainStat, stat, flat }

  return instance
}

/** Instance voi itemId tuy y - registry miss (save lech data, audit fix
 * 2026-08-31): computed phai tra an toan thay vi throw chet panel. */
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
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
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

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .enhance-slot')).toHaveLength(6)

    mounted.unmount()
  })

  it('Cường Hóa mainStat thập phân nhỏ (speed 0.015) không bị làm tròn thành 0.0', async () => {
    // Bug report 2026-08-30: bang Cuong Hoa dung toFixed(1) -> mainStat
    // nho hien thi "0.0". formatStat phai giu nguyen gia tri hien thi
    // duoc. (Turn-based conversion 2026-09-04: attackSpeed->speed, gia
    // tri fixture +105 cho speed thang ~100.)
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('equipped')
      manager.equipmentBag.add(equipmentInstanceWithStat('fast-weapon', 'speed', 105.015))
    })

    // Tab Cuong Hoa mac dinh - slot weapon dang mac 'fast-weapon'.
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn slot cường hóa"] .enhance-slot',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const table = mounted.container.querySelector('[aria-label="So sánh trước và sau Cường Hóa"]')

    expect(table).not.toBeNull()

    const cells = Array.from(table!.querySelectorAll('.equipment-enhance-stat b, .equipment-enhance-stat strong')).map((cell) => cell.textContent ?? '')

    expect(cells.some((cell) => cell.includes('105'))).toBe(true)
    expect(cells.some((cell) => cell.trim() === '0.0')).toBe(false)

    mounted.unmount()
  })

  it('itemId lạ (registry miss) không chết panel — trang bị đang mặc vẫn render slot, hiện itemId thô', async () => {
    // Audit fix 2026-08-31 - equipmentRegistry.get() throw voi itemId la
    // (data edit/save lech) tung chet ca panel qua ErrorBoundary; cac
    // computed phai dung getEquipmentTemplate() an toan + fallback hien
    // thi (pattern Task 13 EquipmentBagSection.vue).
    const mounted = mountTab((manager) => {
      manager.equipmentBag.remove('equipped')
      manager.equipmentBag.add(equipmentInstanceWithItemId('ghost-item', 'nonexistent_item', true))
    })

    // Khong throw khi render - slot weapon van hien (caption = itemId tho
    // vi template khong tra duoc).
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn slot cường hóa"] .enhance-slot',
    )

    expect(slots).toHaveLength(6)

    mounted.unmount()
  })

  it('Task 1 (perf-optimize-pass, Phase 0 safety-net): equip trang bị mới vào 1 slot → enhanceRows phản ánh đúng slot đó sau lần recompute kế tiếp', async () => {
    // Khoa hanh vi HIEN TAI cua enhanceRows (doc gameManager.equipmentBag
    // qua stateVersion) truoc khi Task 4/5 dung vao cach no recompute -
    // neu Task 4/5 pha reactivity, test nay do ngay.
    const mounted = mountTab()

    const slots = () =>
      mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .enhance-slot')

    // Slot helmet (index 1 trong EQUIPMENT_SLOTS) ban dau trong - chua co
    // equipment nao trong bag mang slot 'helmet'.
    expect(slots()[1]!.classList.contains('enhance-slot--empty')).toBe(true)

    // Equip trang bi moi vao slot helmet, roi bump stateVersion - dung
    // pattern app that (useEquipmentActions goi bumpState sau khi mutate
    // gameManager); enhanceRows doc `stateVersion.value` lam dependency
    // tuong minh (xem EnhanceTab.vue) nen PHAI bump version moi recompute.
    mounted.manager.equipmentBag.add(equipmentInstance('new-helmet', true))
    mounted.manager.equipmentBag.get('new-helmet')!.slot = 'helmet'
    mounted.manager.equipmentBag.get('new-helmet')!.itemId = 'base_quan'

    mounted.version.value += 1
    await nextTick()

    expect(slots()[1]!.classList.contains('enhance-slot--filled')).toBe(true)

    mounted.unmount()
  })
})
