// @vitest-environment jsdom
// T4-32 - startAlchemyJob failures went to console.warn (invisible to the
// player) and the brew button never disabled. These tests pin: every
// reason code the domain can return has an alchemy.reason.* key; a failed
// start pushes a localized notification; the button disables while the
// selected variant is unaffordable.
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import alchemySystemSource from '@/core/alchemy/AlchemySystem?raw'
import alchemyOpsSource from '@/core/game/GameManagerAlchemyOps?raw'
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

const TEST_RECIPE: AlchemyRecipe = {
  id: 'alchemy_tu_linh_dan_qi_refining',
  pillId: 'test_pill',
  realmId: 'mortal',
  herbVariants: [{ materialId: 'test_herb', age: 'decade', label: 'Thảo Test' }],
  herbAmount: 1,
  fuelWoodRealmId: 'mortal',
  fuelWoodAmount: 1,
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

const HERB: Material = {
  id: 'test_herb',
  name: 'Thảo Test',
  category: 'herb',
  sourceType: 'exploration',
}

const WOOD: Material = {
  id: 'mortal_wood_decade',
  name: 'Mộc Test',
  category: 'wood',
  sourceType: 'exploration',
}

const PILL_ROOM: Building = {
  id: 'pill_room',
  name: 'Đan Phòng',
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
      container.querySelector<HTMLButtonElement>('.brew-button'),
    blockReasonText: () =>
      container.querySelector<HTMLElement>('.block-reason')?.textContent ?? null,
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

function createManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials([HERB, WOOD])
  gameManager.catalogOps.registerPills([TEST_PILL])
  gameManager.catalogOps.registerBuildings([PILL_ROOM])
  gameManager.catalogOps.registerAlchemyRecipes([TEST_RECIPE])
  return gameManager
}


describe('alchemy.reason.* key completeness (T4-32)', () => {
  it('every reason literal returned by startJob/startAlchemyJob has a locale key in both locales', () => {
    const reasons = new Set<string>()

    for (const source of [alchemySystemSource, alchemyOpsSource]) {
      for (const match of source.matchAll(/reason: '([a-z_]+)'/g)) {
        reasons.add(match[1]!)
      }
    }

    expect(reasons.size).toBeGreaterThan(0)

    const global = i18n.global as unknown as {
      te: (key: string, locale: string) => boolean
    }

    for (const reason of reasons) {
      expect(global.te(`alchemy.reason.${reason}`, 'vi'), `missing vi key for ${reason}`).toBe(true)
      expect(global.te(`alchemy.reason.${reason}`, 'en'), `missing en key for ${reason}`).toBe(true)
    }

    // Forward-compat fallback must exist for reasons added later.
    expect(global.te('alchemy.reason.fallback', 'vi')).toBe(true)
    expect(global.te('alchemy.reason.fallback', 'en')).toBe(true)
  })
})

describe('AlchemySurface - failure surface + disabled brew (T4-32)', () => {
  it('missing pill room disables brew and surfaces the localized room_not_built reason', async () => {
    const gameManager = createManager()
    // All materials present; no pill_room built - the surface must block
    // brew the same way the domain does (fail closed) AND name why.
    gameManager.materialBag.add(HERB, 5)
    gameManager.materialBag.add(WOOD, 5)

    const mounted = mountAlchemy(gameManager)
    await nextTick()

    const button = mounted.brewButton()!
    expect(button.disabled).toBe(true)

    expect(mounted.blockReasonText()).toContain('Cần xây Đan Phòng trước')

    mounted.unmount()
  })

  it('brew button disables while the selected herb variant is unaffordable', async () => {
    const gameManager = createManager()
    gameManager.buildingManager.add({
      instanceId: 'inst_room',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
    })
    // Herb missing -> the variant row is not 'enough'.
    gameManager.materialBag.add(WOOD, 5)

    const mounted = mountAlchemy(gameManager)
    await nextTick()

    expect(mounted.brewButton()!.disabled).toBe(true)

    gameManager.materialBag.add(HERB, 5)
    await mounted.bump()

    expect(mounted.brewButton()!.disabled).toBe(false)

    mounted.unmount()
  })
})
