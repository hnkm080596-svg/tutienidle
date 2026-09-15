// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentPaperdoll from './EquipmentPaperdoll.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import { useTooltip } from '@/composables/useTooltip'
import type { EquipmentTooltipContent } from '@/composables/useTooltip'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'

function equipmentInstance(instanceId: string, itemId: string) {
  return makeInstance({
    instanceId,
    itemId,
    equipped: true,
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

function mountPaperdoll(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.catalogOps.registerEquipment(equipment)
  prepare?.(manager)

  const app = createApp({ render: () => h(EquipmentPaperdoll) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('EquipmentPaperdoll — registry miss an toàn', () => {
  it('itemId lạ (registry miss) không chết paperdoll — slot vẫn render, caption dùng itemId thô', async () => {
    // Audit fix 2026-08-31 — equipmentRegistry.get() throw với itemId lạ
    // (data edit/save lệch) chết cả khối trang bị qua ErrorBoundary;
    // computed/helper phải tra an toàn + fallback hiển thị (pattern
    // Task 13 EquipmentBagSection.vue).
    const mounted = mountPaperdoll((manager) => {
      manager.equipmentBag.add(equipmentInstance('ghost-item', 'nonexistent_item'))
    })

    await nextTick()

    // 6 slot luôn render — không throw.
    const slots = mounted.container.querySelectorAll('.paperdoll__slot')

    expect(slots).toHaveLength(6)

    // Weapon slot wearing a foreign item - aria-label falls back to the
    // raw itemId + Pham suffix (accessibleLabel spec section 5b:
    // "{name}, {grade}").
    const weapon = mounted.container.querySelector<HTMLElement>('.paperdoll__slot[aria-label="nonexistent_item, Cửu Phẩm"]')

    expect(weapon).not.toBeNull()

    mounted.unmount()
  })
})

describe('EquipmentPaperdoll - slot labels via i18n (P16)', () => {
  it('6 slots use panels.bag.paperdoll.slots.* keys instead of hardcode', () => {
    const mounted = mountPaperdoll()

    const keys = ['helmet', 'necklace', 'ring', 'weapon', 'armor', 'boots']
    const labels = [...mounted.container.querySelectorAll('.paperdoll__slot')]
      .map(slot => slot.getAttribute('aria-label'))

    for (const key of keys) {
      expect(labels).toContain(i18n.global.t(`panels.bag.paperdoll.slots.${key}`))
    }

    mounted.unmount()
  })
})

describe('EquipmentPaperdoll - item-info-card cell contract', () => {
  it('filled slot aria-label is "{name}, {grade}" (spec section 5b); equipped-only tooltip has NO compareWith (spec section 4)', async () => {
    const mounted = mountPaperdoll((manager) => {
      manager.equipmentBag.add(equipmentInstance('worn', 'base_kiem'))
    })

    await nextTick()

    const slot = mounted.container.querySelector<HTMLElement>('.paperdoll__slot[aria-label="Kiếm, Cửu Phẩm"]')

    expect(slot).not.toBeNull()

    // Equipped-only surface: the worn item IS the compare counterpart -
    // no paired card on its own tooltip (item-info-card task 6).
    slot!.dispatchEvent(new Event('pointerenter', { bubbles: true }))

    const content = useTooltip().content.value as EquipmentTooltipContent | null

    expect(content?.kind).toBe('equipment')
    expect(content && 'compareWith' in content).toBe(false)

    useTooltip().dismissTooltip()
    mounted.unmount()
  })
})
