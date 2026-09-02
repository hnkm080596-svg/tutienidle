// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentPaperdoll from './EquipmentPaperdoll.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
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
      stat: 'attack',
      flat: 12,
    },
  })
}

function mountPaperdoll(prepare?: (manager: GameManager) => void) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.registerEquipment(equipment)
  prepare?.(manager)

  const app = createApp({ render: () => h(EquipmentPaperdoll) })
  app.use(pinia)
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

    // Slot weapon đang mặc item lạ — caption fallback itemId thô.
    const weapon = mounted.container.querySelector<HTMLElement>('.paperdoll__slot[aria-label="nonexistent_item"]')

    expect(weapon).not.toBeNull()

    mounted.unmount()
  })
})
