<script setup lang="ts">
// Tàng Kinh Các (Home Hub Phase 7) — grid vật phẩm lore SỞ HỮU
// (category 'other', vô thưởng vô phạt — xem data/materials/materials.ts's
// Tàn Quyển Trúc Cơ/Ngọc Giản Cũ/Nhật Ký Tu Sĩ/Mảnh Bia), click mở
// LoreCodexModal (Phase 2) đọc trọn mô tả — CHỈ hiện item ĐÃ NHẶT
// được, không liệt kê toàn bộ danh sách như TechniqueCodex (đúng tinh
// thần "manh mối phải tự tìm thấy", không phải browse catalog biết
// trước).
import { computed, ref } from 'vue'
import SlotView from '../../common/SlotView.vue'
import EmptyState from '../../common/primitives/EmptyState.vue'
import LoreCodexModal from '../LoreCodexModal.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePanelPagination } from '@/composables/usePanelPagination'

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const openedContent = ref<{ title: string; description: string } | null>(null)

const loreItems = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAll()
    .filter(stack => stack.material.category === 'other')
    .map(stack => ({
      key: stack.material.id,
      label: stack.material.name,
      description: stack.material.description,
      amount: stack.amount,
      onClick: () => {
        openedContent.value = { title: stack.material.name, description: stack.material.description ?? '' }
      },
    }))
})

// Fit-refactor đợt 5 — grid manh mối phân trang theo ngân sách chiều cao
// (slot 56px + gap 6px), không scroll.
const {
  containerEl: loreGridEl,
  currentPage: lorePage,
  totalPages: lorePages,
  goToPage: loreGoTo,
  pageItemsRange: loreRange,
} = usePanelPagination(computed(() => loreItems.value.length), 62)

const pagedLoreItems = computed(() => loreItems.value.slice(loreRange.value.start, loreRange.value.end))
</script>

<template>
  <div class="lore-codex">
    <EmptyState v-if="loreItems.length === 0">Chưa tìm thấy manh mối nào.</EmptyState>

    <template v-else>
      <div ref="loreGridEl" class="lore-codex__grid">
        <SlotView
          v-for="item in pagedLoreItems"
          :key="item.key"
          class="lore-codex__slot"
          :item="item"
          :label="item.label"
          :description="item.description"
          :amount="item.amount"
          @click="item.onClick"
        />
      </div>

      <div v-if="lorePages > 1" class="lore-codex__pagination">
        <button type="button" :disabled="lorePage === 0" @click="loreGoTo(lorePage - 1)">‹</button>
        <span>{{ lorePage + 1 }} / {{ lorePages }}</span>
        <button type="button" :disabled="lorePage >= lorePages - 1" @click="loreGoTo(lorePage + 1)">›</button>
      </div>
    </template>

    <LoreCodexModal :content="openedContent" @close="openedContent = null" />
  </div>
</template>

<style scoped>
.lore-codex {
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--font-body);
}

.lore-codex .empty-state {
  padding: 12px;
}

.lore-codex__grid {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  overflow: hidden;
}

.lore-codex__slot {
  flex: 0 0 56px;
  width: 56px;
}

.lore-codex__pagination {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
  font-variant-numeric: tabular-nums;
}

.lore-codex__pagination button {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.lore-codex__pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
