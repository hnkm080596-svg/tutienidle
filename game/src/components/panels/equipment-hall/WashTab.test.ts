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
      stat: 'might',
      flat: 12,
    },
  })
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

    // The weapon slot (worn 'equipped') shows the item name + Pham
    // suffix (accessibleLabel spec section 5b: "{name}, {grade}") - the
    // other 5 slots are empty and use their default slot-name labels.
    const labels = Array.from(washSlots).map((el) => el.getAttribute('aria-label'))

    expect(labels).toContain('Kiếm, Cửu Phẩm')
    expect(labels.filter((label) => label === 'Kiếm, Cửu Phẩm')).toHaveLength(1)

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

// T4-33 — paid-preview honesty: the compare table hid rolled lines that
// outnumbered the current affixes, mislabeled a zero-line roll as
// "not rolled", kept a dead "Giữ" armed after a failed commit (the domain
// already ate the ticket), and never discarded the paid ticket on unmount.
describe('WashTab — preview honesty (T4-33)', () => {
  function prepareWashable(manager: GameManager, quality: 'huyen' | 'dia') {
    const instance = manager.equipmentBag.get('equipped')!
    instance.quality = quality
    instance.forgeUsesTotal = 10
    instance.forgeUsesRemaining = 10
    instance.affixes = [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }]

    const essence = materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!
    manager.materialBag.add(essence, 100)
    manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
  }

  async function selectAndPreview(mounted: ReturnType<typeof mountTab>) {
    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tẩy luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    const washBtn = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('roll lại toàn bộ dòng phụ'))!
    washBtn.click()
    await nextTick()
  }

  it('pending roll with MORE lines than current renders the extra row (no hidden rolled line)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // huyen max = 2 lines
    const mounted = mountTab((manager) => prepareWashable(manager, 'huyen'))
    await selectAndPreview(mounted)

    const rows = mounted.container.querySelectorAll(
      '[aria-label="So sánh trước và sau Tẩy Luyện"] tbody tr',
    )
    expect(rows).toHaveLength(2)

    // Row 2 has no current line — its "before" cell marks the line as new,
    // not blank.
    expect(rows[1]!.textContent).toContain('dòng mới')

    mounted.unmount()
  })

  it('zero-line roll shows a removed marker, not "not rolled"', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // min = 0 lines today
    const mounted = mountTab((manager) => prepareWashable(manager, 'huyen'))
    await selectAndPreview(mounted)

    const rows = mounted.container.querySelectorAll(
      '[aria-label="So sánh trước và sau Tẩy Luyện"] tbody tr',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toContain('đã mất')
    expect(rows[0]!.textContent).not.toContain('chưa roll')

    mounted.unmount()
  })

  it('failed commit still clears the armed ticket (domain consumed it)', async () => {
    const mounted = mountTab((manager) => prepareWashable(manager, 'huyen'))
    await selectAndPreview(mounted)

    // Lock AFTER the preview — commit revalidation rejects it.
    mounted.manager.equipmentBag.get('equipped')!.locked = true

    const keepBtn = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Giữ')!
    keepBtn.click()
    await nextTick()

    const keepBtnAfter = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Giữ')
    expect(keepBtnAfter).toBeUndefined()

    mounted.unmount()
  })

  it('unmounting the tab discards the paid ticket', async () => {
    const mounted = mountTab((manager) => prepareWashable(manager, 'huyen'))
    const discardSpy = vi.spyOn(mounted.manager.equipmentOps, 'discardWashTicket')
    await selectAndPreview(mounted)

    mounted.unmount()

    expect(discardSpy).toHaveBeenCalledTimes(1)
  })
})
