// @vitest-environment jsdom
//
// MaterialBag filter/group (economy-fixes-sinks-plan.md sec3.2 B4;
// search field removed 2026-10-11 per owner ruling):
// - O tim kiem theo ten (case-insensitive).
// - Filter chip theo nhom (go/quang/thao/tinh hoa/khac).
// - Moi bien the nien dai 1 o rieng - KHONG gop theo ho (owner ruling:
//   o gop lam nguoi choi tuong moi item deu bac cao nhat).
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
import type { HerbAge } from '@/core/production/ProductionTypes'
import { vTooltip } from '@/directives/tooltip'
import { useTooltip } from '@/composables/useTooltip'
import { i18n } from '@/i18n'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'

const WOOD: Material = {
  id: 'mortal_wood_decade',
  name: 'Thập Niên Linh Mộc',
  category: 'wood',
  sourceType: 'exploration',
}

const ORE: Material = {
  id: 'mortal_ore_decade',
  name: 'Thập Niên Linh Khoáng',
  category: 'ore',
  sourceType: 'exploration',
}

// Quang that (co profession meta) x 2 tuoi cung realm - moi tuoi render
// 1 o rieng, nhan day du theo ten material.
function ore(age: HerbAge): Material {
  return {
    id: `mortal_ore_${age}`,
    name: `${AGE_NAME[age]} Linh Khoáng`,
    category: 'ore',
    sourceType: 'exploration',
    profession: {
      resourceKind: 'ore',
      realmId: 'mortal',
      age,
    },
  }
}

const AGE_NAME: Record<HerbAge, string> = {
  decade: 'Thập Niên',
  century: 'Bách Niên',
  millennium: 'Thiên Niên',
  myriad_year: 'Vạn Niên',
  thuong_co: 'Thượng Cổ',
}

const ORE_HOANG = ore('decade')
const ORE_HUYEN = ore('century')

const ESSENCE: Material = {
  id: LUYEN_KHI_TINH_HOA_ID,
  name: 'Luyện Khí Tinh Hoa',
  category: 'essence',
  sourceType: 'building',
}

const OTHER: Material = {
  id: 'doan_bao_thach',
  name: 'Đoán Bảo Thạch',
  category: 'other',
  sourceType: 'monster',
}

// Cung 1 HO thao (herbBaseId 'tu_linh_thao_mortal') x 2 nien dai -
// van tach thanh 2 o rieng theo tung bien the.
function herb(id: string, age: HerbAge, years: number): Material {
  return {
    id,
    name: `${AGE_NAME[age]} Tứ Linh Thảo`,
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

// Ho khac (recipe khac) - cell rieng doc lap voi ho Tu Linh Thao.
// herbBaseId phai khop id conventions (validator: id = `${herbBaseId}_${age}`).
const HERB_OTHER_FAMILY: Material = {
  id: 'hoi_xuan_thao_mortal_decade',
  name: 'Thập Niên Hồi Xuân Thảo',
  category: 'herb',
  years: 10,
  sourceType: 'exploration',
  profession: {
    resourceKind: 'herb',
    realmId: 'mortal',
    age: 'decade',
    pillRecipeId: 'alchemy_hoi_xuan_dan_mortal',
    herbBaseId: 'hoi_xuan_thao_mortal',
  },
}

// Thao legacy KHONG profession meta (khong co herbBaseId) - van render
// 1 o rieng nhu moi material khac.
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
  app.use(i18n)

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

    // Grid luon du pageSize o (o dem rong) - chi dem o co noi dung.
    // Nametag caption removed 2026-09-15 - name lives on aria-label;
    // badges/amount still render as text.
    slotLabels: () =>
      Array.from(container.querySelectorAll('.bag-section__grid .bag-section__slot'))
        .map((el) => `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`.trim())
        .filter((label) => label !== ''),

    clickChip: async (label: string) => {
      const select = container.querySelector<HTMLButtonElement>('.chip-select__button')

      if (!select) throw new Error('family select not found')

      select.click()
      await nextTick()

      const option = Array.from(
        container.querySelectorAll<HTMLElement>('.chip-select__option'),
      ).find((el) => (el.textContent ?? '').includes(label))

      if (!option) throw new Error(`option "${label}" not found`)

      option.click()
    },

    visibleCountText: () =>
      container.querySelector('.bag-section__count-label')?.textContent ?? '',

    unmount: () => {
      app.unmount()

      container.remove()
    },
  }
}

describe('MaterialBag — filter/search (plan §3.2 B4)', () => {
  let gameManager: GameManager

  let mounted: ReturnType<typeof mountSection>

  beforeEach(() => {
    gameManager = new GameManager()
  })

  function seedAll() {
    gameManager.catalogOps.registerMaterials([WOOD, ORE, ESSENCE, OTHER, HERB_DECADE, HERB_CENTURY])
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_wood_decade'), 3)
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_ore_decade'), 2)
    gameManager.materialBag.add(gameManager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 5)
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 1)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_DECADE.id), 4)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_CENTURY.id), 7)
  }

  it('chip nhóm lọc đúng nhóm; bỏ chọn chip quay về tất cả', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    await mounted.clickChip('Thảo')
    await nextTick()

    // 2 bien the cung ho thao -> 2 o rieng, moi o ten day du.
    let labels = mounted.slotLabels()

    expect(labels).toHaveLength(2)
    expect(labels[0]).toContain('Thập Niên Tứ Linh Thảo')
    expect(labels[1]).toContain('Bách Niên Tứ Linh Thảo')

    // Chip khac - nhom khac gom Doan Bao Thach (other).
    await mounted.clickChip('Khác')
    await nextTick()

    labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Đoán Bảo Thạch')

    // Chon lai 'Tat ca' trong dropdown -> bo filter (6 o).
    await mounted.clickChip('Tất cả')
    await nextTick()

    expect(mounted.slotLabels()).toHaveLength(6)

    mounted.unmount()
  })

  it('thảo cùng họ tách ô riêng: mỗi biến thể niên đại 1 ô với tên đầy đủ', async () => {
    gameManager.catalogOps.registerMaterials([HERB_DECADE, HERB_CENTURY, HERB_OTHER_FAMILY, HERB_LEGACY])
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_DECADE.id), 4)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_CENTURY.id), 7)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_OTHER_FAMILY.id), 2)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_LEGACY.id), 1)

    mounted = mountSection(gameManager)

    const labels = mounted.slotLabels()

    // 4 material -> 4 o, moi o mang ten day du cua bien the.
    expect(labels).toHaveLength(4)
    expect(labels[0]).toContain('Thập Niên Tứ Linh Thảo')
    expect(labels[1]).toContain('Bách Niên Tứ Linh Thảo')
    expect(labels[2]).toContain('Thập Niên Hồi Xuân Thảo')
    expect(labels[3]).toContain('Linh Thảo Lạ')

    // O Bach Nien mang tooltip dung nien dai cua chinh no (khong bi
    // tron vao ho nao).
    const slots = mounted.container.querySelectorAll<HTMLElement>('.bag-section__grid .bag-section__slot')
    slots[1]!.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    const tip = JSON.stringify(useTooltip().content.value)
    expect(tip).toContain('Phàm Nhân')
    expect(tip).toContain('Bách Niên')
    useTooltip().dismissTooltip()

    mounted.unmount()
  })

  it('quáng cùng realm tách ô riêng: mỗi bậc tuổi 1 ô với tên đầy đủ', async () => {
    gameManager.catalogOps.registerMaterials([ORE_HOANG, ORE_HUYEN])
    gameManager.materialBag.add(gameManager.materialRegistry.get(ORE_HOANG.id), 3)
    gameManager.materialBag.add(gameManager.materialRegistry.get(ORE_HUYEN.id), 5)

    mounted = mountSection(gameManager)

    const labels = mounted.slotLabels()

    // 2 bac tuoi -> 2 o rieng, khong collapse.
    expect(labels).toHaveLength(2)
    expect(labels[0]).toContain('Thập Niên Linh Khoáng')
    expect(labels[1]).toContain('Bách Niên Linh Khoáng')

    // Tooltip o Bach Nien hien dung bac cua no.
    const slots = mounted.container.querySelectorAll<HTMLElement>('.bag-section__grid .bag-section__slot')
    slots[1]!.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    expect(JSON.stringify(useTooltip().content.value)).toContain('Bách Niên')
    useTooltip().dismissTooltip()

    mounted.unmount()
  })

  it('count hiển thị số ô hiện tại (đã lọc)', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    // 6 material = 6 o hien thi (khong gop).
    expect(mounted.visibleCountText()).toContain('6')

    await mounted.clickChip('Gỗ')
    await nextTick()

    expect(mounted.visibleCountText()).toContain('1')

    mounted.unmount()
  })
})
