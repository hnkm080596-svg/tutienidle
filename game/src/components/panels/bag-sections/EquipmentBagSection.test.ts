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

describe('EquipmentBagSection - toolbar (type select + sort)', () => {
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

  // Toolbar dropdowns are BagChipSelect: button opens a role=listbox
  // whose li[role=option] entries carry the option order of the given
  // option list. `pickOption` opens dropdown `index` and clicks the
  // option at `optionIndex` (value-independent - indexes come from the
  // component's own TYPE_OPTIONS/SORT_OPTIONS order).
  async function pickOption(container: HTMLElement, dropdownIndex: number, optionIndex: number) {
    const dropdowns = container.querySelectorAll<HTMLElement>('.bag-section__toolbar .chip-select')
    const btn = dropdowns[dropdownIndex]?.querySelector<HTMLElement>('.chip-select__button')
    if (!btn) throw new Error(`chip-select ${dropdownIndex} not found`)
    btn.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    const options = dropdowns[dropdownIndex]!.querySelectorAll<HTMLElement>('[role=option]')
    options[optionIndex]?.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
  }

  function mountTwoItems() {
    return mountSection((manager) => {
      manager.equipmentBag.add(bagItem('sword', 'base_kiem', 'weapon'))
      manager.equipmentBag.add(bagItem('armor', 'base_bao', 'armor'))
    })
  }

  // TYPE_OPTIONS order: all(0) weapon(1) helmet(2) armor(3) boots(4) ring(5) necklace(6)
  it('selecting an item type filters cells to that equipment slot', async () => {
    const mounted = mountTwoItems()

    await pickOption(mounted.container, 0, 3)

    const filled = filledSlots(mounted.container)

    expect(filled).toHaveLength(1)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Bào')

    mounted.unmount()
  })

  it("'Tất cả' option restores the full list", async () => {
    const mounted = mountTwoItems()

    await pickOption(mounted.container, 0, 3)
    expect(filledSlots(mounted.container)).toHaveLength(1)

    await pickOption(mounted.container, 0, 0)
    expect(filledSlots(mounted.container)).toHaveLength(2)

    await pickOption(mounted.container, 0, 1)
    expect(filledSlots(mounted.container)).toHaveLength(1)

    mounted.unmount()
  })

  it('pager hides under one page and flips pages past 40 cells (owner ruling)', async () => {
    const small = mountTwoItems()
    expect(small.container.querySelector('.bag-section__pager')).toBeNull()
    small.unmount()

    const mounted = mountSection((manager) => {
      for (let i = 0; i < 45; i += 1) {
        manager.equipmentBag.add(bagItem(`item-${i}`, 'base_kiem', 'weapon'))
      }
    })

    const pager = mounted.container.querySelector<HTMLElement>('.bag-section__pager')
    const label = () => mounted.container.querySelector('.bag-section__page-label')!.textContent
    expect(pager).not.toBeNull()
    expect(label()).toBe('1/2')
    expect(filledSlots(mounted.container)).toHaveLength(40)

    const next = mounted.container.querySelector<HTMLElement>('.bag-section__page-btn:nth-child(3)')!
    next.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(label()).toBe('2/2')
    expect(filledSlots(mounted.container)).toHaveLength(5)

    const prev = mounted.container.querySelector<HTMLElement>('.bag-section__page-btn:first-child')!
    prev.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(label()).toBe('1/2')

    mounted.unmount()
  })

  it('re-picking the same sort mode flips direction (owner ruling: no +/- button)', async () => {
    const mounted = mountTwoItems()

    // name sort asc: 'Bào' (armor) before 'Kiếm' (sword).
    // SORT_MODES order: default quality rarity realm slot name(5) forge
    await pickOption(mounted.container, 1, 5)
    let filled = filledSlots(mounted.container)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Bào')
    expect(filled[1]!.getAttribute('aria-label')).toContain('Kiếm')

    // Re-pick 'name' -> direction flips to desc.
    await pickOption(mounted.container, 1, 5)

    filled = filledSlots(mounted.container)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Kiếm')
    expect(filled[1]!.getAttribute('aria-label')).toContain('Bào')

    mounted.unmount()
  })
})
