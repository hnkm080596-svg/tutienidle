// @vitest-environment jsdom
// QA FIXPOINT probe (consumer leak, run qa-fixpoint-master) - UI seams
// that must read the SAME authority the scoped systems already read:
//
// CONSUMER-01 (Low): ProductionPanel's grotto card advertised
// PILL_FAMILIES.length (8 authored rows) as producible "chu duoc"
// while only 3 families are beta-admitted - the panel overstated what
// the Dong Thien can ever deliver. The count now derives from
// betaRecipeFamilyOfId, the same authority the alchemy catalog reads.
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
import { PILL_FAMILIES } from '@/data/pill/PillFamilies'
import { betaRecipeFamilyOfId } from '@/core/betaScope'
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

  return { container, app }
}

describe('CONSUMER-01: the grotto card advertises only beta-admitted pill families', () => {
  it('the rendered reward count equals the admitted roster, not the authored table', async () => {
    const { container, app } = mountPanel()
    await nextTick()

    const grottoIndex = THANH_VAN_PRODUCTION_SITES.findIndex((site) => site.kind === 'grotto')
    const cards = container.querySelectorAll('.site-card')
    expect(grottoIndex).toBeGreaterThanOrEqual(0)
    expect(cards.length).toBe(THANH_VAN_PRODUCTION_SITES.length)

    const reward = cards[grottoIndex]?.querySelector('.site-card__reward')
    const count = Number((reward?.textContent ?? '').match(/\d+/)?.[0])

    const admittedCount = PILL_FAMILIES.filter(
      (family) => betaRecipeFamilyOfId(family.id) !== null,
    ).length
    expect(admittedCount).toBeLessThan(PILL_FAMILIES.length)
    expect(count).toBe(admittedCount)

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
