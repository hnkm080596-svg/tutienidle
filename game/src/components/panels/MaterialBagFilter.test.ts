// @vitest-environment jsdom
//
// MaterialBag filter/search/group (economy-fixes-sinks-plan.md sec3.2 B4):
// - O tim kiem theo ten (case-insensitive).
// - Filter chip theo nhom (go/quang/thao/tinh hoa/khac).
// - Gop thao theo HO (herbBaseId) voi badge realm/nien dai thay vi
//   liet ke phang 288 bien the nien dai.
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

// Quang that (co profession meta) x 2 tuoi cung realm - nhan khac nhau
// ("Thap Nien"/"Bach Nien" Linh Khoang) nhung van gop ve 1 o nhu ho
// thao theo resourceKind+realmId (useBagFilter.familyKeyFor).
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
// gop family phai collapse con 1 o duy nhat.
function herb(id: string, age: HerbAge, years: number): Material {
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

// Ho khac (recipe khac) - gop family KHONG nham voi ho tren. herbBaseId
// phai khop id conventions (validator: id = `${herbBaseId}_${age}`).
const HERB_OTHER_FAMILY: Material = {
  id: 'hoi_xuan_thao_mortal_decade',
  name: 'Hồi Xuân Thảo',
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

// Thao legacy KHONG profession meta (khong co herbBaseId) - phai roi
// ve 1 o rieng, khong bi gop/chu y nuot mat.
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
    gameManager.catalogOps.registerMaterials([WOOD, ORE, ESSENCE, OTHER, HERB_DECADE, HERB_CENTURY])
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_wood_decade'), 3)
    gameManager.materialBag.add(gameManager.materialRegistry.get('mortal_ore_decade'), 2)
    gameManager.materialBag.add(gameManager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 5)
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
    expect(labels[0]).toContain('Thập Niên Linh Khoáng')

    mounted.unmount()
  })

  it('chip nhóm lọc đúng nhóm; bỏ chọn chip quay về tất cả', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    mounted.clickChip('Thảo')
    await nextTick()

    // 2 bien the cung ho thao -> gop con 1 o.
    let labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Tứ Linh Thảo')

    // Chip khac - nhom khac gom Doan Bao Thach (other).
    mounted.clickChip('Khác')
    await nextTick()

    labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Đoán Bảo Thạch')

    // Bam lai chip dang chon -> bo filter, hien tat ca (5 o: 4 nhom
    // + 1 ho thao da gop).
    mounted.clickChip('Khác')
    await nextTick()

    expect(mounted.slotLabels()).toHaveLength(5)

    mounted.unmount()
  })

  it('gộp thảo theo họ: 1 ô duy nhất với badge realm + niên đại, tooltip vẫn đủ dữ liệu', async () => {
    gameManager.catalogOps.registerMaterials([HERB_DECADE, HERB_CENTURY, HERB_OTHER_FAMILY, HERB_LEGACY])
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_DECADE.id), 4)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_CENTURY.id), 7)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_OTHER_FAMILY.id), 2)
    gameManager.materialBag.add(gameManager.materialRegistry.get(HERB_LEGACY.id), 1)

    mounted = mountSection(gameManager)

    const labels = mounted.slotLabels()

    // 2 ho thao + 1 thao legacy = 3 o (thay vi 4 bien the phang).
    expect(labels).toHaveLength(3)
    expect(labels[0]).toContain('Tứ Linh Thảo')
    expect(labels[1]).toContain('Hồi Xuân Thảo')
    expect(labels[2]).toContain('Linh Thảo Lạ')

    // Badge picks the widest realm/age in the family (Bach Nien > Thap
    // Nien) - nametag caption removed, the info lives in the slot tooltip.
    const firstSlot = mounted.container.querySelector<HTMLElement>('.bag-section__grid .bag-section__slot')
    firstSlot!.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    const tip = JSON.stringify(useTooltip().content.value)
    expect(tip).toContain('Phàm Nhân')
    expect(tip).toContain('Bách Niên')
    useTooltip().dismissTooltip()

    mounted.unmount()
  })

  it('gộp quáng theo realm: 2 bậc tuổi cùng realm collapse về 1 ô, badge hiện bậc cao nhất', async () => {
    gameManager.catalogOps.registerMaterials([ORE_HOANG, ORE_HUYEN])
    gameManager.materialBag.add(gameManager.materialRegistry.get(ORE_HOANG.id), 3)
    gameManager.materialBag.add(gameManager.materialRegistry.get(ORE_HUYEN.id), 5)

    mounted = mountSection(gameManager)

    const labels = mounted.slotLabels()

    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Linh Khoáng')

    // "Bach Nien" badge - nametag removed, verified via tooltip.
    const slot = mounted.container.querySelector<HTMLElement>('.bag-section__grid .bag-section__slot')
    slot!.dispatchEvent(new Event('pointerenter', { bubbles: true }))
    expect(JSON.stringify(useTooltip().content.value)).toContain('Bách Niên')
    useTooltip().dismissTooltip()

    mounted.unmount()
  })

  it('count hiển thị số ô hiện tại (đã gộp/đã lọc)', async () => {
    seedAll()

    mounted = mountSection(gameManager)

    // 6 material - 1 bien the gop = 5 o hien thi.
    expect(mounted.visibleCountText()).toContain('5')

    mounted.clickChip('Gỗ')
    await nextTick()

    expect(mounted.visibleCountText()).toContain('1')

    mounted.unmount()
  })
})
