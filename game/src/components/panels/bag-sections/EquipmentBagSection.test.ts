// @vitest-environment jsdom
// item-info-card task 6 (2026-09-14) - equipment bag cells: aria-label
// carries the Pham word (spec section 5b) and the tooltip of an
// UNEQUIPPED candidate carries compareWith when a worn counterpart
// exists (spec section 4 paired compare cards).
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
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
