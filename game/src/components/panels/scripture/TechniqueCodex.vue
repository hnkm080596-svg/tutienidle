<script setup lang="ts">
// Tàng Kinh Các (Home Hub Phase 7) — catalog TOÀN BỘ công pháp trong
// data, không chỉ những cái đã học. Đã học → dùng lại TechniqueSlotCard
// (Phase 6, equip/unequip y hệt Động Phủ/LoadoutManager). Chưa học →
// hiện tên/mô tả (sẵn trên template tĩnh, KHÔNG lộ stat/modifiers),
// làm mờ, không click được — cơ chế HỌC (qua item drop, xem
// GameManager.grantItemDrops()'s case 'technique') đã hoạt động sẵn,
// panel này chỉ là UI browse, không thêm cơ chế mới.
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import TechniqueSlotCard from '../loadout-sections/TechniqueSlotCard.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePanelPagination } from '@/composables/usePanelPagination'
import { TECHNIQUES } from '@/data/technique/Techniques'

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Tâm Pháp hợp nhất (2026-08-15) — không còn 3 nhóm theo type, chỉ 1
// danh sách phẳng toàn bộ công pháp trong data.
const techniqueRows = computed(() => {
  stateVersion.value

  return TECHNIQUES.map(technique => ({
    id: technique.id,
    name: technique.name,
    description: technique.description,
    owned: gameManager.techniqueManager.has(technique.id),
  }))
})

// Fit-refactor đợt 5 — catalog phân trang theo ngân sách chiều cao của
// grid (slot 56px + gap 6px = 62px/hàng), không còn scroll dọc.
const {
  containerEl: gridEl,
  currentPage: page,
  totalPages: pages,
  goToPage,
  pageItemsRange,
} = usePanelPagination(computed(() => techniqueRows.value.length), 62)
</script>

<template>
  <div class="technique-codex">
    <div class="technique-codex__group">
      <h5 class="technique-codex__title">Tâm Pháp</h5>

      <!-- Đã trang bị (nếu có) — dùng chung TechniqueSlotCard, biến thể
           hero (Step 12, spec mục 15) khớp focal point "Bí kíp/sách"
           của chính màn Tàng Kinh Các (spec mục 23). -->
      <TechniqueSlotCard label="Tâm Pháp" size="hero" />

      <div ref="gridEl" class="technique-codex__grid">
        <SlotView
          v-for="entry in techniqueRows.slice(pageItemsRange.start, pageItemsRange.end)"
          :key="entry.id"
          class="technique-codex__slot"
          :class="{ 'is-locked': !entry.owned }"
          :item="entry.owned ? entry : null"
          :label="entry.owned ? entry.name : '???'"
          :description="entry.owned ? entry.description : 'Chưa học được công pháp này.'"
        />
      </div>

      <div v-if="pages > 1" class="technique-codex__pagination">
        <button type="button" :disabled="page === 0" @click="goToPage(page - 1)">‹</button>
        <span>{{ page + 1 }} / {{ pages }}</span>
        <button type="button" :disabled="page >= pages - 1" @click="goToPage(page + 1)">›</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.technique-codex {
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--font-body);
}

.technique-codex__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1 1 auto;
}

.technique-codex__title {
  margin: 0;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--chrome-100);
}

.technique-codex__grid {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  overflow: hidden;
}

.technique-codex__pagination {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.technique-codex__pagination button {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.technique-codex__pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.technique-codex__slot {
  flex: 0 0 56px;
  width: 56px;
}

.technique-codex__slot.is-locked {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}
</style>
