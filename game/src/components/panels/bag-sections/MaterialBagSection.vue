<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
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

function buildTooltip(material: Material, owned: number): GradedItemTooltipContent {
  const rows = [
    { label: 'Phân loại', value: CATEGORY_LABELS[material.category] },
    { label: 'Nguồn chính', value: SOURCE_LABELS[material.sourceType] },
  ]

  if (material.years !== undefined) rows.push({ label: 'Niên đại', value: `${material.years} năm` })
  if (material.element !== undefined) rows.push({ label: 'Thuộc tính', value: ELEMENT_LABELS[material.element] })

  return {
    kind: 'material',
    name: material.name,
    imagePath: material.icon,
    ownedLabel: `Sở hữu: ${owned}`,
    description: material.description,
    sections: [{ label: 'Thông Tin', rows }],
  }
}

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Grid responsive theo CHIỀU RỘNG THẬT của .bag-section__grid (đo qua
// ResizeObserver, xem useBagGridLayout.ts) — cột/kích thước ô tự tính
// lại mỗi khi container resize, KHÔNG còn 1 slotPx cố định suy từ %
// chiều cao panel như bản cũ.
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

const cells = computed<BagCell[]>(() => {
  stateVersion.value

  return gameManager.materialBag.getAll().map(stack => ({
    key: stack.material.id,

    label: stack.material.name,

    description: stack.material.description,

    amount: stack.amount,

    icon: stack.material.icon,

    tooltip: buildTooltip(stack.material, stack.amount),
  }))
})

const { currentPage, totalPages, goToPage, gridCells } = useBagPagination(cells, pageSize)
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

    <div class="bag-section__pages">
      <button type="button" :disabled="currentPage === 0" @click="goToPage(currentPage - 1)">‹</button>

      <button
        v-for="page in totalPages"
        :key="page"
        type="button"
        :class="{ 'is-active': currentPage === page - 1 }"
        @click="goToPage(page - 1)"
      >
        {{ page }}
      </button>

      <button type="button" :disabled="currentPage === totalPages - 1" @click="goToPage(currentPage + 1)">›</button>
    </div>
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

.bag-section__pages {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.bag-section__pages button {
  min-width: 36px;
  min-height: 32px;
  padding: 0;
  font-size: var(--text-sm);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-section__pages button.is-active {
  background: var(--gold-500);
  color: var(--gold-ink);
  border-color: var(--gold-500);
}
</style>
