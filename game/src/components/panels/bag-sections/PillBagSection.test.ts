// @vitest-environment jsdom
// Pill bag toolbar (owner ruling 2026-10-11: equipment-bag layout, no
// search field): effect dropdown filters by effects[0].type and the
// 'all' option resets. Mount harness mirrors
// EquipmentBagSection.test.ts (createApp + provide, no test-utils).
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import PillBagSection from './PillBagSection.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { useTooltip, type GradedItemTooltipContent } from '@/composables/useTooltip'
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
  return container.querySelector<HTMLElement>('.bag-section__count-label')?.textContent?.trim() ?? ''
}

async function pickOption(container: HTMLElement, label: string) {
  const select = container.querySelector<HTMLButtonElement>('.chip-select__button')

  if (!select) {
    throw new Error('family select not found')
  }

  select.dispatchEvent(new Event('click', { bubbles: true }))
  await nextTick()

  const option = Array.from(
    container.querySelectorAll<HTMLElement>('.chip-select__option'),
  ).find((el) => el.textContent?.trim() === label)

  if (!option) {
    throw new Error(`Option not found: ${label}`)
  }

  option.dispatchEvent(new Event('click', { bubbles: true }))
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
  it('effect select filters by effects[0].type', async () => {
    const mounted = mountSection((manager) => {
      manager.pillBag.add(makePill('heal-1', 'Tiểu Hồi Đan', 'heal'), 1)
      manager.pillBag.add(makePill('cult-1', 'Tụ Linh Đan', 'cultivation'), 1)
    })

    await pickOption(mounted.container, i18n.global.t('bag.filter.pillEffect.heal'))
    await nextTick()

    const filled = filledSlots(mounted.container)
    expect(filled).toHaveLength(1)
    expect(filled[0]!.getAttribute('aria-label')).toContain('Tiểu Hồi Đan')
    expect(countText(mounted.container)).toBe('1/100')

    mounted.unmount()
  })

  it('picking the all option resets the filter', async () => {
    const mounted = mountSection((manager) => {
      manager.pillBag.add(makePill('heal-1', 'Tiểu Hồi Đan', 'heal'), 1)
      manager.pillBag.add(makePill('cult-1', 'Tụ Linh Đan', 'cultivation'), 1)
    })

    await pickOption(mounted.container, i18n.global.t('bag.filter.pillEffect.heal'))
    await nextTick()
    expect(filledSlots(mounted.container)).toHaveLength(1)

    await pickOption(mounted.container, i18n.global.t('panels.bag.groups.all'))
    await nextTick()

    expect(filledSlots(mounted.container)).toHaveLength(2)
    expect(countText(mounted.container)).toBe('2/100')

    mounted.unmount()
  })

  it('tooltip reflects stack rolled quality and uplifted effect values (QA-INV-01)', () => {
    const mounted = mountSection((manager) => {
      const pill: Pill = {
        id: 'tu_khi_dan_qi_refining',
        name: 'Tụ Khí Đan',
        type: 'cultivation',
        grade: 'hoang',
        effects: [{ type: 'cultivation', cultivationPercent: 0.03 }],
      }
      manager.pillBag.add(pill, 2, 'tien')
    })

    const slot = filledSlots(mounted.container)[0]!
    slot.dispatchEvent(new Event('pointerenter', { bubbles: true }))

    const content = useTooltip().content.value as GradedItemTooltipContent | null
    expect(content?.kind).toBe('pill')
    expect(content?.gradeKey).toBe('tien')
    expect(content?.nameTone).toBe('tien')
    expect(content?.name).toContain('Tiên')
    expect(content?.name).toContain('Tụ Khí Đan')
    expect(content?.slotPreview?.rarityRank).toBe(5)
    expect(content?.sections[0]?.rows[0]?.value).toContain('+6')

    useTooltip().dismissTooltip()
    mounted.unmount()
  })
})
