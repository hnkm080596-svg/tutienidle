// @vitest-environment jsdom
//
// MaterialBag filter/search/group (economy-fixes-sinks-plan.md §3.2 B4):
// - Ô tìm kiếm theo tên (case-insensitive).
// - Filter chip theo nhóm (gỗ/quặng/thảo/tinh hoa/khác).
// - Gộp thảo theo HỌ (herbBaseId) với badge realm/niên đại thay vì
//   liệt kê phẳng 288 biến thể niên đại.
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createApp, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import { GameManager } from '@/core/game/GameManager'
import {
  BUMP_STATE_KEY,
  GAME_MANAGER_KEY,
  STATE_VERSION_KEY,
} from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import type { Material } from '@/core/material/Material'
import { vTooltip } from '@/directives/tooltip'

const WOOD: Material = {
  id: 'mortal_wood',
  name: 'Cửu Phẩm Linh Mộc',
  category: 'wood',
  sourceType: 'exploration',
}

const ORE: Material = {
  id: 'mortal_ore_hoang',
  name: 'Cửu Phẩm Linh Khoáng',
  category: 'ore',
  sourceType: 'exploration',
}

const ESSENCE: Material = {
  id: 'tinh_hoa_pham_khi',
  name: 'Phàm Khí Tinh Hoa',
  category: 'essence',
  sourceType: 'building',
}

const OTHER: Material = {
  id: 'doan_bao_thach',
  name: 'Đoán Bảo Thạch',
  category: 'other',
  sourceType: 'monster',
}

// Cùng 1 HỌ thảo (herbBaseId 'tu_linh_thao_mortal') × 2 niên đại —
// gộp family phải collapse còn 1 ô duy nhất.
function herb(id: string, age: string, years: number): Material {
  return {
    id,
    name: 'Tứ Linh Thảo',
    category: 'herb',
    years,
    sourceType: 'exploration',
    profession: {
      resourceKind: 'herb',
      realmId: 'mortal',
      age,
      pillRecipeId: 'alchemy_tu_linh_dan_mortal',
      herbBaseId: 'tu_linh_thao_mortal',
    },
  }
}

const HERB_DECADE = herb('tu_linh_thao_mortal_decade', 'decade', 10)
const HERB_CENTURY = herb('tu_linh_thao_mortal_century', 'century', 100)

// Họ khác (realm khác) — gộp family KHÔNG nhầm với họ trên.
const HERB_OTHER_FAMILY = {
  ...herb('hoi_xuan_thao_mortal_decade', 'decade', 10),
  name: 'Hồi Xuân Thảo',
  profession: {
    resourceKind: 'herb' as const,
    realmId: 'mortal',
    age: 'decade',
    pillRecipeId: 'alchemy_hoi_xuan_dan_mortal',
    herbBaseId: 'hoi_xuan_thao_mortal',
  },
}

// Thảo legacy KHÔNG profession meta (không có herbBaseId) — phải rơi
// về 1 ô riêng, không bị gộp/chủ ý nuốt mất.
const HERB_LEGACY: Material = {
  id: 'thao_legacy',
  name: 'Linh Thảo Lạ',
  category: 'herb',
  sourceType: 'exploration',
}

function mountSection(gameManager: GameManager) {
  const container = document.createElement('div')
  const stateVersion = ref(0)

  document.body.appendChild(container)

  const RootStub = defineComponent({
    setup() {
      return () => h('div', [h(MaterialBagSection)])
    },
  })

  const app = createApp({ render: () => h(RootStub) })

  app.use(createPinia())

  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => { stateVersion.value += 1 })
  app.directive('tooltip', vTooltip)

  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as never)

  app.mount(container)

  return {
    ui: useUiStore(),

    container,

    // Grid luôn đủ pageSize ô (ô đệm rỗng) — chỉ đếm ô có nội dung.
    slotLabels: () =>
      Array.from(container.querySelectorAll('.bag-section__grid .bag-section__slot'))
        .map((el) => el.textContent ?? '')
        .filter((label) => label !== ''),

    setSearch: (value: string) => {
      const input = container.querySelector<HTMLInputElement>('.bag-section__search')

      if (!input) throw new Error('search input not found')

      input.value = value
      input.dispatchEvent(new Event('input'))
    },

    clickChip: (label: string) => {
      const chips = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.bag-section__chips .chip'),
      )

      const chip = chips.find((el) => (el.textContent ?? '').includes(label))

      if (!chip) throw new Error(`chip "${label}" not found`)

      chip.click()
    },

    visibleCountText: () =>
      container.querySelector('.bag-section__count')?.textContent ?? '',

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('MaterialBag — filter/search/group họ thảo (plan §3.2 B4)', () => {
  let gameManager: GameManager

  let mounted: ReturnType<typeof mountSection>

  beforeEach(() => {
    gameManager = new GameManager()
  })

  function seedAll() {
    gameManager.registerMaterials([WOOD, ORE, ESSENCE, OTHER, HERB_DECADE, HERB_CENTURY])
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_wood'), 3)
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_ore_hoang'), 2)
    gameManager.materialBag.add(gameManager.materialRegistry.get('tinh_hoa_pham_khi'), 5)
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 1)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_DECADE.id), 4)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_CENTURY.id), 7)
  }

  it('search theo tên (không dấu hoa thường) lọc đúng danh sách', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    mounted.setSearch('linh kho')

    await nextTick()

    const labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Cửu Phẩm Linh Khoáng')

    mounted.unmount()
  })

  it('chip nhóm lọc đúng nhóm; bỏ chọn chip quay về tất cả', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    mounted.clickChip('Thảo')
    await nextTick()

    // 2 biến thể cùng họ thảo → gộp còn 1 ô.
    let labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Tứ Linh Thảo')

    // Chip khác — nhóm khác gồm Đoán Bảo Thạch (other).
    mounted.clickChip('Khác')
    await nextTick()

    labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Đoán Bảo Thạch')

    // Bấm lại chip đang chọn → bỏ filter, hiện tất cả (5 ô: 4 nhóm
    // + 1 họ thảo đã gộp).
    mounted.clickChip('Khác')
    await nextTick()

    expect(mounted.slotLabels()).toHaveLength(5)

    mounted.unmount()
  })

  it('gộp thảo theo họ: 1 ô duy nhất với badge realm + niên đại, tooltip vẫn đủ dữ liệu', async () => {
    gameManager.registerMaterials([HERB_DECADE, HERB_CENTURY, HERB_OTHER_FAMILY, HERB_LEGACY])
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_DECADE.id), 4)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_CENTURY.id), 7)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_OTHER_FAMILY.id), 2)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_LEGACY.id), 1)

    mounted = mountSection(gameManager)

    const labels = mounted.slotLabels()

    // 2 họ thảo + 1 thảo legacy = 3 ô (thay vì 4 biến thể phẳng).
    expect(labels).toHaveLength(3)
    expect(labels[0]).toContain('Tứ Linh Thảo')
    expect(labels[1]).toContain('Hồi Xuân Thảo')
    expect(labels[2]).toContain('Linh Thảo Lạ')

    // Badge realm/niên đại rộng nhất trong họ (Bách Niên > Thập Niên).
    expect(labels[0]).toContain('Phàm Nhân')
    expect(labels[0]).toContain('Bách Niên')

    mounted.unmount()
  })

  it('count hiển thị số ô hiện tại (đã gộp/đã lọc)', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    // 6 material − 1 biến thể gộp = 5 ô hiển thị.
    expect(mounted.visibleCountText()).toContain('5')

    mounted.clickChip('Gỗ')
    await nextTick()

    expect(mounted.visibleCountText()).toContain('1')

    mounted.unmount()
  })
})
