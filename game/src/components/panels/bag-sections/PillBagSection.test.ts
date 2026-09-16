// @vitest-environment jsdom
// Pill bag filter bar (presentation-debt): search narrows rendered
// cells, effect chips filter by effects[0].type, and re-clicking the
// active chip toggles back to 'all'. Mount harness mirrors
// EquipmentBagSection.test.ts (createApp + provide, no test-utils).
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import PillBagSection from './PillBagSection.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import type { Pill } from '@/core/pill/Pill'
import type { PillEffectType } from '@/core/pill/PillEffect'

function makePill(id: string, name: string, effectType: PillEffectType): Pill {
  return {
    id,
    name,
    type: 'healing',
    grade: 'hoang',
    effects: [{ type: effectType, value: 1 }],
  }
}

function mountSection(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  prepare?.(manager)

  const app = createApp({ render: () => h(PillBagSection) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, manager, unmount: () => app.unmount() }
}

function filledSlots(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.bag-section__slot.slot-view--filled'))
}

function countText(container: HTMLElement): string {
  return container.querySelector<HTMLElement>('.bag-section__count')?.textContent?.trim() ?? ''
}

function chips(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.bag-section__chips .chip'))
}

function chipByLabel(container: HTMLElement, label: string): HTMLElement {
  const chip = chips(container).find((el) => el.textContent?.trim() === label)

  if (!chip) {
    throw new Error(`Chip not found: ${label}`)
  }

  return chip
}

// jsdom has no ResizeObserver - useBagGridLayout observes the grid on
// mount; stub per EquipmentBagSection.test.ts pattern.
beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)
})

describe('PillBagSection - filter bar', () => {
  it('search narrows the rendered cells (diacritics-insensitive)', async () => {
    const mounted = mountSection((manager) => {
      manager.pillBag.add(makePill('heal-1', 'Tiểu Hồi Đan', 'heal'), 1)
      manager.pillBag.add(makePill('cult-1', 'Tụ Linh Đan', 'cultivation'), 1)
    })

    expect(filledSlots(mounted.container)).toHaveLength(2)

    const input = mounted.container.querySelector<HTMLInputElement>('.bag-section__search')
    expect(input).not.toBeNull()

    // Diacritic-free query must still match the composed display name
    // ("Hoang - Tieu Hoi Dan" after NFD strip).
    input!.value = 'tieu hoi'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    const filled = filledSlots(mounted.container)
    expect(filled).toHaveLength(1)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Tiểu Hồi Đan')
    expect(countText(mounted.container)).toBe(`1 ${i18n.global.t('panels.bag.countUnitSuffix')}`)

    mounted.unmount()
  })

  it('effect chip filters by effects[0].type', async () => {
    const mounted = mountSection((manager) => {
      manager.pillBag.add(makePill('heal-1', 'Tiểu Hồi Đan', 'heal'), 1)
      manager.pillBag.add(makePill('cult-1', 'Tụ Linh Đan', 'cultivation'), 1)
    })

    const healChip = chipByLabel(mounted.container, i18n.global.t('bag.filter.pillEffect.heal'))
    healChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    const filled = filledSlots(mounted.container)
    expect(filled).toHaveLength(1)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Tiểu Hồi Đan')
    expect(countText(mounted.container)).toBe(`1 ${i18n.global.t('panels.bag.countUnitSuffix')}`)

    mounted.unmount()
  })

  it('re-clicking the active chip resets to all', async () => {
    const mounted = mountSection((manager) => {
      manager.pillBag.add(makePill('heal-1', 'Tiểu Hồi Đan', 'heal'), 1)
      manager.pillBag.add(makePill('cult-1', 'Tụ Linh Đan', 'cultivation'), 1)
    })

    const healChip = chipByLabel(mounted.container, i18n.global.t('bag.filter.pillEffect.heal'))

    healChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()
    expect(filledSlots(mounted.container)).toHaveLength(1)

    healChip.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    expect(filledSlots(mounted.container)).toHaveLength(2)
    expect(countText(mounted.container)).toBe(`2 ${i18n.global.t('panels.bag.countUnitSuffix')}`)

    mounted.unmount()
  })
})
