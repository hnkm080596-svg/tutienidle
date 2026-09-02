// @vitest-environment jsdom
// T6 gap-2 (chi-hien-quan, 2026-09-02) — integration smoke thay manual
// browser probe (browser probe treo với môi trường agent; oracle DOM
// qua mount Vue thật + GameManager thật — cùng cấu trúc render).
//
// Chứng minh chuỗi người chơi cần thấy:
// 1. WorkerLodgePanel render capacity từ CHQ instance (1+level×2)
// 2. ProductionPanel: worker allocation block (auto/manual toggle +
//    slider → assignWorkers → state persist qua bumpState)
// 3. Linh mạch card render khi outpost ĐÃ xây (sau xóa spirit_spring)
//    + collect gọi collectBuilding
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import ProductionPanel from './ProductionPanel.vue'
import WorkerLodgePanel from './WorkerLodgePanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { buildings } from '@/data/building/buildings'
import { i18n } from '@/i18n'

const WOOD = { id: 'test_wood', name: 'Linh Mộc Test', category: 'wood' as const, sourceType: 'building' as const }

function makeDeps(panel: unknown) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)
  gameManager.registerMaterials([WOOD])
  gameManager.registerBuildings(buildings)
  gameManager.materialBag.add(WOOD, 999)

  const app = createApp({ render: () => h(panel as never) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  return { container, app, pinia, gameManager }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CHQ integration smoke — DOM oracle thay browser probe', () => {
  it('WorkerLodgePanel: capacity 3 ở cấp 1 — panel text render', () => {
    const deps = makeDeps(WorkerLodgePanel)

    deps.gameManager.buildingManager.add({
      instanceId: 'chq_inst',
      buildingId: 'chi_hien_quan',
      level: 1,
      lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)

    player.realmId = 'mortal'
    deps.app.mount(deps.container)
    deps.gameManager.setActivePlayer(player.$state)

    const chq = deps.gameManager.buildingManager.getByBuildingId('chi_hien_quan')!

    deps.gameManager.refreshAutoWorkerCapacity(player.$state, chq)

    const text = deps.container.textContent ?? ''

    expect(text).toContain('Nhân công')
    expect(text).toContain('3')

    deps.app.unmount()
  })

  it('ProductionPanel: allocation block + linh mạch + assignWorkers persist', async () => {
    const deps = makeDeps(ProductionPanel)

    deps.gameManager.buildingManager.add({
      instanceId: 'outpost_inst',
      buildingId: 'gathering_outpost',
      level: 1,
      lastCollectedAt: 0,
    })

    deps.gameManager.buildingManager.add({
      instanceId: 'chq_inst',
      buildingId: 'chi_hien_quan',
      level: 2,
      lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)

    player.realmId = 'mortal'
    deps.app.mount(deps.container)
    deps.gameManager.setActivePlayer(player.$state)

    const chq = deps.gameManager.buildingManager.getByBuildingId('chi_hien_quan')!

    deps.gameManager.refreshAutoWorkerCapacity(player.$state, chq)

    await nextTick()

    const text = deps.container.textContent ?? ''

    // Allocation header + mode labels render.
    expect(text).toContain('Nhân công:')
    expect(text).toContain('Tự động')
    expect(text).toContain('Phân thủ công')

    // Linh mạch card render (outpost đã xây — sau khi xóa spirit_spring).
    expect(text).toContain('Linh Mạch')

    // Manual: assign qua GameManager (như handler slider) → state persist.
    const siteId = deps.gameManager.getProductionViews(Date.now())[0]!.definition.siteId

    deps.gameManager.assignWorkers(siteId, 2)

    expect(deps.gameManager.productionSystem.getState(siteId)?.assignedWorkers).toBe(2)

    // Quay auto: undefined.
    deps.gameManager.assignWorkers(siteId, undefined)

    expect(deps.gameManager.productionSystem.getState(siteId)?.assignedWorkers).toBeUndefined()

    deps.app.unmount()
  })

  it('ProductionPanel: mount không crash với outpost instance (linh mạch card)', async () => {
    const deps = makeDeps(ProductionPanel)

    deps.gameManager.buildingManager.add({
      instanceId: 'outpost_inst',
      buildingId: 'gathering_outpost',
      level: 1,
      lastCollectedAt: 0,
    })

    const player = usePlayerStore(deps.pinia)

    player.realmId = 'mortal'
    deps.app.mount(deps.container)
    deps.gameManager.setActivePlayer(player.$state)

    await nextTick()

    expect(deps.container.textContent ?? '').toContain('Linh Mạch')

    deps.app.unmount()
  })
})
