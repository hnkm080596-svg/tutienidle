// @vitest-environment jsdom
// QA-A blind adversarial review (devin/khai-mach @ 77d311dc) - the
// surface-side attack tests for the alchemy queue rework.
import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { i18n } from '@/i18n'
import AlchemySurface from './AlchemySurface.vue'
import { GameManager } from '@/core/game/GameManager'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'
import type { Material } from '@/core/material/Material'
import type { Pill } from '@/core/pill/Pill'
import type { Building } from '@/core/building/Building'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { useThienCoEntries } from '@/composables/useThienCoEntries'

// jsdom gaps: no layout APIs. getScreenCTM -> null makes measureFlow
// early-return; ResizeObserver just needs to exist.
const g = globalThis as Record<string, unknown>
g.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
SVGElement.prototype.getScreenCTM = () => null

const TEST_RECIPE: AlchemyRecipe = {
  id: 'alchemy_tu_linh_dan_qi_refining',
  pillId: 'test_pill',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'test_herb', age: 'decade', label: 'Thao Test' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

const TEST_PILL: Pill = {
  id: 'test_pill',
  name: 'Dan Test',
  type: 'cultivation',
  grade: 'hoang',
  realmId: 'mortal',
  effects: [],
}

const HERB: Material = {
  id: 'test_herb',
  name: 'Thao Test',
  category: 'herb',
  sourceType: 'exploration',
}

const BUI_GO: Material = {
  id: 'bui_go',
  name: 'Bui Go',
  category: 'essence',
  sourceType: 'building',
}

const TINH_HOA: Material = {
  id: 'luyen_dan_tinh_hoa',
  name: 'Luyen Dan Tinh Hoa',
  category: 'essence',
  sourceType: 'building',
}

const PILL_ROOM: Building = {
  id: 'pill_room',
  name: 'Dan Phong',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 3,
  baseStorageCapacity: 0,
  upgradeCost: [[], [], []],
  functionType: 'pill_room',
}

function mountAlchemy(gameManager: GameManager) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const stateVersion = ref(0)
  const pinia = createPinia()
  const app = createApp({ render: () => h(AlchemySurface) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.mount(container)

  return {
    pinia: pinia as Pinia,
    brewButton: () =>
      container.querySelector<HTMLButtonElement>('.alchemy-brew button'),
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

function createManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials([HERB, BUI_GO, TINH_HOA])
  gameManager.catalogOps.registerPills([TEST_PILL])
  gameManager.catalogOps.registerBuildings([PILL_ROOM])
  gameManager.catalogOps.registerAlchemyRecipes([TEST_RECIPE])
  return gameManager
}

describe('QA-A review - merge click must not be slot-gated at the surface', () => {
  it('pill_room level 1 (1 slot) + mergeable tail order: brew button stays enabled for the merge click', async () => {
    const gameManager = createManager()
    gameManager.buildingManager.add({
      instanceId: 'inst_room',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })
    // Enough inputs for the tail order AND the next merge click.
    gameManager.materialBag.add(HERB, 5)
    gameManager.materialBag.add(BUI_GO, 50)
    gameManager.materialBag.add(TINH_HOA, 50)

    // The live order occupies the single slot; the tail is the same
    // recipe + variant, so the next click is a merge - the domain
    // contract (AlchemySystem.test 'queue day van merge duoc vao order
    // cuoi') says merging consumes NO slot.
    const started = gameManager.alchemySystem.enqueueJob(
      TEST_RECIPE,
      'test_herb',
      gameManager.materialBag,
      gameManager.materialRegistry,
      0,
      1,
      Date.now(),
      1,
      1,
    )
    expect(started.ok).toBe(true)

    const mounted = mountAlchemy(gameManager)
    await nextTick()

    // The domain would merge this click (merged: true); the button must
    // be enabled. canBrew's order-count slot gate disables it instead,
    // so at room level 1-2 a player can never grow an order past 1
    // unit - the whole merge mechanic is unreachable until level 3.
    expect(mounted.brewButton()!.disabled).toBe(false)

    mounted.unmount()
  })

  it('Thien Co board does not claim "dang luyen" for a parked dormant-family job', async () => {
    const gameManager = createManager()
    gameManager.buildingManager.add({
      instanceId: 'inst_room',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })

    // Old-save carry-over: an in-flight job whose family is now
    // scope-hidden. The domain parks it at the tick seam (record intact,
    // never settles, never renders on the surface).
    gameManager.alchemySystem.restoreJobs(
      [
        {
          jobId: 'dormant_1',
          recipeId: 'alchemy_phi_van_dan_mortal',
          pillId: 'phi_van_dan_mortal',
          herbMaterialId: 'test_herb',
          startedAtMs: 0,
          completesAtMs: 60_000,
          roomLevelAtStart: 1,
          reservation: {
            woodId: 'bui_go',
            fuelWoodAmount: 1,
            spiritStoneCost: 0,
            herbAmount: 1,
            luyenDanTinhHoaAmount: 1,
            specialIngredients: [],
            costScale: 1,
            digest: 0,
          },
        },
      ],
      1_000,
    )

    const container = document.createElement('div')
    document.body.appendChild(container)
    const stateVersion = ref(0)
    const pinia = createPinia()

    let ids: string[] = []
    const Probe = defineComponent({
      setup() {
        const { entries } = useThienCoEntries()
        return () => {
          ids = entries.value.map((entry) => entry.id)
          return h('div')
        }
      },
    })

    const app = createApp({ render: () => h(Probe) })
    app.use(pinia)
    app.use(i18n)
    app.provide(GAME_MANAGER_KEY, gameManager)
    app.provide(STATE_VERSION_KEY, stateVersion)
    app.provide(BUMP_STATE_KEY, () => {
      stateVersion.value += 1
    })
    app.mount(container)
    await nextTick()

    // The board reads getAlchemyJobs() unfiltered: the parked ghost
    // produces an "active:pill_room" entry ('... con 1 phut' forever)
    // for a job that can never settle or render. The surface filters
    // the same feed by betaRecipeFamilyOfId - the board must too.
    expect(ids).not.toContain('active:pill_room')

    app.unmount()
    container.remove()
  })
})
