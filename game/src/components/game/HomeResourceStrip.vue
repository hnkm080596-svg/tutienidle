<script setup lang="ts">
// ui-discoverability-refactor-plan.md §3.5 (2026-08-29) — dải tài nguyên
// THƯỜNG TRỰC ở home: Linh Thạch + 2 vật liệu dùng nhiều nhất cho nâng
// cấp (gỗ + quáng realm hiện tại). Trước đây tài nguyên chính chỉ thấy
// khi mở panel — bây giờ luôn hiển thị; click mở panel Túi tương ứng
// (ui.toggleLeft('inventory') → RightPanel mở tab material).
import { computed } from 'vue'
import { useGameManager } from '@/composables/useGameState'
import { useStateVersion } from '@/composables/useGameState'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import { useUiStore } from '@/stores/ui'

const gameManager = useGameManager()
const ui = useUiStore()

const { stateVersion } = useStateVersion()

const spiritStones = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

// Vật liệu nâng cấp chính — từ building templates đang xây được: lấy
// materialId xuất hiện nhiều nhất trong upgradeCost của các building ĐÃ
// xây (không hard-code id — theo dữ liệu thật của save hiện tại).
const trackedMaterials = computed(() => {
  stateVersion.value

  const counts = new Map<string, number>()

  for (const instance of gameManager.buildingManager.getAll()) {
    const template = gameManager.getBuildingDefinitions().find(entry => entry.id === instance.buildingId)

    if (!template) {
      continue
    }

    for (const entry of template.upgradeCost.flat()) {
      counts.set(entry.materialId, (counts.get(entry.materialId) ?? 0) + entry.amount)
    }
  }

  counts.delete(SPIRIT_STONE_MATERIAL_ID)

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([materialId]) => ({
      materialId,
      amount: gameManager.materialBag.getAmount(materialId),
      name: gameManager.materialRegistry.get(materialId)?.name ?? materialId,
    }))
})

function openBag() {
  ui.openLeftPanel('inventory')
}
</script>

<template>
  <div class="home-resource-strip" data-testid="home-resource-strip">
    <button class="home-resource-strip__item" type="button" @click="openBag">
      <span class="home-resource-strip__name">Linh Thạch</span>
      <span class="home-resource-strip__amount">{{ spiritStones }}</span>
    </button>

    <button
      v-for="material in trackedMaterials"
      :key="material.materialId"
      class="home-resource-strip__item"
      type="button"
      @click="openBag"
    >
      <span class="home-resource-strip__name">{{ material.name }}</span>
      <span class="home-resource-strip__amount">{{ material.amount }}</span>
    </button>
  </div>
</template>

<style scoped>
.home-resource-strip {
  position: absolute;
  z-index: 8;
  top: var(--space-2);
  left: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: calc(var(--space-1) + 2px) var(--space-3);
  background: color-mix(in srgb, var(--ink-900) 72%, transparent);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-md);
  pointer-events: auto;
}

.home-resource-strip__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: 2px var(--space-1);
  border-radius: var(--radius-sm);
}

.home-resource-strip__item:hover {
  background: color-mix(in srgb, var(--gold-500, #c9a45c) 16%, transparent);
}

.home-resource-strip__name {
  color: var(--text-secondary);
}

.home-resource-strip__amount {
  font-weight: 600;
  color: var(--gold-400, #e3c07f);
}
</style>
