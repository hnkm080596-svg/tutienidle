<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import type { BagCell } from './BagCell'
import type { Talisman } from '@/core/talisman/Talisman'
import type { GradedItemTooltipContent } from '@/composables/useTooltip'
import { PHAM_LABELS, composePhamNameSegments } from '@/core/item/Pham'
import { useBagGridLayout } from '@/composables/useBagGridLayout'

// Grid responsive theo chiều rộng thật — xem ghi chú đầy đủ ở
// useBagGridLayout.ts/MaterialBagSection.vue (cùng pattern áp cho cả
// 5 bag-sections).
const { gridRef, pageSize, gridStyle } = useBagGridLayout()

// selectedId: talisman ĐANG chờ chọn đích trang bị (chủ động truyền
// từ ngoài vào — chủ sở hữu state "đang chờ chọn" là component cha,
// vì cha còn phải biết để điều hướng sang Kho/đổi tab tương ứng ngữ
// cảnh nhúng, xem BagGrid.vue/TalismanInstitutePanel.vue — UI redesign
// Step 9: đích trỏ 'inventory', trước đó là 'equipment_hall').
const props = defineProps<{ selectedId?: string | null }>()

const emit = defineEmits<{ toggle: [talismanId: string] }>()

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Tooltip có cấu trúc (2026-08-15) — cùng khuôn GradedItemTooltipContent
// với Pill/Formation, xem useTooltip.ts.
function buildTooltip(talisman: Talisman, owned: number): GradedItemTooltipContent {
  return {
    kind: 'talisman',

    name: talisman.name,

    imagePath: talisman.icon,

    phamLabel: PHAM_LABELS[talisman.pham],

    ownedLabel: `Sở hữu: ${owned}`,

    description: talisman.description,

    sections: [
      {
        label: 'Hiệu Ứng',

        rows: [{ label: 'Mở thêm Ô Phụ', value: `+${talisman.extraSubstatSlots}` }],
      },
    ],
  }
}

const cells = computed<BagCell[]>(() => {
  stateVersion.value

  return gameManager.talismanBag.getAll().map(stack => ({
    key: stack.talisman.id,

    label: stack.talisman.name,

    nameSegments: composePhamNameSegments(stack.talisman.name, stack.talisman.pham),

    description: stack.talisman.description,

    amount: stack.amount,

    selected: props.selectedId === stack.talisman.id,

    tooltip: buildTooltip(stack.talisman, stack.amount),

    itemIcon: stack.talisman.icon,

    onClick: () => emit('toggle', stack.talisman.id),
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
        :name-segments="cell?.nameSegments"
        :description="cell?.description"
        :amount="cell?.amount"
        :selected="cell?.selected"
        :tooltip="cell?.tooltip"
        :item-icon="cell?.itemIcon"
        @click="cell?.onClick?.()"
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
  min-width: 22px;
  height: 22px;
  padding: 0;
  font-size: 0.7rem;
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
