<script setup lang="ts">
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBagPagination } from '@/composables/useBagPagination'
import { useBagGridLayout } from '@/composables/useBagGridLayout'
import type { BagCell } from './BagCell'

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
