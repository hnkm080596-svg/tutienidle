// @vitest-environment jsdom
// item-info-card task 6 (2026-09-14) - equipment bag cells: aria-label
// carries the Pham word (spec section 5b) and the tooltip of an
// UNEQUIPPED candidate carries compareWith when a worn counterpart
// exists (spec section 4 paired compare cards).
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentBagSection from './EquipmentBagSection.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { useTooltip } from '@/composables/useTooltip'
import type { EquipmentTooltipContent } from '@/composables/useTooltip'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { EquipmentSlot } from '@/core/equipment/EquipmentTypes'
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

function mountSection(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  prepare?.(manager)

  const app = createApp({ render: () => h(EquipmentBagSection) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => app.unmount() }
}

// jsdom has no ResizeObserver - useBagGridLayout observes the grid on
// mount; stub per InventorySort.test.ts pattern.
beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)
})

describe('EquipmentBagSection - item-info-card cell contract', () => {
  it('cell aria-label is "{name}, {grade}" so Pham is readable without color (spec section 5b)', () => {
    const mounted = mountSection((manager) => {
      manager.equipmentBag.add(equipmentInstance('in-bag', false))
    })

    const slot = mounted.container.querySelector<HTMLElement>('.bag-section__slot')

    expect(slot).not.toBeNull()
    expect(slot!.getAttribute('aria-label')).toBe('Kiếm, Cửu Phẩm')

    mounted.unmount()
  })

  it('candidate tooltip carries compareWith when the slot has a worn counterpart (spec section 4)', () => {
    const mounted = mountSection((manager) => {
      manager.equipmentBag.add(equipmentInstance('worn', true))
      manager.equipmentBag.add(equipmentInstance('candidate', false))
    })

    const slot = mounted.container.querySelector<HTMLElement>('.bag-section__slot')

    slot!.dispatchEvent(new Event('pointerenter', { bubbles: true }))

    const content = useTooltip().content.value as EquipmentTooltipContent | null

    expect(content?.kind).toBe('equipment')
    expect(content?.compareWith?.name).toContain('Kiếm')
    // The equipped card never nests its own pair (spec section 4).
    expect(content?.compareWith && 'compareWith' in content.compareWith).toBe(false)

    useTooltip().dismissTooltip()
    mounted.unmount()
  })

  it('candidate tooltip has NO compareWith when the slot is empty', () => {
    const mounted = mountSection((manager) => {
      manager.equipmentBag.add(equipmentInstance('candidate', false))
    })

    const slot = mounted.container.querySelector<HTMLElement>('.bag-section__slot')

    slot!.dispatchEvent(new Event('pointerenter', { bubbles: true }))

    const content = useTooltip().content.value as EquipmentTooltipContent | null

    expect(content?.kind).toBe('equipment')
    expect(content && 'compareWith' in content).toBe(false)

    useTooltip().dismissTooltip()
    mounted.unmount()
  })
})

describe('EquipmentBagSection - filter bar (search + slot chips + count)', () => {
  function bagItem(instanceId: string, itemId: string, slot: EquipmentSlot): EquipmentInstance {
    return makeInstance({
      instanceId,
      itemId,
      slot,
      equipped: false,
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

  // gridCells pads the page with null cells; only item-backed slots get
  // the filled marker class.
  function filledSlots(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.slot-view--filled'))
  }

  function chipByLabel(container: HTMLElement, label: string): HTMLElement {
    const chip = Array.from(
      container.querySelectorAll<HTMLElement>('.bag-section__chips .chip'),
    ).find((el) => el.textContent?.includes(label))

    if (!chip) {
      throw new Error(`chip "${label}" not found`)
    }

    return chip
  }

  function countText(container: HTMLElement): string {
    return container.querySelector('.bag-section__count')?.textContent ?? ''
  }

  function mountTwoItems() {
    return mountSection((manager) => {
      manager.equipmentBag.add(bagItem('sword', 'base_kiem', 'weapon'))
      manager.equipmentBag.add(bagItem('armor', 'base_bao', 'armor'))
    })
  }

  it('search narrows rendered cells by name (diacritic-insensitive)', async () => {
    const mounted = mountTwoItems()

    const input = mounted.container.querySelector<HTMLInputElement>('.bag-section__search')

    expect(input).not.toBeNull()
    expect(input!.getAttribute('aria-label')).toBe('Tìm trang bị theo tên')

    input!.value = 'kiem'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const filled = filledSlots(mounted.container)

    expect(filled).toHaveLength(1)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Kiếm')
    expect(countText(mounted.container)).toBe('1 món')

    mounted.unmount()
  })

  it('selecting a slot chip filters cells to that equipment slot', async () => {
    const mounted = mountTwoItems()

    const armorChip = chipByLabel(mounted.container, 'Giáp')

    armorChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    const filled = filledSlots(mounted.container)

    expect(filled).toHaveLength(1)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Bào')
    expect(armorChip.getAttribute('aria-pressed')).toBe('true')
    expect(countText(mounted.container)).toBe('1 món')

    mounted.unmount()
  })

  it("'Tất cả' chip restores the list; re-clicking the active chip toggles it off", async () => {
    const mounted = mountTwoItems()

    const armorChip = chipByLabel(mounted.container, 'Giáp')

    armorChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(filledSlots(mounted.container)).toHaveLength(1)

    chipByLabel(mounted.container, 'Tất cả').dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(filledSlots(mounted.container)).toHaveLength(2)
    expect(countText(mounted.container)).toBe('2 món')

    // Toggle-off contract: clicking the already-active chip clears the group.
    armorChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(filledSlots(mounted.container)).toHaveLength(1)

    armorChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(filledSlots(mounted.container)).toHaveLength(2)

    mounted.unmount()
  })
})
