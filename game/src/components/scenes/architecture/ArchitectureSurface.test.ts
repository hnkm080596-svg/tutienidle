// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import ArchitectureSurface from './ArchitectureSurface.vue'
import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { buildings } from '@/data/building/buildings'
import { i18n } from '@/i18n'
import { GAME_MANAGER_KEY, BUMP_STATE_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { isBetaLeftPanelMode } from '@/core/betaScopeSurface'

function mountArchitecture() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const manager = new GameManager()
  const player = createDefaultPlayer()
  const stateVersion = ref(0)
  manager.catalogOps.registerBuildings(buildings)
  manager.buildingOps.reconcileBuildings(player, 0)
  manager.setActivePlayer(player)
  document.body.appendChild(container)
  const app = createApp({ render: () => h(ArchitectureSurface) })
  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value += 1 })
  app.mount(container)
  return { app, container, manager, player }
}

afterEach(() => { document.body.innerHTML = '' })

describe('Architecture surface', () => {
  it('admits Kiến Trúc through the beta left-panel seam', () => {
    expect(isBetaLeftPanelMode('architecture')).toBe(true)
  })

  it('renders the six authored buildings with art-only states and no English IDs', () => {
    const mounted = mountArchitecture()
    try {
      expect(mounted.container.querySelectorAll('[data-testid="architecture-building-card"]')).toHaveLength(6)
      expect(mounted.container.querySelector('[data-building-id="vendor"]')?.textContent).toContain('Chỉ trưng bày')
      expect(mounted.container.querySelector('[data-building-id="chi_hien_quan"]')?.textContent).toContain('Chỉ trưng bày')
      expect(mounted.container.querySelectorAll('[data-building-id="vendor"] [data-testid="architecture-building-upgrade"]')).toHaveLength(0)
      expect(mounted.container.querySelectorAll('[data-building-id="chi_hien_quan"] [data-testid="architecture-building-upgrade"]')).toHaveLength(0)
      expect(mounted.container.textContent).not.toContain('gathering_outpost')
      expect(mounted.container.textContent).not.toContain('pill_room')
    } finally { mounted.app.unmount() }
  })

  it('opens Khai Vật details with the four production-site upgrade actions', async () => {
    const mounted = mountArchitecture()
    try {
      const details = mounted.container.querySelector<HTMLButtonElement>('[data-building-id="gathering_outpost"] [data-testid="architecture-details"]')!
      details.click()
      await nextTick()
      expect(mounted.container.querySelectorAll('[data-testid="architecture-site-upgrade"]')).toHaveLength(3)
      expect(mounted.container.querySelector('[data-testid="architecture-resource-spirit_stone"]')).not.toBeNull()
    } finally { mounted.app.unmount() }
  })

  it('keeps a failed site upgrade clickable and gives a localized reason', async () => {
    const mounted = mountArchitecture()
    const quote = vi.spyOn(mounted.manager.buildingOps, 'quoteProductionUpgrade')
    const upgrade = vi.spyOn(mounted.manager.buildingOps, 'upgradeProductionSite').mockReturnValue(false)
    try {
      mounted.container.querySelector<HTMLButtonElement>('[data-building-id="gathering_outpost"] [data-testid="architecture-details"]')!.click()
      await nextTick()
      const action = mounted.container.querySelector<HTMLButtonElement>('[data-testid="architecture-site-upgrade"]')!
      expect(action.disabled).toBe(false)
      quote.mockClear()
      action.click()
      await nextTick()
      expect(quote).toHaveBeenCalled()
      expect(upgrade).not.toHaveBeenCalled()
      expect(mounted.container.querySelector('[role="status"]')?.textContent).toMatch(/tối đa|thiếu|không đủ|cảnh giới/i)
    } finally { mounted.app.unmount() }
  })
})
