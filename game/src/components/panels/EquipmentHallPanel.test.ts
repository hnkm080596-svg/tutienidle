// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentHallPanel from './EquipmentHallPanel.vue'
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
import { ITEM_QUALITY_FORGE_USES } from '@/core/equipment/ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'

function setLocale(locale: 'vi' | 'en'): void {
  const global = i18n.global as unknown as { locale: { value: 'vi' | 'en' } }
  global.locale.value = locale
}

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

/** Instance với quality tùy ý cho bộ lọc bridge trước khi UI được tách lại. */
function equipmentInstanceWithGrade(
  instanceId: string,
  quality: EquipmentInstance['quality'],
): EquipmentInstance {
  const instance = equipmentInstance(instanceId, false)

  instance.quality = quality
  instance.forgeUsesTotal = ITEM_QUALITY_FORGE_USES[quality]
  instance.forgeUsesRemaining = ITEM_QUALITY_FORGE_USES[quality]

  return instance
}

function mountHall(prepare?: (manager: GameManager) => void) {
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
  setLocale('vi')
  document.body.innerHTML = ''
})

describe('EquipmentHallPanel — chọn trang bị bằng slot', () => {
  it.each([
    [
      'vi',
      'Mỗi dòng đủ điều kiện và không khóa tăng 5–20%, tối đa đến trần bậc. Chi phí:',
    ],
    [
      'en',
      'Each eligible unlocked line increases by 5–20%, capped at its tier maximum. Cost:',
    ],
  ] as const)('hiển thị đầy đủ quy tắc Tinh Luyện đã trả phí bằng locale %s', async (locale, expectedRule) => {
    setLocale(locale)
    const mounted = mountHall()

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[2]!.click()
    await nextTick()

    const slots = mounted.container.querySelectorAll(
      `[aria-label="${locale === 'vi' ? 'Chọn trang bị để tinh luyện' : 'Select equipment to refine'}"] .slot-view`,
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const rule = mounted.container.querySelector('.qi-hall__info-row.qi-hall__costline')
    expect(rule?.textContent).toContain(expectedRule)

    mounted.unmount()
  })

  it.each([
    ['vi', 'Bỏ'],
    ['en', 'Discard'],
  ] as const)('nút %s hủy cả preview UI lẫn capability core đã trả phí', async (locale, discardLabel) => {
    setLocale(locale)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const mounted = mountHall((manager) => {
      const instance = manager.equipmentBag.get('equipped')!
      instance.affixes = [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }]
      manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 100)
      manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL.id), 1_000)
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[2]!.click()
    await nextTick()

    const slots = mounted.container.querySelectorAll(
      `[aria-label="${locale === 'vi' ? 'Chọn trang bị để tinh luyện' : 'Select equipment to refine'}"] .slot-view`,
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const actionButtons = mounted.container.querySelectorAll<HTMLButtonElement>(
      '.qi-hall__button-row button',
    )
    actionButtons[0]!.click()
    await nextTick()

    const discardButton = Array.from(
      mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__button-row button'),
    ).find((button) => button.textContent?.trim() === discardLabel)
    expect(discardButton).toBeDefined()

    discardButton!.click()
    await nextTick()

    expect(mounted.container.textContent).not.toContain(discardLabel)
    expect(
      mounted.manager.commitRefineItem('equipped', [{ index: 0, value: 3.15 }]),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(mounted.manager.equipmentBag.get('equipped')!.affixes[0]!.value).toBe(3)

    mounted.unmount()
  })

  it('unmount panel hủy capability Refine còn chờ để overlay mới không thể giữ payload cũ', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const mounted = mountHall((manager) => {
      const instance = manager.equipmentBag.get('equipped')!
      instance.affixes = [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }]
      manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 100)
      manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL.id), 1_000)
    })
    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[2]!.click()
    await nextTick()
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tinh luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()
    mounted.container.querySelector<HTMLButtonElement>('.qi-hall__button-row button')!.click()
    await nextTick()

    mounted.unmount()

    expect(
      mounted.manager.commitRefineItem('equipped', [{ index: 0, value: 3.15 }]),
    ).toEqual({ ok: false, reason: 'invalid_refine_preview' })
    expect(mounted.manager.equipmentBag.get('equipped')!.affixes[0]!.value).toBe(3)
  })

  it('Tinh Luyện đọc số dư từ Luyện Khí Tinh Hoa duy nhất', async () => {
    const mounted = mountHall((manager) => {
      manager.materialBag.add(
        {
          id: LUYEN_KHI_TINH_HOA_ID,
          name: 'Luyện Khí Tinh Hoa',
          category: 'essence',
          sourceType: 'building',
        },
        37,
      )
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[2]!.click()
    await nextTick()

    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tinh luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    expect(mounted.container.querySelector('.qi-hall__costline')?.textContent).toContain('37')

    mounted.unmount()
  })

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

  it('Tẩy Luyện đồ Hoàng không cần chọn hoặc sở hữu Quáng', async () => {
    const mounted = mountHall((manager) => {
      const essence = materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!
      manager.materialBag.add(essence, 10)
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

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
    const washBtn = buttons.find((b) => b.textContent?.includes('roll lại toàn bộ dòng phụ'))
    expect(washBtn).toBeDefined()
    expect(washBtn!.disabled).toBe(false)

    mounted.unmount()
  })

  it('card so sánh Trước ⇒ Sau hiện khi chọn item ở Tẩy Luyện — Điểm Rèn ở dòng chú thích, bảng theo từng dòng phụ (2026-08-30: bọc gọn 1 card, Điểm Rèn không còn là 1 hàng bảng)', async () => {
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

  it('Cường Hóa mainStat thập phân nhỏ (tốc đánh 0.015) không bị làm tròn thành 0.0', async () => {
    // Bug report 2026-08-30: bảng Cường Hóa dùng toFixed(1) → mainStat
    // attackSpeed nhỏ (0.01–0.02) hiển thị "0.0". formatStat phải
    // giữ 2 chữ số thập phân cho DECIMAL_STAT_KEYS.
    const mounted = mountHall((manager) => {
      manager.equipmentBag.remove('equipped')
      manager.equipmentBag.add(equipmentInstanceWithStat('fast-weapon', 'attackSpeed', 0.015))
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

    expect(cells.some((cell) => cell.includes('0.02'))).toBe(true)
    expect(cells.some((cell) => cell.trim() === '0.0')).toBe(false)

    mounted.unmount()
  })

  it('itemId lạ (registry miss) không chết panel — trang bị đang mặc vẫn render slot, hiện itemId thô', async () => {
    // Audit fix 2026-08-31 — equipmentRegistry.get() throw với itemId lạ
    // (data edit/save lệch) từng chết cả panel qua ErrorBoundary; các
    // computed phải dùng getEquipmentTemplate() an toàn + fallback hiển
    // thị (pattern Task 13 EquipmentBagSection.vue).
    const mounted = mountHall((manager) => {
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

  it('itemId lạ (registry miss) ở đồ trong túi không chết tab Hóa Luyện — ứng viên vẫn liệt kê', async () => {
    const mounted = mountHall((manager) => {
      // jsdom không có ResizeObserver → usePanelPagination pageSize tối
      // thiểu 1; bỏ fixture 'in-bag' để ghost là ứng viên DUY NHẤT hiển
      // thị trang đầu.
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithItemId('ghost-bag', 'nonexistent_item', false))
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    const dissolveTab = Array.from(tabs).find((b) => b.textContent?.includes('Hóa Luyện'))
    dissolveTab!.click()
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

  it('cả hai filter bridge đọc trục quality đã hợp nhất', async () => {
    const mounted = mountHall((manager) => {
      // Bỏ fixture mặc định 'in-bag' để ứng viên hoàn toàn do test kiểm soát.
      manager.equipmentBag.remove('in-bag')
      manager.equipmentBag.add(equipmentInstanceWithGrade('d1', 'hoang'))
      manager.equipmentBag.add(equipmentInstanceWithGrade('d2', 'dia'))
    })

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    const dissolveTab = Array.from(tabs).find((b) => b.textContent?.includes('Hóa Luyện'))
    dissolveTab!.click()
    await nextTick()

    const gradeSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters select:nth-of-type(2)',
    )!
    const qualitySelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters select:nth-of-type(3)',
    )!

    // Realm dropdown phải đủ 10 realm (T2.3: từng chỉ có 3).
    const realmSelect = mounted.container.querySelector<HTMLSelectElement>(
      '.dissolve-filters select:nth-of-type(1)',
    )!
    expect(realmSelect.options.length).toBe(11) // 10 realm + "Mọi cảnh giới"

    gradeSelect.value = 'dia'
    gradeSelect.dispatchEvent(new Event('change'))
    qualitySelect.value = 'dia'
    qualitySelect.dispatchEvent(new Event('change'))
    await nextTick()

    const visible = mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view')

    expect(visible).toHaveLength(1)

    // Hai filter mâu thuẫn thì không còn ứng viên vì cùng đọc quality.
    qualitySelect.value = 'hoang'
    qualitySelect.dispatchEvent(new Event('change'))
    await nextTick()

    expect(
      mounted.container.querySelectorAll('.dissolve-slot-wrap .slot-view'),
    ).toHaveLength(0)

    mounted.unmount()
  })
})
