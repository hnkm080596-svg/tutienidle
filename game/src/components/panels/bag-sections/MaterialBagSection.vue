<script setup lang="ts">
import { computed, watch } from 'vue'
import SlotView from '../../common/SlotView.vue'
import BagPaginationControls, { type BagSortOption } from './BagPaginationControls.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore, type MaterialSortMode } from '@/stores/ui'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import { compareNumber, compareText, stableSort, withDirection } from '@/composables/useBagSort'
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

function buildTooltip(material: Material, owned: number): GradedItemTooltipContent {
  const rows = [
    { label: 'Phân loại', value: CATEGORY_LABELS[material.category] },
    { label: 'Nguồn chính', value: SOURCE_LABELS[material.sourceType] },
  ]

  if (material.years !== undefined) rows.push({ label: 'Niên đại', value: `${material.years} năm` })
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

// Sort trên MỘT BẢN COPY của toàn bộ list TRƯỚC pagination; comparator
// cuối cùng quay về original index (stable sort trong useBagSort).
const MATERIAL_COMPARATORS: Record<Exclude<MaterialSortMode, 'default'>, (a: MaterialEntry, b: MaterialEntry) => number> = {
  category: (a, b) =>
    CATEGORY_ORDER.indexOf(a.material.category) - CATEGORY_ORDER.indexOf(b.material.category),

  years: (a, b) => compareNumber(a.material.years, b.material.years),

  amount: (a, b) => a.amount - b.amount,

  name: (a, b) => compareText(a.material.name, b.material.name),

  source: (a, b) =>
    SOURCE_ORDER.indexOf(a.material.sourceType) - SOURCE_ORDER.indexOf(b.material.sourceType),
}

const cells = computed<BagCell[]>(() => {
  const sortState = ui.bagSorts.material

  if (sortState.mode === 'default') {
    return entries.value.map((entry) => entry.cell)
  }

  const sorted = stableSort(
    entries.value,
    withDirection(MATERIAL_COMPARATORS[sortState.mode], sortState.direction),
  )

  return sorted.map((entry) => entry.cell)
})

const { currentPage, totalPages, goToPage, resetPage, gridCells } = useBagPagination(cells, pageSize)

// Đổi mode/direction → quay về trang đầu.
watch(
  () => ({ ...ui.bagSorts.material }),
  () => resetPage(),
)
</script>

<template>
  <div class="bag-section">
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
