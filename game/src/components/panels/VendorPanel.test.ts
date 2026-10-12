// @vitest-environment jsdom
// Retired sales remain inaccessible even when the legacy panel is mounted.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import VendorPanel from './VendorPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { i18n } from '@/i18n'
import { SPIRIT_STONE_MATERIAL } from '@/core/material/SpiritStoneMaterial'
import type { Material } from '@/core/material/Material'
import type { AlchemyRecipe } from '@/core/alchemy/AlchemySystem'

const VENDOR_HERB: Material = {
  id: 'vendor_panel_test_herb_decade',

  name: 'Vendor Panel Test Herb',

  category: 'herb',

  sourceType: 'exploration',

  profession: {
    resourceKind: 'herb',

    realmId: 'mortal',

    age: 'decade',

    pillRecipeId: 'alchemy_vendor_panel_test_mortal',

    herbBaseId: 'vendor_panel_test_herb',
  },
}

const SOLE_HERB_RECIPE: AlchemyRecipe = {
  id: 'alchemy_vendor_panel_test_mortal',

  pillId: 'pill_vendor_panel_test',

  realmId: 'mortal',

  herbVariants: [
    { materialId: 'vendor_panel_test_herb_decade', age: 'decade', label: 'Thập Niên' },
  ],

  herbAmount: 1,

  fuelWoodRealmId: 'mortal',

  fuelWoodAmount: 1,

  spiritStoneCost: 10,

  baseDurationSeconds: 10,
}

function mountVendorPanel(recipes: AlchemyRecipe[] = []) {
  const container = document.createElement('div')
  const pinia = createPinia()
  const gameManager = new GameManager()
  const stateVersion = ref(0)
  const app = createApp({ render: () => h(VendorPanel) })

  document.body.appendChild(container)
  gameManager.catalogOps.registerMaterials([SPIRIT_STONE_MATERIAL, VENDOR_HERB])

  if (recipes.length > 0) {
    gameManager.catalogOps.registerAlchemyRecipes(recipes)
  }

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.mount(container)

  return {
    container,
    gameManager,
    // Panel chi doc stateVersion (bridge duy nhat) -- mutate bag xong phai
    // bump nhu production lam qua BUMP_STATE_KEY.
    bumpState: () => {
      stateVersion.value += 1
    },
    player: usePlayerStore(pinia),
    notifications: useNotificationStore(pinia),
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

function sellButtons(mounted: ReturnType<typeof mountVendorPanel>) {
  return Array.from(
    mounted.container.querySelectorAll<HTMLButtonElement>('.resource-card__row button'),
  )
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('VendorPanel retired sales boundary', () => {
  it('does not expose sales or consume a sole recipe ingredient', async () => {
    const mounted = mountVendorPanel([SOLE_HERB_RECIPE])
    mounted.player.realmId = 'qi_refining'
    mounted.gameManager.materialBag.add(VENDOR_HERB, 10)
    mounted.bumpState()
    await nextTick()

    expect(sellButtons(mounted)).toHaveLength(0)
    expect(mounted.gameManager.economyOps.previewVendorSale(VENDOR_HERB.id, 10, mounted.player.$state)).toBeNull()
    expect(mounted.gameManager.economyOps.sellMaterialToVendor(VENDOR_HERB.id, 10, mounted.player.$state).ok).toBe(false)
    expect(mounted.gameManager.materialBag.getAmount(VENDOR_HERB.id)).toBe(10)
    mounted.unmount()
  })

  it('keeps sales absent after state refresh and remount', async () => {
    const mounted = mountVendorPanel()
    mounted.player.realmId = 'qi_refining'
    mounted.gameManager.materialBag.add(VENDOR_HERB, 10)
    mounted.bumpState()
    await nextTick()
    expect(sellButtons(mounted)).toHaveLength(0)
    expect(mounted.notifications.toasts).toHaveLength(0)
    mounted.unmount()

    const reopened = mountVendorPanel()
    await nextTick()
    expect(sellButtons(reopened)).toHaveLength(0)
    reopened.unmount()
  })
})
