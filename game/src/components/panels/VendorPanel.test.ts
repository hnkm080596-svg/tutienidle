// @vitest-environment jsdom
// gp123 6G fix round 1 (2026-09-06) — gate toast CHỈ cho reason
// 'grade_not_below'; reason khác (sole_recipe_ingredient, bag_full...)
// phải nhận message generic thay vì message gate (sai sự thật: herb phẩm
// thấp hơn bị chặn vì là thảo DUY NHẤT của đan phương không phải do phẩm).
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
  gameManager.registerMaterials([SPIRIT_STONE_MATERIAL, VENDOR_HERB])

  if (recipes.length > 0) {
    gameManager.registerAlchemyRecipes(recipes)
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
    // Panel chỉ đọc stateVersion (bridge duy nhất) — mutate bag xong phải
    // bump như production làm qua BUMP_STATE_KEY.
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

describe('VendorPanel — toast lý do từ chối (gp123 6G fix round 1)', () => {
  it('reason sole_recipe_ingredient → message GENERIC, KHÔNG phải message gate', async () => {
    const mounted = mountVendorPanel([SOLE_HERB_RECIPE])

    mounted.player.realmId = 'qi_refining'
    mounted.gameManager.materialBag.add(VENDOR_HERB, 10)
    mounted.bumpState()
    await nextTick()

    // Row render được (phẩm thấp hơn) nhưng bán HẾT stack chạm sole-ingredient.
    expect(sellButtons(mounted).length).toBe(1)

    sellButtons(mounted)[0]!.click()
    await nextTick()

    const messages = mounted.notifications.toasts.map((toast) => toast.message)

    expect(messages).toContain('Không bán được vật phẩm này.')
    expect(messages).not.toContain('Chỉ thu mua vật phẩm có phẩm thấp hơn cảnh giới hiện tại')
    // Nguyên liệu không mất — sole guard chặn.
    expect(mounted.gameManager.materialBag.getAmount(VENDOR_HERB.id)).toBe(10)
    mounted.unmount()
  })

  it('reason grade_not_below → message gate hiển thị đúng', async () => {
    const mounted = mountVendorPanel()

    mounted.player.realmId = 'qi_refining'
    mounted.gameManager.materialBag.add(VENDOR_HERB, 10)
    mounted.bumpState()
    await nextTick()

    vi.spyOn(mounted.gameManager, 'sellMaterialToVendor').mockReturnValue({
      ok: false,
      reason: 'grade_not_below',
    })

    sellButtons(mounted)[0]!.click()
    await nextTick()

    expect(mounted.notifications.toasts.map((toast) => toast.message)).toContain(
      'Chỉ thu mua vật phẩm có phẩm thấp hơn cảnh giới hiện tại',
    )
    mounted.unmount()
  })
})
