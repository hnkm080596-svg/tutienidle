// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import FunctionOverlayPanel from './FunctionOverlayPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { buildings } from '@/data/building/buildings'
import type { Material } from '@/core/material/Material'
import { i18n } from '@/i18n'
import { unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// This suite exercises machinery the production feature table gates
// (hidden lineage / companion / workforce / sword-body ways) - it rides
// the full catalog like the pre-lock suite default did.
unlockAllFeaturesForTests()

const WOOD: Material = {
  id: 'test_wood',
  name: 'Linh Mộc Test',
  category: 'wood',
  sourceType: 'building',
}

function mountSpringPanel(realmId = 'qi_refining', mode: 'worker_lodge' | 'architecture' = 'worker_lodge') {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)
  gameManager.catalogOps.registerMaterials([WOOD])
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.buildingManager.add({
    instanceId: 'spring_instance',
    buildingId: 'chi_hien_quan',
    level: 1,
    lastCollectedAt: Date.now() / 1000,
  })
  gameManager.materialBag.add(WOOD, 2)

  const app = createApp({ render: () => h(FunctionOverlayPanel) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })

  useUiStore(pinia).leftPanelMode = mode
  const playerStore = usePlayerStore(pinia)
  playerStore.realmId = realmId
  // Production wiring (App.vue): the domain quote reads the ACTIVE player,
  // not the Pinia store object - mirror that or the realm gate is skipped.
  gameManager.setActivePlayer(playerStore.$state)
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

describe('FunctionOverlayPanel — legacy Chiêu Hiền Quán route is closed', () => {
  it('does not mount the obsolete worker panel or expose a decentralized upgrade', async () => {
    const mounted = mountSpringPanel()
    await nextTick()
    expect(mounted.container.querySelector('.overlay-panel')).toBeNull()
    expect(mounted.container.querySelector('.worker-lodge-panel')).toBeNull()
    expect(mounted.container.querySelector('.building-heading__upgrade')).toBeNull()

    mounted.unmount()
  })

  it('raw legacy mode stays rejected regardless of realm', async () => {
    const mounted = mountSpringPanel('mortal')
    expect(mounted.container.querySelector('.overlay-panel')).toBeNull()
    expect(mounted.container.querySelector('.worker-lodge-panel')).toBeNull()

    mounted.unmount()
  })

  it('Architecture mounts its paper scene without also mounting the legacy overlay', async () => {
    const mounted = mountSpringPanel('qi_refining', 'architecture')
    await nextTick()
    expect(mounted.container.querySelector('[data-testid="architecture-building-card"]')).not.toBeNull()
    expect(mounted.container.querySelector('.overlay-panel')).toBeNull()
    mounted.unmount()
  })
})
