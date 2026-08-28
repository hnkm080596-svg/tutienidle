// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import FunctionOverlayPanel from './FunctionOverlayPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import type { Building } from '@/core/building/Building'
import type { Material } from '@/core/material/Material'

const WOOD: Material = {
  id: 'test_wood',
  name: 'Linh Mộc Test',
  category: 'wood',
  sourceType: 'building',
}

const SPRING: Building = {
  id: 'spirit_spring',
  name: 'Linh Tuyền',
  description: 'Tích luỹ Linh Thạch.',
  category: 'resource',
  tier: 1,
  maxLevel: 3,
  baseStorageCapacity: 60,
  baseProductionRate: 1,
  producesMaterialId: 'spirit_stone',
  functionType: 'spirit_spring',
  upgradeCost: [
    [{ materialId: WOOD.id, amount: 1 }],
    [{ materialId: WOOD.id, amount: 2 }],
    [{ materialId: WOOD.id, amount: 3 }],
  ],
}

function mountSpringPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)
  gameManager.registerMaterials([WOOD])
  gameManager.registerBuildings([SPRING])
  gameManager.buildingManager.add({
    instanceId: 'spring_instance',
    buildingId: SPRING.id,
    level: 1,
    lastCollectedAt: Date.now() / 1000,
  })
  gameManager.materialBag.add(WOOD, 2)

  const app = createApp({ render: () => h(FunctionOverlayPanel) })

  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  useUiStore(pinia).leftPanelMode = 'spirit_spring'
  usePlayerStore(pinia).realmId = 'qi_refining'
  app.mount(container)

  return {
    container,
    gameManager,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FunctionOverlayPanel — building header và Linh Tuyền', () => {
  it('render Linh Tuyền trong overlay theo thứ tự Tên → Cấp → Nâng cấp', async () => {
    const mounted = mountSpringPanel()
    const header = mounted.container.querySelector<HTMLElement>('.building-panel-header')!
    const firstTags = Array.from(header.children)
      .slice(0, 3)
      .map((element) => element.tagName)

    expect(firstTags).toEqual(['IMG', 'DIV', 'DIV'])
    expect(header.querySelector('.building-panel-header__art')).not.toBeNull()
    expect(header.querySelector('.building-panel-header__identity h2')).not.toBeNull()
    expect(header.querySelector('.building-panel-header__upgrade-area button')).not.toBeNull()
    expect(mounted.container.querySelector('.construction-gate__upgrade')).toBeNull()
    expect(mounted.container.querySelectorAll('.building-panel-header__upgrade')).toHaveLength(1)
    expect(header.textContent).toContain('Nâng công trình')
    expect(header.textContent).toContain('Linh Tuyền')
    expect(header.textContent).toContain('Cấp 1 / 3')
    expect(mounted.container.querySelector('.spirit-spring-panel')).not.toBeNull()

    header.querySelector<HTMLButtonElement>('.building-panel-header__upgrade')!.click()
    await nextTick()

    expect(mounted.gameManager.buildingManager.getByBuildingId(SPRING.id)?.level).toBe(2)
    expect(header.textContent).toContain('Cấp 2 / 3')

    mounted.unmount()
  })
})
