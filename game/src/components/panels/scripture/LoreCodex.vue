<script setup lang="ts">
// Tang Kinh Cac (Home Hub Phase 7) - grid vat pham lore SO HUU
// (category 'other', vo thuong vo phat - xem data/materials/materials.ts's
// Tan Quyen Truc Co/Ngoc Gian Cu/Nhat Ky Tu Si/Manh Bia), click mo
// LoreCodexModal (Phase 2) doc tron mo ta - CHI hien item DA NHAT
// duoc, khong liet ke toan bo danh sach da co (dung tinh than "manh
// moi phai tu tim thay", khong phai browse catalog biet truoc).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from '../../common/SlotView.vue'
import EmptyState from '../../common/primitives/EmptyState.vue'
import LoreCodexModal from '../LoreCodexModal.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePanelPagination } from '@/composables/usePanelPagination'
import { betaMaterialStackVisible } from '@/core/betaScope'
import { usePlayerStore } from '@/stores/player'

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

const openedContent = ref<{ title: string; description: string } | null>(null)

const loreItems = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAll()
    .filter(stack => stack.material.category === 'other')
    // same suppressed-faucet verdict as the bag section - a below-unlock
    // realm keeps the record but must not see the dormant domain row.
    .filter(stack => betaMaterialStackVisible(stack.material, player.realmId))
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

// Fit-refactor dot 5 - grid manh moi phan trang theo ngan sach chieu cao
// + chieu rong (slot 56px + gap 6px = 62px/o), khong scroll.
const {
  containerEl: loreGridEl,
  currentPage: lorePage,
  totalPages: lorePages,
  goToPage: loreGoTo,
  pageItemsRange: loreRange,
} = usePanelPagination(computed(() => loreItems.value.length), 62, { columnWidth: 62 })

const pagedLoreItems = computed(() => loreItems.value.slice(loreRange.value.start, loreRange.value.end))
</script>

<template>
  <div class="lore-codex">
    <!-- ui-audit creation-meta: empty state was a dead end - the hint
         names where lore fragments actually drop (exploration + monster
         kills, sourceType in data/materials). -->
    <EmptyState v-if="loreItems.length === 0">
      {{ t('panels.scripture.empty') }}<br />
      <small class="lore-codex__empty-hint">{{ t('panels.scripture.emptyHint') }}</small>
    </EmptyState>

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

.lore-codex__empty-hint {
  display: inline-block;
  margin-top: 6px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
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
