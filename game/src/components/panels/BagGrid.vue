<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore, type BagTab } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { betaMaterialStackVisible, scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import { usePlayerStore } from '@/stores/player'
import EquipmentBagSection from './bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'
import TabBar from '@/components/common/TabBar.vue'
import { BAG_GRID_TOOLS_KEY } from './bag-sections/BagCell'

// Hành Trang (2026-08-25, resource-professions-rework plan §10.1) —
// Phù/Trận khai tử: còn 3 tab (Trang Bị/Nguyên Liệu/Đan Dược), bỏ hẳn
// luồng pending-select phù/trận liên-panel.
const { t } = useI18n()

const ui = useUiStore()
const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const activeTab = computed<BagTab>(() => ui.activeBagTab)

const BAG_COUNTS: Record<BagTab, () => number> = {
  equipment: () => gameManager.equipmentBag.getAll().length,
  // Same suppressed-source filter as the section's entries - the tab
  // count must agree with what the grid can render.
  material: () =>
    gameManager.materialBag
      .getAll()
      .filter((stack) => betaMaterialStackVisible(stack.material, player.realmId)).length,
  // Same scope-hidden family filter as the section's entries - the tab
  // count must agree with what the grid can render.
  pill: () =>
    gameManager.pillBag
      .getAll()
      .filter((stack) => scopeHiddenPillFamilyOfId(stack.pill.id) === null).length,
}

const activeTabCount = computed(() => {
  stateVersion.value

  return BAG_COUNTS[activeTab.value]()
})

const bagTabs = computed(() => [
  { id: 'equipment' as BagTab, label: t('panels.bag.tabs.equipment') },
  { id: 'material' as BagTab, label: t('panels.bag.tabs.material') },
  { id: 'pill' as BagTab, label: t('panels.bag.tabs.pill') },
])

// Spec 05 head row: category-tabs 288/640 + grid-tools 1180/352 inside
// the 1244 content band. Only hosts wide enough for that geometry get
// the split; narrow hosts (equipment drawer) keep the tab bar full
// width and the sort control stays in the pagination row.
const rootRef = ref<HTMLElement | null>(null)
const isWide = ref(false)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // jsdom has no ResizeObserver - keep the narrow fallback there.
  if (typeof ResizeObserver === 'undefined' || !rootRef.value) {
    return
  }
  resizeObserver = new ResizeObserver(([entry]) => {
    isWide.value = (entry?.contentRect.width ?? 0) >= 720
  })
  resizeObserver.observe(rootRef.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const toolsTarget = computed(() => (isWide.value ? '.bag-grid__tools' : null))
provide(BAG_GRID_TOOLS_KEY, toolsTarget)
</script>

<template>
  <div ref="rootRef" class="bag-grid">
    <div class="bag-grid__head" :class="{ 'is-wide': isWide }">
      <TabBar
        class="bag-grid__tabs"
        :tabs="bagTabs"
        :model-value="ui.activeBagTab"
        art-id="tab-pill"
        @update:model-value="ui.setActiveBagTab($event as BagTab)"
      />
      <div class="bag-grid__tools" data-hk-region="grid-tools" />
    </div>

    <div class="bag-grid__body">
      <EquipmentBagSection v-if="activeTab === 'equipment'" />

      <MaterialBagSection v-else-if="activeTab === 'material'" />

      <PillBagSection v-else-if="activeTab === 'pill'" />
    </div>

    <!-- Spec 09 capacity-bar footer (288/760/1244/48): the count rides
         the bottom edge, not a stray header pinned under the close
         button. -->
    <div class="bag-grid__footer">
      <span class="bag-grid__count">{{ activeTabCount }} {{ t('panels.bag.countSuffix') }}</span>
    </div>
  </div>
</template>

<style scoped>
.bag-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 8px;
  gap: 8px;
  box-sizing: border-box;
  font-family: var(--font-body);
  color: var(--paper-text);
}

.bag-grid__head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bag-grid__tabs {
  flex: 1 1 auto;
  min-width: 0;
}
/* Spec 05 bands: tabs 640/1244 = 51.45% on the left; grid-tools
   352/1244 = 28.3% anchored right (the 252px design gap between them
   stays empty). Narrow hosts keep the full-width tab bar. */
.bag-grid__head.is-wide .bag-grid__tabs {
  flex: 0 0 51.45%;
}
.bag-grid__tools {
  display: none;
}
.bag-grid__head.is-wide .bag-grid__tools {
  flex: 0 0 28.3%;
  margin-left: auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.bag-grid__footer {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  padding: 4px 2px 0;
}

.bag-grid__count {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--paper-text-muted);
}

.bag-grid__body {
  flex: 1;
  min-height: 0;
}
</style>
