// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) - WashTab extracted from
// EquipmentHallPanel.test.ts. WashTab injects HALL_SELECTION_KEY (shared
// with RefineTab) - test harness provides it like the shell does.
import { afterEach, describe, expect, it, vi } from 'vitest'

// BETA SCOPE LOCK v2 Phase-5 - this suite exercises the scope-hidden
// system's ENABLED implementation (sec.11-15: dormant, not deleted),
// so the scope authority reports in-scope for this file.
vi.mock('../../../core/betaScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/betaScope')>()),
  isBetaFeature: () => true,
  isScopeHidden: () => false,
}))

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
  it('chưa chọn đồ thì chỉ hiện hướng dẫn, không hiện nguyên liệu/nút (2026-10-08: chọn qua doll, strip cũ bỏ)', async () => {
    const mounted = mountTab()
    await nextTick()

    const card = mounted.container.querySelector('.equipment-forge-workspace')
    expect(card).not.toBeNull()
    expect(card!.textContent).toContain('Chọn một trang bị')
    expect(card!.querySelector('.equipment-forge-materials')).toBeNull()
    expect(card!.querySelector('.forge-compare')).toBeNull()

    mounted.unmount()
  })

  it('Tẩy Luyện đồ Hoàng không cần chọn hoặc sở hữu Quáng', async () => {
    const mounted = mountTab((manager) => {
      manager.equipmentBag.get('equipped')!.affixes = [
        { affixId: 'suffix_accuracy', tier: 1, value: 3 },
      ]
      const essence = materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!
      manager.materialBag.add(essence, 10)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    // Chon mon dang mac qua shared hall selection (doll).
    mounted.selectedInstanceId.value = 'equipped'
    await nextTick()

    const buttons = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
    const washBtn = buttons.find((b) => b.textContent?.trim() === 'Tẩy Luyện')
    expect(washBtn).toBeDefined()
    expect(washBtn!.disabled).toBe(false)

    mounted.unmount()
  })

  it('card so sánh Trước ⇒ Sau hiện khi chọn item ở Tẩy Luyện — bảng theo từng dòng phụ (2026-10-08: layout chung forge, strip + Điểm Rèn caption bỏ)', async () => {
    const mounted = mountTab((manager) => {
      const ore = materials.find((m) => m.id === 'qi_refining_ore_century')!
      manager.materialBag.add(ore, 100)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    mounted.selectedInstanceId.value = 'equipped'
    await nextTick()

    const card = mounted.container.querySelector('.equipment-forge-workspace')
    expect(card).not.toBeNull()

    // Fixture item khong co affix nao (affixes: []) - khong co gi de so
    // sanh theo dong nen KHONG hien bang so sanh, chi hien thong bao trong.
    expect(card!.querySelector('.forge-compare')).toBeNull()
    expect(card!.textContent).toContain('Chưa có dòng phụ')

    mounted.unmount()
  })

  // Owner ruling 2026-10-09 - item 0 dong phu khong co gi de reroll:
  // nut Tay Luyen disabled (domain tra no_affixes neu goi tay).
  it('item không có dòng phụ → nút Tẩy Luyện bị disabled dù đủ nguyên liệu', async () => {
    const mounted = mountTab((manager) => {
      const essence = materials.find((m) => m.id === LUYEN_KHI_TINH_HOA_ID)!
      manager.materialBag.add(essence, 10)
      manager.materialBag.add(SPIRIT_STONE_MATERIAL, 10_000)
    })

    mounted.selectedInstanceId.value = 'equipped'
    await nextTick()

    const washBtn = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Tẩy Luyện')
    expect(washBtn).toBeDefined()
    expect(washBtn!.disabled).toBe(true)

    mounted.unmount()
  })
})

// T4-33 - paid-preview honesty: the compare table hid rolled lines that
// outnumbered the current affixes, mislabeled a zero-line roll as
// "not rolled", kept a dead armed "Keep" button after a failed commit (the domain
// already ate the ticket), and never discarded the paid ticket on unmount.
describe('WashTab - preview honesty (T4-33)', () => {
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
    mounted.selectedInstanceId.value = 'equipped'
    await nextTick()

    const washBtn = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.trim() === 'Tẩy Luyện')!
    washBtn.click()
    await nextTick()
  }

  // Owner ruling 2026-10-09 - count bao toan: moi dong hien co co dung
  // mot cap cell before/after (khong con dong moi/mat do count doi).
  it('pending roll renders one before/after pair per preserved line', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const mounted = mountTab((manager) => prepareWashable(manager, 'huyen'))
    await selectAndPreview(mounted)

    // The card always renders 5 slots - count only DATA cells (the
    // empty filler slots keep their slot but carry --empty).
    const beforeRows = mounted.container.querySelectorAll(
      '.forge-compare > .forge-compare__cell:not(.forge-compare__cell--next):not(.forge-compare__cell--empty)',
    )
    expect(beforeRows).toHaveLength(1)

    const afterRows = mounted.container.querySelectorAll('.forge-compare__cell--next')
    expect(afterRows).toHaveLength(1)

    mounted.unmount()
  })

  it('failed commit still clears the armed ticket (domain consumed it)', async () => {
    const mounted = mountTab((manager) => prepareWashable(manager, 'huyen'))
    await selectAndPreview(mounted)

    // Lock AFTER the preview - commit revalidation rejects it.
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
