// @vitest-environment jsdom
// Vendor is now an art-only building card on the Architecture surface.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import ArchitectureSurface from '../scenes/architecture/ArchitectureSurface.vue'
import { GameManager } from '@/core/game/GameManager'
import { getArchitectureBuildingModels } from '@/core/game/ArchitectureReadModel'
import { isBetaBuildingSurface, isBetaLeftPanelMode } from '@/core/betaScopeSurface'
import { createDefaultPlayer } from '@/core/player/Player'
import { buildings } from '@/data/building/buildings'
import { i18n } from '@/i18n'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'

function mountArchitecture() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const player = createDefaultPlayer()
  const stateVersion = ref(0)
  manager.catalogOps.registerBuildings(buildings)
  manager.buildingOps.reconcileBuildings(player, 0)
  manager.setActivePlayer(player)
  const app = createApp({ render: () => h(ArchitectureSurface) })
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value += 1 })
  document.body.appendChild(container)
  app.mount(container)
  return { app, container, manager, player }
}

afterEach(() => { document.body.innerHTML = '' })

describe('Vendor Architecture card', () => {
  it('retains the vendor as nonfunctional art data without adding commerce to the six-card Architecture scene', () => {
    const mounted = mountArchitecture()
    try {
      const vendor = getArchitectureBuildingModels(mounted.manager, mounted.player).find(model => model.id === 'vendor')
      expect(vendor).toMatchObject({ artOnly: true, canUpgrade: false, maxed: true, maxLevel: 1 })
      expect(vendor?.currentEffects).toEqual([])
      expect(vendor?.nextEffects).toEqual([])
      expect(vendor?.costs).toEqual([])
      expect(isBetaBuildingSurface('vendor')).toBe(false)
      expect(isBetaLeftPanelMode('vendor')).toBe(false)
      expect(mounted.container.querySelectorAll('.architecture-card')).toHaveLength(6)
      expect(mounted.container.querySelector('[data-building-id="vendor"]')).toBeNull()
      expect(mounted.container.querySelector('[data-testid*="sale"]')).toBeNull()
    } finally {
      mounted.app.unmount()
    }
  })
})
