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
  it('render Linh Tuyền trong overlay: ảnh + Tên + Cấp CÙNG MỘT dải title bar, nút Nâng cấp neo góc phải (2026-08-30: gộp 2 dải trùng tên/cấp làm 1)', async () => {
    const mounted = mountSpringPanel()
    const heading = mounted.container.querySelector<HTMLElement>('.overlay-panel__heading')!
    const actions = mounted.container.querySelector<HTMLElement>('.overlay-panel__header')!

    // Tên công trình CHỈ hiện MỘT LẦN DUY NHẤT, trong chính title bar —
    // không còn dải header con riêng bên dưới (BuildingPanelHeader.vue
    // đã bị xoá hẳn, thay bằng slot #heading/#header-actions của
    // OverlayPanel qua useBuildingHeaderState).
    expect(mounted.container.querySelector('.building-panel-header')).toBeNull()
    expect(heading.querySelector('.building-heading__art')).not.toBeNull()
    expect(heading.querySelector('.building-heading__name')?.textContent).toBe('Linh Tuyền')
    expect(heading.textContent).toContain('Cấp 1 / 3')
    expect((mounted.container.textContent!.match(/Linh Tuyền/g) ?? []).length).toBe(1)

    const upgradeButton = actions.querySelector<HTMLButtonElement>('.building-heading__upgrade')!
    expect(upgradeButton).not.toBeNull()
    expect(actions.textContent).toContain('Nâng công trình')
    expect(mounted.container.querySelector('.construction-gate__upgrade')).toBeNull()
    expect(mounted.container.querySelectorAll('.building-heading__upgrade')).toHaveLength(1)

    expect(mounted.container.querySelector('.spirit-spring-panel')).not.toBeNull()

    upgradeButton.click()
    await nextTick()

    expect(mounted.gameManager.buildingManager.getByBuildingId(SPRING.id)?.level).toBe(2)
    expect(heading.textContent).toContain('Cấp 2 / 3')

    mounted.unmount()
  })
})
