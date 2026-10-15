// @vitest-environment jsdom
// QA FIXPOINT probe (consumer leak, run qa-fixpoint-master) - UI seams
// that must read the SAME authority the scoped systems already read:
//
// CONSUMER-01: production cards must advertise their actual owner-derived
// output rates. The current card shows throughput instead of family counts.
//
// CONSUMER-02 (Low): the command wheel's character-slot dot fired on
// raw cultivationProgress >= 1, a false positive at the TC ceiling
// (full bar, chapter stage uncleared -> breakthrough still blocked).
// The badge now asks the canonical gate
// gameManager.realmAdvanceOps.canTriggerBreakthrough, the same
// predicate RealmPanel's trigger button uses.
import { afterEach, describe, expect, it } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import ProductionPanel from '@/components/panels/ProductionPanel.vue'
import DongFuStage from '@/components/scenes/dong-fu/DongFuStage.vue'
import { GameManager } from '@/core/game/GameManager'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { VUE_ROUTE_ADAPTER_KEY, type Route } from '@/presentation/PresentationContracts'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { i18n } from '@/i18n'
import { vTooltip } from '@/directives/tooltip'
import { buildings } from '@/data/building/buildings'
import { THANH_VAN_PRODUCTION_SITES } from '@/core/production/ProductionCatalog'
import {
  CORE_REALM_LEVEL,
  QI_REFINING_BREAKTHROUGH_STAGE_ID,
  getRequiredCultivation,
} from '@/core/realm/realmSystem'

afterEach(() => {
  document.body.innerHTML = ''
})

function mountPanel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)
  gameManager.catalogOps.registerBuildings(buildings)
  // The panel content sits behind the gathering_outpost construction
  // gate - grant the outpost instance the bootstrap would have given.
  gameManager.buildingManager.add({
    instanceId: 'probe-outpost',
    buildingId: 'gathering_outpost',
    level: 1,
    lastCollectedAt: 0,
  })

  // Rates belong to an active cycle; start each independent production site.
  for (const site of THANH_VAN_PRODUCTION_SITES) {
    gameManager.buildingOps.setProductionAutoRestart(site.siteId, true)
  }
  gameManager.productionSystem.tick(gameManager.time.now(), gameManager.materialBag, gameManager.materialRegistry, 'mortal')

  const app = createApp({ render: () => h(ProductionPanel) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.mount(container)

  return { container, app, gameManager }
}

describe('CONSUMER-01: production cards advertise the canonical output rate', () => {
  it('each rendered rate agrees with its production view despite the display ordering', async () => {
    const { container, app, gameManager } = mountPanel()
    await nextTick()
    const cards = container.querySelectorAll('.site-card')
    expect(cards.length).toBe(THANH_VAN_PRODUCTION_SITES.length)
    const views = gameManager.buildingOps.getProductionViews(gameManager.time.now())
    for (const view of views) {
      const kind = view.definition.kind
      const card = container.querySelector(`.site-card[data-kind="${kind}"]`)
      expect(card, `missing ${kind} production card`).not.toBeNull()
      const range = view.baseOutputPerSecond
      expect(range, `missing ${kind} production rate`).toBeDefined()
      expect(range!.min).toBeGreaterThan(0)
      expect(range!.max).toBeGreaterThanOrEqual(range!.min)
      const formatRate = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
      const amount = range!.min === range!.max ? formatRate(range!.min) : `${formatRate(range!.min)}–${formatRate(range!.max)}`
      const expected = i18n.global.t('panels.production.resourceRate', {
        amount, resource: i18n.global.t(`panels.production.resources.${kind}`),
      })
      expect(card!.querySelector('.source-reward')?.textContent).toBe(expected)
    }
    app.unmount()
  })
})

function mountWheel() {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    render: () => h('div', [h(DongFuStage)]),
  })

  const app = createApp({ render: () => h(RootStub) })
  app.use(pinia)
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.provide(VUE_ROUTE_ADAPTER_KEY, {
    activeRoute: computed(() => 'home' as Route),
  } as unknown as VueRouteAdapter)

  return { container, app, pinia, gameManager }
}

describe('CONSUMER-02: the character-slot dot asks the canonical breakthrough gate', () => {
  const badgeSelector = '[data-wheel-slot="character"] .df-node__badge'

  it('no dot at the TC ceiling when the chapter stage is uncleared, even with a full bar', async () => {
    const { container, app, pinia } = mountWheel()
    const player = usePlayerStore(pinia)

    player.realmId = 'qi_refining'
    player.realmLevel = CORE_REALM_LEVEL
    player.cultivation = getRequiredCultivation('qi_refining', CORE_REALM_LEVEL)
    player.completedStageIds = []

    app.mount(container)
    useUiStore(pinia).isCommandWheelOpen = true
    await nextTick()

    // cultivationProgress is exactly 1 - the old raw threshold fired
    // here, but the canonical gate still blocks on chapterClear.
    expect(container.querySelector(badgeSelector)).toBeNull()

    app.unmount()
  })

  it('the dot appears once every gate requirement is met', async () => {
    const { container, app, pinia } = mountWheel()
    const player = usePlayerStore(pinia)

    player.realmId = 'qi_refining'
    player.realmLevel = CORE_REALM_LEVEL
    player.completedStageIds = [QI_REFINING_BREAKTHROUGH_STAGE_ID]

    app.mount(container)
    useUiStore(pinia).isCommandWheelOpen = true
    await nextTick()

    expect(container.querySelector(badgeSelector)).not.toBeNull()

    app.unmount()
  })
})
