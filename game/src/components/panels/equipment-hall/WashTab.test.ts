// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) — WashTab extracted from
// EquipmentHallPanel.test.ts. WashTab injects HALL_SELECTION_KEY (shared
// with RefineTab) — test harness provides it like the shell does.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import WashTab from './WashTab.vue'
import { HALL_SELECTION_KEY } from './hallSelection'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { materials } from '@/data/materials/materials'
import { SPIRIT_STONE_MATERIAL } from '@/core/material/SpiritStoneMaterial'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'

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

  const selectedInstanceId = ref<string | null>(null)

  const app = createApp({ render: () => h(WashTab) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.provide(HALL_SELECTION_KEY, {
    selectedInstanceId,
    selectEquipped: (id: string) => { selectedInstanceId.value = id },
    clearSelection: () => { selectedInstanceId.value = null },
  })
  app.mount(container)

  return { container, manager, selectedInstanceId, unmount: () => app.unmount() }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('WashTab — Tẩy Luyện', () => {
  it('hiện đủ 6 slot (2026-08-30: ô luôn tồn tại, tham chiếu equip trực tiếp)', () => {
    const mounted = mountTab()

    const washSlots = mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tẩy luyện"] .slot-view')

    expect(washSlots).toHaveLength(6)

    // Slot weapon (đang mặc 'equipped') hiện tên item — 5 slot còn lại
    // trống, dùng nhãn tên slot mặc định (Mũ/Giáp/Giày/Dây Chuyền/Nhẫn).
    const labels = Array.from(washSlots).map((el) => el.getAttribute('aria-label'))

    expect(labels).toContain('Kiếm')
    expect(labels.filter((label) => label === 'Kiếm')).toHaveLength(1)

    mounted.unmount()
  })

  it('Tẩy Luyện đồ Hoàng không cần chọn hoặc sở hữu Quáng', async () => {
    const mounted = mountTab((manager) => {
      const essence = materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!
      manager.materialBag.add(essence, 10)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    // Chọn slot đang mặc.
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tẩy luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
    const washBtn = buttons.find((b) => b.textContent?.includes('roll lại toàn bộ dòng phụ'))
    expect(washBtn).toBeDefined()
    expect(washBtn!.disabled).toBe(false)

    mounted.unmount()
  })

  it('card so sánh Trước ⇒ Sau hiện khi chọn item ở Tẩy Luyện — Điểm Rèn ở dòng chú thích, bảng theo từng dòng phụ (2026-08-30: bọc gọn 1 card, Điểm Rèn không còn là 1 hàng bảng)', async () => {
    const mounted = mountTab((manager) => {
      const ore = materials.find((m) => m.id === 'qi_refining_ore_century')!
      manager.materialBag.add(ore, 100)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tẩy luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const card = mounted.container.querySelector('.qi-hall__preview-card')
    expect(card).not.toBeNull()

    // Ngân sách rèn: Hoàng Chất có 5 lượt, mỗi wash trừ 1 lượt.
    // giờ là dòng chú thích trên đầu card, không còn là 1 hàng trong bảng.
    const caption = card!.querySelector('.qi-hall__col-title')
    expect(caption?.textContent).toContain('Điểm Rèn')
    expect(caption?.textContent).toContain('5/5')
    expect(caption?.textContent).toContain('4/5')

    // Fixture item không có affix nào (affixes: []) — không có gì để so
    // sánh theo dòng nên KHÔNG hiện bảng, chỉ hiện thông báo trống.
    expect(card!.querySelector('[aria-label="So sánh trước và sau Tẩy Luyện"]')).toBeNull()
    expect(card!.textContent).toContain('Chưa có dòng phụ')

    mounted.unmount()
  })
})
