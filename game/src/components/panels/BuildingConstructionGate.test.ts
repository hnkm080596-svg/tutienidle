// @vitest-environment jsdom
// T4-31 — the gate's `canBuild` computed never read `stateVersion`, so
// materials arriving after mount left the build button disabled forever
// (and material loss could never re-disable it). The fix threads
// stateVersion into the computed; this test mounts the real component
// with a real GameManager and asserts the DOM flips on bumpState().
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import { GameManager } from '@/core/game/GameManager'
import type { Building } from '@/core/building/Building'
import type { Material } from '@/core/material/Material'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'

const PILL_ROOM_DEF: Building = {
  id: 'pill_room',
  name: 'Đan Phòng',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 3,
  baseStorageCapacity: 0,
  upgradeCost: [
    [{ materialId: 'go_linh_moc', amount: 5 }],
    [{ materialId: 'go_linh_moc', amount: 10 }],
    [{ materialId: 'go_linh_moc', amount: 20 }],
  ],
  functionType: 'pill_room',
}

const UPGRADE_MATERIAL: Material = {
  id: 'go_linh_moc',
  name: 'Gỗ Linh Mộc',
  category: 'wood',
  sourceType: 'building',
}

function mountGate(gameManager: GameManager, buildingId: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stateVersion = ref(0)
  const app = createApp({
    render: () => h(BuildingConstructionGate, { buildingId }),
  })

  app.use(createPinia())
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.mount(container)

  return {
    buildButton: () =>
      container.querySelector<HTMLButtonElement>('.construction-gate__build'),
    bump: async () => {
      stateVersion.value += 1
      await nextTick()
    },
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

afterEach(() => {
  window.localStorage.removeItem('dev.testModeUnlockAll')
})

describe('BuildingConstructionGate — canBuild re-evaluates on stateVersion (T4-31)', () => {
  it('build button starts disabled without materials and enables after the bag gains them + bumpState', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerMaterials([UPGRADE_MATERIAL])
    gameManager.catalogOps.registerBuildings([PILL_ROOM_DEF])

    const mounted = mountGate(gameManager, 'pill_room')
    await nextTick()

    expect(mounted.buildButton()!.disabled).toBe(true)

    gameManager.materialBag.add(UPGRADE_MATERIAL, 5)
    await mounted.bump()

    expect(mounted.buildButton()!.disabled).toBe(false)

    mounted.unmount()
  })

  it('re-disables when materials drop below cost + bumpState', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerMaterials([UPGRADE_MATERIAL])
    gameManager.catalogOps.registerBuildings([PILL_ROOM_DEF])
    gameManager.materialBag.add(UPGRADE_MATERIAL, 5)

    const mounted = mountGate(gameManager, 'pill_room')
    await nextTick()

    expect(mounted.buildButton()!.disabled).toBe(false)

    gameManager.materialBag.remove('go_linh_moc', 5)
    await mounted.bump()

    expect(mounted.buildButton()!.disabled).toBe(true)

    mounted.unmount()
  })
})
