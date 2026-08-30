<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SlotView from '../../common/SlotView.vue'
import Chip from '../../common/primitives/Chip.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type MaterialSortMode } from '@/stores/ui'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import {
  compareNumber,
  compareText,
  stableSort,
  withDirection,
} from '@/composables/useBagSort'
import {
  useBagFilter,
  variantRank,
  GROUP_LABELS,
  MATERIAL_GROUPS,
  type FilteredMaterial,
  type MaterialGroup,
} from '@/composables/useBagFilter'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import type { BagCell } from './BagCell'
import type { Material, MaterialCategory } from '@/core/material/Material'
import type { GradedItemTooltipContent } from '@/composables/useTooltip'

const SOURCE_LABELS: Record<Material['sourceType'], string> = {
  boss: 'Thủ Lĩnh',
  monster: 'Yêu Thú',
  building: 'Công Trình',
  exploration: 'Thám Hiểm',
}

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  herb: 'Linh Thảo',
  wood: 'Linh Mộc',
  ore: 'Linh Thiết',
  monster_core: 'Yêu Đan',
  spirit_stone: 'Linh Thạch',
  essence: 'Yêu Tinh',
  byproduct: 'Phế Liệu',
  other: 'Khác',
}

// Thứ tự cố định cho sort theo Phân loại/Nguồn (asc).
const CATEGORY_ORDER: MaterialCategory[] = [
  'herb', 'wood', 'ore', 'monster_core', 'spirit_stone', 'essence', 'byproduct', 'other',
]

const SOURCE_ORDER = Object.keys(SOURCE_LABELS) as Material['sourceType'][]

const SORT_OPTIONS: Array<BagSortOption & { value: MaterialSortMode }> = [
  { value: 'category', label: 'Phân loại' },
  { value: 'years', label: 'Niên đại' },
  { value: 'amount', label: 'Số lượng' },
  { value: 'name', label: 'Tên', ascLabel: 'Tên A–Z', descLabel: 'Tên Z–A' },
  { value: 'source', label: 'Nguồn chính' },
]

const AGE_LABELS: Record<string, string> = {
  decade: 'Thập Niên', century: 'Bách Niên', millennium: 'Thiên Niên', myriad_year: 'Vạn Niên',
}

function buildTooltip(material: Material, owned: number): GradedItemTooltipContent {
  const rows = [
    { label: 'Phân loại', value: CATEGORY_LABELS[material.category] },
    { label: 'Nguồn chính', value: SOURCE_LABELS[material.sourceType] },
  ]

  if (material.profession?.age) {
    rows.push({ label: 'Tuổi thọ', value: AGE_LABELS[material.profession.age] ?? `${material.years ?? 0} năm` })
  } else if (material.years !== undefined) {
    rows.push({ label: 'Tuổi thọ', value: `${material.years} năm` })
  }
  if (material.element !== undefined)
    rows.push({ label: 'Thuộc tính', value: ELEMENT_LABELS[material.element] })

  return {
    kind: 'material',
    name: material.name,
    imagePath: material.icon,
    ownedLabel: `Sở hữu: ${owned}`,
    description: material.description,
    sections: [{ label: 'Thông Tin', rows }],
  }
}

const ui = useUiStore()

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

// Grid responsive theo CHIỀU RỘNG THẬT của .bag-section__grid (đo qua
// ResizeObserver, xem useBagGridLayout.ts) — cột/kích thước ô tự tính
// lại mỗi khi container resize, KHÔNG còn 1 slotPx cố định suy từ %
// chiều cao panel như bản cũ.
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

interface MaterialEntry {
  cell: BagCell

  material: Material

  amount: number
}

const entries = computed<MaterialEntry[]>(() => {
  stateVersion.value

  return gameManager.materialBag.getAll().map((stack) => ({
    material: stack.material,

    amount: stack.amount,

    cell: {
      key: stack.material.id,

      label: stack.material.name,

      description: stack.material.description,

      amount: stack.amount,

      icon: stack.material.icon,

      tooltip: buildTooltip(stack.material, stack.amount),
    },
  }))
})

// ================= Filter/search/gộp họ (plan §3.2 B4) =================
// State filter sống trong phiên (cùng nhóm transient với bagSorts,
// KHÔNG ghi save). Filter chạy TRƯỚC sort + pagination.
const searchQuery = ref('')

const activeGroup = ref<MaterialGroup | 'all'>('all')

// entries map về shape {material, amount} — composable không biết BagCell.
const filterInput = computed(() =>
  entries.value.map((entry) => ({ material: entry.material, amount: entry.amount })),
)

const { filtered, visibleCount } = useBagFilter(filterInput, { searchQuery, activeGroup })

// Material của 1 ô họ thảo: biến thể niên đại CAO NHẤT làm đại diện
// tooltip/icon (badge đã hiện realm + niên đại rộng nhất trên ô).
function representativeMaterial(item: FilteredMaterial): Material {
  const variants = item.family?.variants

  if (!variants) {
    return item.material
  }

  return variants.reduce((best, variant) =>
    variantRank(variant.material) > variantRank(best.material)
      ? { material: variant.material, amount: 0 }
      : best,
  { material: variants[0]!.material, amount: 0 }).material
}

function familyCell(item: FilteredMaterial): BagCell {
  const material = representativeMaterial(item)

  const badge = item.family?.badgeLabel

  return {
    key: item.key,

    label: material.name,

    description: material.description,

    amount: item.amount,

    icon: material.icon,

    tooltip: buildTooltip(material, item.amount),

    nameSegments: badge
      ? [
          { text: material.name },
          { text: badge, colorVar: '--text-muted' },
        ]
      : undefined,
  }
}

// Ô filter bar: tìm kiếm theo tên + chip nhóm (bấm lại chip đang chọn
// để bỏ filter nhóm).
const GROUP_CHIPS: Array<{ value: MaterialGroup | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  ...MATERIAL_GROUPS.map((group) => ({ value: group, label: GROUP_LABELS[group] })),
]

function toggleGroup(value: MaterialGroup | 'all') {
  activeGroup.value = activeGroup.value === value ? 'all' : value
}

// ================= Sort (giữ nguyên hành vi Workstream E) =================
// Filter chạy TRƯỚC sort; sort trên MỘT BẢN COPY (stableSort) rồi mới
// pagination. Họ thảo đã gộp sort theo tên họ.
const MATERIAL_COMPARATORS: Record<Exclude<MaterialSortMode, 'default'>, (a: FilteredMaterial, b: FilteredMaterial) => number> = {
  category: (a, b) =>
    CATEGORY_ORDER.indexOf(a.material.category) - CATEGORY_ORDER.indexOf(b.material.category),

  years: (a, b) => compareNumber(a.material.years, b.material.years),

  amount: (a, b) => a.amount - b.amount,

  name: (a, b) => compareText(a.material.name, b.material.name),

  source: (a, b) =>
    SOURCE_ORDER.indexOf(a.material.sourceType) - SOURCE_ORDER.indexOf(b.material.sourceType),
}

// Ghim Linh Thạch ở ô đầu (plan Workstream D) — chạy TRƯỚC comparator
// sort thường, KHÔNG qua withDirection(), áp dụng ở MỌI mode (kể cả
// default) và cả hai direction.
function comparePinned(a: FilteredMaterial, b: FilteredMaterial): number {
  const aPinned = a.material.category === 'spirit_stone'
  const bPinned = b.material.category === 'spirit_stone'

  if (aPinned === bPinned) return 0

  return aPinned ? -1 : 1
}

const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.material

  const normalCompare: (a: FilteredMaterial, b: FilteredMaterial) => number =
    sortState.mode === 'default'
      ? () => 0
      : withDirection(MATERIAL_COMPARATORS[sortState.mode], sortState.direction)

  const sorted = stableSort(
    filtered.value,
    (a, b) => comparePinned(a, b) || normalCompare(a, b),
  )

  return sorted.map((item) =>
    item.family
      ? familyCell(item)
      : {
          key: item.material.id,
          label: item.material.name,
          description: item.material.description,
          amount: item.amount,
          icon: item.material.icon,
          tooltip: buildTooltip(item.material, item.amount),
        },
  )
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

// Đổi mode/direction/filter → quay về trang đầu.
watch(
  () => ({ ...ui.bagSorts.material }),
  () => resetPage(),
)

watch([searchQuery, activeGroup], () => resetPage())
</script>

<template>
  <div class="bag-section">
    <div class="bag-section__filters">
      <input
        v-model="searchQuery"
        type="search"
        class="bag-section__search"
        placeholder="Tìm nguyên liệu..."
        aria-label="Tìm nguyên liệu theo tên"
      >

      <div class="bag-section__chips" role="group" aria-label="Lọc theo nhóm nguyên liệu">
        <Chip
          v-for="chip in GROUP_CHIPS"
          :key="chip.value"
          :active="activeGroup === chip.value"
          @click="toggleGroup(chip.value)"
        >
          {{ chip.label }}
        </Chip>
      </div>

      <span class="bag-section__count">{{ visibleCount }} loại</span>
    </div>

    <div ref="gridRef" class="bag-section__grid" :style="gridStyle">
      <SlotView
        v-for="(cell, index) in gridCells"
        :key="cell?.key ?? index"
        class="bag-section__slot"
        :item="cell"
        :label="cell?.label"
        :description="cell?.description"
        :amount="cell?.amount"
        :icon="cell?.icon"
        :tooltip="cell?.tooltip"
        :name-segments="cell?.nameSegments"
      />
    </div>

    <BagPaginationControls
      :current-page="currentPage"
      :total-pages="totalPages"
      :sort-options="SORT_OPTIONS"
      :active-mode="ui.bagSorts.material.mode"
      :active-direction="ui.bagSorts.material.direction"
      @go-to-page="goToPage"
      @select-mode="(mode) => ui.setBagSortMode('material', mode as MaterialSortMode)"
      @toggle-direction="ui.toggleBagSortDirection('material')"
      @reset-sort="ui.resetBagSort('material')"
    />
  </div>
</template>

<style scoped>
.bag-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 6px;
}

.bag-section__filters {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.bag-section__search {
  flex: 1 1 120px;
  min-width: 0;
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-xs);
}

.bag-section__search::placeholder {
  color: var(--text-muted);
}

.bag-section__search:focus-visible {
  outline: none;
  border-color: var(--chrome-300);
  box-shadow: var(--focus-ring-chrome);
}

.bag-section__chips {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.bag-section__count {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.bag-section__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
  align-content: start;
  gap: var(--grid-gap);
  overflow: hidden;
}

.bag-section__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
}
</style>
