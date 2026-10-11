// @vitest-environment jsdom
// QA-B blind adversarial review (queue-rework SEAMS) - tests only, no
// production edits. Mount-level evidence for cross-system defects the
// domain suite cannot see: the surface's slot gate vs the domain's
// merge contract, the duplicated order-progress string, and a parked
// dormant order leaking into the Thien Co board.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { i18n } from '@/i18n'
import AlchemySurface from './AlchemySurface.vue'
import AlchemyFidelityScene from './fidelity/AlchemyFidelityScene.vue'
import { GameManager } from '@/core/game/GameManager'
import type { AlchemyRecipe, ActiveAlchemyJob } from '@/core/alchemy/AlchemySystem'
import type { Material } from '@/core/material/Material'
import type { Pill } from '@/core/pill/Pill'
import type { Building } from '@/core/building/Building'
import { BUI_GO_ID, LUYEN_DAN_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useThienCoEntries, type ThienCoEntry } from '@/composables/useThienCoEntries'
import type { Ref } from 'vue'

// jsdom has neither getScreenCTM nor ResizeObserver (same gap the other
// suites patch): a null CTM makes the scene's measureFlow early-out, so
// the DOM these tests assert on still renders.
window.ResizeObserver =
  window.ResizeObserver ||
  (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver)
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getScreenCTM) {
  SVGElement.prototype.getScreenCTM = () => null
}

const TEST_RECIPE: AlchemyRecipe = {
  id: 'alchemy_tu_linh_dan_qi_refining',
  pillId: 'test_pill',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'test_herb', age: 'decade', label: 'Thảo Test' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
  luyenDanTinhHoaAmount: 1,
  spiritStoneCost: 0,
  baseDurationSeconds: 60,
}

const TEST_PILL: Pill = {
  id: 'test_pill',
  name: 'Đan Test',
  type: 'cultivation',
  grade: 'hoang',
  realmId: 'mortal',
  effects: [],
}

const HERB: Material = { id: 'test_herb', name: 'Thảo Test', category: 'herb', sourceType: 'gathering' }
const WOOD: Material = { id: 'test_wood', name: 'Gỗ Test', category: 'wood', sourceType: 'gathering' }
const BUI_GO: Material = { id: BUI_GO_ID, name: 'Bùi Gỗ', category: 'fuel', sourceType: 'gathering' }
const TINH_HOA: Material = { id: LUYEN_DAN_TINH_HOA_ID, name: 'Tinh Hoa', category: 'essence', sourceType: 'decompose' }

const PILL_ROOM: Building = {
  id: 'pill_room',
  name: 'Đan Phòng',
  description: '',
  function: 'crafting',
  maxLevel: 3,
  baseStorageCapacity: 0,
  upgradeCost: [[], [], []],
  functionType: 'pill_room',
}

function createManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials([HERB, WOOD, BUI_GO, TINH_HOA])
  gameManager.catalogOps.registerPills([TEST_PILL])
  gameManager.catalogOps.registerBuildings([PILL_ROOM])
  gameManager.catalogOps.registerAlchemyRecipes([TEST_RECIPE])
  return gameManager
}

function provides(app: ReturnType<typeof createApp>, gameManager: GameManager) {
  const stateVersion = ref(0)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  return stateVersion
}

function stockAndRoom(gameManager: GameManager) {
  gameManager.buildingManager.add({
    instanceId: 'inst_room',
    buildingId: 'pill_room',
    level: 1,
    lastCollectedAt: 0,
  })
  gameManager.materialBag.add(HERB, 50)
  gameManager.materialBag.add(WOOD, 50)
  gameManager.materialBag.add(BUI_GO, 50)
  gameManager.materialBag.add(TINH_HOA, 50)
}

describe('QA-B seam — canBrew slot gate vs domain merge contract', () => {
  it('a same-order +1 click stays enabled at full slots because the domain merges it (no new slot)', async () => {
    const gameManager = createManager()
    stockAndRoom(gameManager)

    const pinia = createPinia()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({ render: () => h(AlchemySurface) })
    app.use(pinia)
    app.use(i18n)
    const stateVersion = provides(app, gameManager)
    app.mount(container)
    await nextTick()

    const player = usePlayerStore(pinia)

    // Order 1 occupies the only slot (pill_room L1 -> 1 concurrent job).
    const started = gameManager.alchemyOps.startAlchemyJob(TEST_RECIPE.id, 'test_herb', player.$state)
    expect(started.ok).toBe(true)
    expect(gameManager.alchemyOps.getAlchemyJobs()).toHaveLength(1)

    stateVersion.value += 1
    await nextTick()

    const button = container.querySelector<HTMLButtonElement>('.alchemy-brew button')!

    // Domain contract (proven in AlchemyQueueSeams.qa.test.ts):
    // enqueueJob merges this click into the tail order - it needs NO
    // free slot. The surface instead shows 'job_slots_full' and disables
    // the button, so on a 1-slot room the merge click the rework is
    // built around is unreachable.
    expect(button.disabled).toBe(false)

    app.unmount()
    container.remove()
  })
})

describe('QA-B seam — job subline duplicates the order counter', () => {
  it('renders the u/q counter once, not twice', async () => {
    const gameManager = createManager()
    stockAndRoom(gameManager)

    const pinia = createPinia()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({
      render: () =>
        h(AlchemyFidelityScene, {
          recipes: [],
          recipe: null,
          variant: null,
          jobs: [
            {
              id: 'job_1',
              recipeId: TEST_RECIPE.id,
              name: 'Đan Test',
              icon: '',
              progress: 10,
              // Adapter emits ETA-only remaining for multi-unit orders
              // (the unitsDone/quantity counter lives in unitsProgress).
              remaining: '5p',
              unitsDone: 1,
              quantity: 3,
            },
          ],
          capacity: 4,
        }),
    })
    app.use(pinia)
    app.use(i18n)
    provides(app, gameManager)
    app.mount(container)
    await nextTick()

    const subline = container.querySelector<HTMLElement>('.job-card__info small')
    const text = subline?.textContent ?? ''

    // Subline must show the units counter exactly once (unitsProgress
    // prefix only) - adapter remaining is ETA-only.
    expect((text.match(/1\/3/g) ?? []).length).toBe(1)

    app.unmount()
    container.remove()
  })
})

describe('QA-B seam — parked dormant order leaks into Thien Co board', () => {
  it('an invisible, un-cancellable dormant order must not produce an active board entry', async () => {
    const gameManager = createManager()
    stockAndRoom(gameManager)

    // Scope-hidden family (to_cot_dan authored but NOT in
    // BETA_ENABLED_RECIPE_FAMILY_IDS): restored verbatim, parked
    // forever at the tick seam, filtered out of the surface's job
    // list - yet getAlchemyJobs() still returns it.
    const parked: ActiveAlchemyJob = {
      jobId: 'job_dormant',
      recipeId: 'alchemy_to_cot_dan_qi_refining',
      pillId: 'to_cot_dan_qi_refining',
      herbMaterialId: 'test_herb',
      startedAtMs: 0,
      completesAtMs: 60_000,
      roomLevelAtStart: 1,
      reservation: {
        woodId: BUI_GO_ID,
        fuelWoodAmount: 1,
        spiritStoneCost: 0,
        herbAmount: 1,
        luyenDanTinhHoaAmount: 1,
        specialIngredients: [],
        costScale: 1,
        digest: 0,
      },
    }
    gameManager.alchemySystem.restoreJobs([parked], 0)
    gameManager.alchemySystem.setRecipeLookup(() => undefined)
    gameManager.alchemySystem.tick(120_000, new (await import('@/core/pill/PillBag')).PillBag(), () => ({ id: 'x' }), () => 0)

    let result: { entries: Ref<ThienCoEntry[]> } | undefined
    const pinia = createPinia()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp({
      setup: () => {
        result = useThienCoEntries()
        return () => h('div')
      },
    })
    app.use(pinia)
    app.use(i18n)
    provides(app, gameManager)
    app.mount(container)
    await nextTick()

    const entry = result!.entries.value.find((item) => item.id === 'active:pill_room')

    // The surface filters this job out (no cancel path, no card); the
    // board nevertheless announces an "active" brew with done/total
    // progress and an ETA that can never settle.
    expect(entry, 'parked dormant order leaked into the board').toBeUndefined()

    app.unmount()
    container.remove()
  })
})
