// @vitest-environment jsdom
// Task 19 (item-grade-quality-rework, rework P6) — RefineTab extracted
// from EquipmentHallPanel.test.ts. RefineTab injects HALL_SELECTION_KEY
// (shared with WashTab) — test harness provides it like the shell does.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import RefineTab from './RefineTab.vue'
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

  const app = createApp({ render: () => h(RefineTab) })
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
  setLocale('vi')
  document.body.innerHTML = ''
})

describe('RefineTab — Tinh Luyện', () => {
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
    const mounted = mountTab()

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
    const mounted = mountTab((manager) => {
      const instance = manager.equipmentBag.get('equipped')!
      instance.affixes = [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }]
      manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 100)
      manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL.id), 1_000)
    })

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

  it('unmount tab hủy capability Refine còn chờ để overlay mới không thể giữ payload cũ', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const mounted = mountTab((manager) => {
      const instance = manager.equipmentBag.get('equipped')!
      instance.affixes = [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }]
      manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 100)
      manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL.id), 1_000)
    })
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
    const mounted = mountTab((manager) => {
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

    const slots = mounted.container.querySelectorAll(
      '[aria-label="Chọn trang bị để tinh luyện"] .slot-view',
    )
    ;(slots[0] as HTMLElement).click()
    await nextTick()

    expect(mounted.container.querySelector('.qi-hall__costline')?.textContent).toContain('37')

    mounted.unmount()
  })
})
