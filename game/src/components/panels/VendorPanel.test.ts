// @vitest-environment jsdom
// Vendor is now an art-only building card on the Architecture surface.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import ArchitectureSurface from '../scenes/architecture/ArchitectureSurface.vue'
import { GameManager } from '@/core/game/GameManager'
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
  return { app, container }
}

afterEach(() => { document.body.innerHTML = '' })

describe('Vendor Architecture card', () => {
  it('shows the vendor as art-only with no sales or upgrade controls', () => {
    const mounted = mountArchitecture()
    try {
      const vendor = mounted.container.querySelector('[data-building-id="vendor"]')
      expect(vendor).not.toBeNull()
      expect(vendor?.textContent).toContain('Chỉ trưng bày')
      expect(vendor?.querySelectorAll('button')).toHaveLength(0)
      expect(vendor?.querySelectorAll('[data-testid*="sale"]')).toHaveLength(0)
    } finally {
      mounted.app.unmount()
    }
  })
})
