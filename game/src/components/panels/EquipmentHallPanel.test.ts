// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentHallPanel from './EquipmentHallPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { materials } from '@/data/materials/materials'
import { SPIRIT_STONE_MATERIAL } from '@/core/material/SpiritStoneMaterial'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'

function equipmentInstance(instanceId: string, equipped: boolean): EquipmentInstance {
  return {
    instanceId,
    itemId: 'base_kiem',
    slot: 'weapon',
    equipped,
    quality: 'pham_khi',
    rarity: 'hoang',
    realmId: 'mortal',
    realmLevel: 1,
    mainStat: {
      id: `${instanceId}:main`,
      sourceId: instanceId,
      sourceType: 'equipment',
      stat: 'attack',
      flat: 12,
    },
    affixes: [],
    forgePoints: 10,
    forgePotential: 100,
  }
}

function mountHall(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.registerEquipment(equipment)
  prepare?.(manager)
  manager.equipmentBag.add(equipmentInstance('equipped', true))
  manager.equipmentBag.add(equipmentInstance('in-bag', false))

  const app = createApp({ render: () => h(EquipmentHallPanel) })
  app.use(pinia)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('EquipmentHallPanel — chọn trang bị bằng slot', () => {
  it('Cường Hóa và Tẩy Luyện đều hiện đủ 6 slot (2026-08-30: ô luôn tồn tại, tham chiếu equip trực tiếp)', async () => {
    const mounted = mountHall()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click()
    await nextTick()

    const washSlots = mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tẩy luyện"] .slot-view')

    expect(washSlots).toHaveLength(6)

    // Slot weapon (đang mặc 'equipped') hiện tên item — 5 slot còn lại
    // trống, dùng nhãn tên slot mặc định (Mũ/Giáp/Giày/Dây Chuyền/Nhẫn).
    const labels = Array.from(washSlots).map((el) => el.getAttribute('aria-label'))

    expect(labels).toContain('Kiếm')
    expect(labels.filter((label) => label === 'Kiếm')).toHaveLength(1)

    mounted.unmount()
  })

  it('Tẩy Luyện đồ Hoàng (0 affix slot) → nút disabled kể cả khi đủ quáng/điểm rèn/Linh Thạch', async () => {
    const mounted = mountHall((manager) => {
      const ore = materials.find((m) => m.id === 'qi_refining_ore_huyen')!
      manager.materialBag.add(ore, 100)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click() // Tẩy Luyện
    await nextTick()

    // Chọn slot đang mặc.
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tẩy luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    // Tick quáng.
    const radios = mounted.container.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    if (radios.length > 0) {
      ;(radios[0] as HTMLElement).click()
    }
    await nextTick()

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
    const washBtn = buttons.find((b) => b.textContent?.includes('roll lại toàn bộ dòng phụ'))
    expect(washBtn).toBeDefined()
    expect(washBtn!.disabled).toBe(true)

    mounted.unmount()
  })

  it('bảng so sánh Trước ⇒ Sau hiện khi chọn item ở Tẩy Luyện — Điểm Rèn cùng hàng', async () => {
    const mounted = mountHall((manager) => {
      const ore = materials.find((m) => m.id === 'qi_refining_ore_huyen')!
      manager.materialBag.add(ore, 100)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click() // Tẩy Luyện
    await nextTick()

    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tẩy luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const table = mounted.container.querySelector(
      '[aria-label="So sánh trước và sau Tẩy Luyện"]',
    )
    expect(table).not.toBeNull()

    // Điểm Rèn: trước là 10/20 (forgePoints khởi tạo 10), sau = trước - cost pham_khi (2).
    const firstRow = table!.querySelectorAll('tbody tr')[0]!
    expect(firstRow.textContent).toContain('Điểm Rèn')
    expect(firstRow.textContent).toContain('10/20')
    expect(firstRow.textContent).toContain('8/20')

    mounted.unmount()
  })
})
