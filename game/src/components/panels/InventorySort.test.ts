// @vitest-environment jsdom
//
// Inventory sort integration (plan "Test plan — Inventory sort"):
// - Sort chạy TRƯỚC pagination; đổi mode/direction reset về trang 0.
// - Mỗi tab nhớ state sort RIÊNG.
// - Linh Thạch (spirit_stone) sort đúng trong tab Nguyên Liệu như
//   material bình thường (plan Workstream F).
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import EquipmentBagSection from './bag-sections/EquipmentBagSection.vue'
import BagGrid from './BagGrid.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import type { Material } from '@/core/material/Material'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'

const HERB_A: Material = { id: 'herb_a', name: 'Bạch Thuật', category: 'herb', sourceType: 'exploration', years: 100 }
const HERB_B: Material = { id: 'herb_b', name: 'Ám Hương', category: 'herb', sourceType: 'monster', years: 500 }
const ORE: Material = { id: 'ore_a', name: 'Huyền Thiết', category: 'ore', sourceType: 'building' }

function mountSections(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    setup() {
      return () =>
        h('div', [
          h(MaterialBagSection),
          h(EquipmentBagSection),
          h(BagGrid),
        ])
    },
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())
  app.use(i18n)

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value += 1 })
  app.directive('tooltip', vTooltip)

  // ResizeObserver dùng bởi useBagGridLayout — stub cho jsdom.
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)

  app.mount(container)

  return {
    ui: useUiStore(),

    container,

    materialSlotLabels: () =>
      Array.from(container.querySelectorAll('.bag-section:first-child .bag-section__slot')).map(
        (el) => el.textContent ?? '',
      ),

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('Inventory — sort per-tab + Linh Thạch material (plan Workstream E/F)', () => {
  let gameManager: GameManager

  let mounted: ReturnType<typeof mountSections>

  function seedMaterials() {
    gameManager.registerMaterials([SPIRIT_STONE, HERB_A, HERB_B, ORE])

    gameManager.materialBag.add(gameManager.materialRegistry.get('herb_a'), 3)
    gameManager.materialBag.add(gameManager.materialRegistry.get('herb_b'), 1)
    gameManager.materialBag.add(gameManager.materialRegistry.get('ore_a'), 7)
    gameManager.materialBag.add(gameManager.materialRegistry.get(SPIRIT_STONE.id), 42)
  }

  let SPIRIT_STONE: Material

  beforeEach(() => {
    gameManager = new GameManager()

    SPIRIT_STONE = { id: 'spirit_stone', name: 'Linh Thạch', category: 'spirit_stone', sourceType: 'building' }
  })

  it('sort Tên asc/desc đúng thứ tự và Linh Thạch luôn ghim ô đầu (plan Workstream D)', async () => {
    seedMaterials()

    mounted = mountSections(gameManager)

    const ui = mounted.ui

    ui.setBagSortMode('material', 'name')

    await nextTick()

    // Linh Thạch luôn ghim ô đầu bất kể mode/direction; phần còn lại
    // sort Tên A→Z: Ám Hương, Bạch Thuật, Huyền Thiết.
    expect(mounted.materialSlotLabels()[0]).toContain('Linh Thạch')
    expect(mounted.materialSlotLabels()[1]).toContain('Ám Hương')
    expect(mounted.materialSlotLabels()[2]).toContain('Bạch Thuật')
    expect(mounted.materialSlotLabels()[3]).toContain('Huyền Thiết')

    // Đảo chiều desc → Linh Thạch vẫn ở ô đầu (ghim không đi qua withDirection).
    ui.toggleBagSortDirection('material')

    await nextTick()

    expect(mounted.materialSlotLabels()[0]).toContain('Linh Thạch')
    expect(mounted.materialSlotLabels()[1]).toContain('Huyền Thiết')
    expect(mounted.materialSlotLabels()[2]).toContain('Bạch Thuật')
    expect(mounted.materialSlotLabels()[3]).toContain('Ám Hương')

    mounted.unmount()
  })

  it('mỗi tab nhớ state sort RIÊNG (equipment/material độc lập)', async () => {
    seedMaterials()

    mounted = mountSections(gameManager)

    const ui = mounted.ui

    ui.setBagSortMode('material', 'amount')

    await nextTick()

    expect(ui.bagSorts.material.mode).toBe('amount')
    expect(ui.bagSorts.equipment.mode).toBe('default')

    // Đổi mode tự reset direction về asc.
    ui.toggleBagSortDirection('material')
    ui.setBagSortMode('material', 'name')

    expect(ui.bagSorts.material.direction).toBe('asc')

    mounted.unmount()
  })

  it('resetBagSort trả về default order', async () => {
    seedMaterials()

    mounted = mountSections(gameManager)

    const ui = mounted.ui

    ui.setBagSortMode('material', 'name')
    ui.toggleBagSortDirection('material')

    await nextTick()

    ui.resetBagSort('material')

    expect(ui.bagSorts.material.mode).toBe('default')
    expect(ui.bagSorts.material.direction).toBe('asc')

    mounted.unmount()
  })
})
