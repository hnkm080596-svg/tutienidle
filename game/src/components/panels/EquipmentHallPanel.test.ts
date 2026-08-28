// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import EquipmentHallPanel from './EquipmentHallPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { equipment } from '@/data/equipment/equipment'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'

function equipmentInstance(instanceId: string, equipped: boolean): EquipmentInstance {
  return {
    instanceId,
    itemId: 'base_kiem',
    slot: 'weapon',
    equipped,
    quality: 'pham_khi',
    rarity: 'hoang',
    realmId: 'mortal',
    realmLevel: 1,
    mainStat: {
      id: `${instanceId}:main`,
      sourceId: instanceId,
      sourceType: 'equipment',
      stat: 'attack',
      flat: 12,
    },
    affixes: [],
    forgePoints: 10,
    forgePotential: 100,
  }
}

function mountHall() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const version = ref(0)
  manager.registerEquipment(equipment)
  manager.equipmentBag.add(equipmentInstance('equipped', true))
  manager.equipmentBag.add(equipmentInstance('in-bag', false))

  const app = createApp({ render: () => h(EquipmentHallPanel) })
  app.use(pinia)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)

  return { container, unmount: () => app.unmount() }
}

afterEach(() => { document.body.innerHTML = '' })

describe('EquipmentHallPanel — chọn trang bị bằng slot', () => {
  it('Cường Hóa hiện đủ 6 slot và Tẩy Luyện chỉ hiện đồ đang mặc', async () => {
    const mounted = mountHall()

    expect(mounted.container.querySelectorAll('[aria-label="Chọn slot cường hóa"] .slot-view')).toHaveLength(6)

    const tabs = mounted.container.querySelectorAll<HTMLButtonElement>('.qi-hall__tabs button')
    tabs[1]!.click()
    await nextTick()

    const washSlots = mounted.container.querySelectorAll('[aria-label="Chọn trang bị để tẩy luyện"] .slot-view')
    expect(washSlots).toHaveLength(1)
    expect(washSlots[0]?.getAttribute('aria-label')).toBe('Kiếm')

    mounted.unmount()
  })
})
