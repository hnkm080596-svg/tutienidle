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
import { vTooltip } from '@/directives/tooltip'
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
  for (const site of manager.productionSystem.getSiteDefinitions()) {
    manager.productionSystem.ensureSiteState(site.siteId)
  }
  document.body.appendChild(container)
  const app = createApp({ render: () => h(ArchitectureSurface) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
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

  it('renders equipment, alchemy, teleport and three production cards without retired surfaces', () => {
    const mounted = mountArchitecture()
    try {
      const ids = Array.from(mounted.container.querySelectorAll('[data-testid="architecture-building-card"]'))
        .map(card => card.getAttribute('data-building-id'))
      const siteIds = mounted.manager.buildingOps.getProductionViews().map(view => view.definition.siteId)
      expect(ids).toHaveLength(6)
      expect(new Set(ids)).toEqual(new Set(['equipment_hall', 'pill_room', 'teleport_array', ...siteIds]))
      for (const id of ['gathering_outpost', 'vendor', 'chi_hien_quan']) {
        expect(mounted.container.querySelector(`[data-building-id="${id}"]`)).toBeNull()
      }
      expect(mounted.container.querySelector('[data-testid="architecture-details"]')).toBeNull()
      expect(mounted.container.textContent).not.toContain('gathering_outpost')
      expect(mounted.container.textContent).not.toContain('pill_room')
    } finally { mounted.app.unmount() }
  })

  it('shows production upgrade costs directly on all three source cards', () => {
    const mounted = mountArchitecture()
    try {
      const sites = mounted.manager.buildingOps.getProductionViews()
      expect(sites.map(view => view.definition.kind).sort()).toEqual(['forest', 'grotto', 'mine'])
      for (const { definition } of sites) {
        const card = mounted.container.querySelector(`[data-building-id="${definition.siteId}"]`)!
        const quote = mounted.manager.buildingOps.quoteProductionUpgrade(definition.siteId, mounted.player)
        expect(card).not.toBeNull()
        expect(card.querySelector('.architecture-card__actions button')).not.toBeNull()
        expect(card.querySelectorAll('.architecture-card__cost-slot')).toHaveLength(quote.cost ? 2 : 0)
      }
    } finally { mounted.app.unmount() }
  })

  it('keeps an unaffordable site upgrade clickable and reports the owner quote without spending', async () => {
    const mounted = mountArchitecture()
    const quote = vi.spyOn(mounted.manager.buildingOps, 'quoteProductionUpgrade')
    const upgrade = vi.spyOn(mounted.manager.buildingOps, 'upgradeProductionSite')
    try {
      const site = mounted.manager.buildingOps.getProductionViews().find(view => view.definition.kind === 'forest')!
      const ownerQuote = mounted.manager.buildingOps.quoteProductionUpgrade(site.definition.siteId, mounted.player)
      expect(ownerQuote.upgradable).toBe(false)
      expect(ownerQuote.reasons.length).toBeGreaterThan(0)
      const before = mounted.manager.materialBag.getAll()
      const action = mounted.container.querySelector<HTMLButtonElement>(
        `[data-building-id="${site.definition.siteId}"] .architecture-card__actions button`,
      )!
      expect(action).not.toBeNull()
      expect(action.disabled).toBe(false)
      quote.mockClear()
      action.click()
      await nextTick()
      expect(quote).toHaveBeenCalledWith(site.definition.siteId, expect.anything())
      expect(upgrade).not.toHaveBeenCalled()
      expect(mounted.container.querySelector('[role="status"]')?.textContent)
        .toBe(i18n.global.t(`architecture.productionReasons.${ownerQuote.reasons[0]}`))
      expect(mounted.manager.materialBag.getAll()).toEqual(before)
      expect(mounted.manager.productionSystem.getState(site.definition.siteId)?.level).toBe(site.state.level)
    } finally { mounted.app.unmount() }
  })
})
