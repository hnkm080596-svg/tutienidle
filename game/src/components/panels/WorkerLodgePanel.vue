<script setup lang="ts">
// Chieu Hien Quan panel (chi-hien-quan spec 2026-09-02, functionType
// 'worker_lodge'). Building upgrade goes through the shared
// FunctionOverlayPanel header (useBuildingHeaderState) - this panel is
// read-only display + the gacha surface added by companion-gacha Task 9
// (2026-09-12): TabBar with nhan_cong (worker capacity, the original
// body) / chieu_mo (ChieuMoTab - token pull) / duyen_phan
// (DuyenPhanTab - pick-your-own exchange). Pattern copied from
// EquipmentHallPanel.vue.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getWorkerCapacityForLevel } from '@/core/production/WorkerCapacity'
import TabBar from '@/components/common/TabBar.vue'
import ChieuMoTab from './worker-lodge/ChieuMoTab.vue'
import DuyenPhanTab from './worker-lodge/DuyenPhanTab.vue'

const BUILDING_ID = 'chi_hien_quan'

const { t } = useI18n({ useScope: 'local' })

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const TABS = [
  { id: 'nhan_cong', label: t('workerLodge.tabs.nhanCong') },
  { id: 'chieu_mo', label: t('workerLodge.tabs.chieuMo') },
  { id: 'duyen_phan', label: t('workerLodge.tabs.duyenPhan') },
] as const

type TabId = (typeof TABS)[number]['id']

const activeTab = ref<TabId>('nhan_cong')

function switchTab(tab: TabId) {
  activeTab.value = tab
}

const instance = computed(() => {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(BUILDING_ID)
})

const template = computed(() => {
  stateVersion.value

  return gameManager.getBuildingDefinitions().find((entry) => entry.id === BUILDING_ID)
})

const capacity = computed(() => getWorkerCapacityForLevel(instance.value?.level ?? 0))

const nextCapacity = computed(() => {
  const level = instance.value?.level ?? 0

  return instance.value && level < (template.value?.maxLevel ?? 0)
    ? getWorkerCapacityForLevel(level + 1)
    : undefined
})
</script>

<template>
  <section class="worker-lodge-panel">
    <p class="worker-lodge-panel__description">{{ template?.description }}</p>

    <TabBar
      class="worker-lodge-panel__tabs"
      :tabs="TABS.map((tab) => ({ id: tab.id, label: tab.label }))"
      :model-value="activeTab"
      @update:model-value="switchTab($event as TabId)"
    />

    <div v-if="activeTab === 'nhan_cong'" class="worker-lodge-panel__card">
      <h3>{{ t('workerLodge.nhanCong.title') }}</h3>

      <p class="worker-lodge-panel__capacity">
        <strong>{{ capacity }}</strong> {{ t('workerLodge.nhanCong.capacitySuffix') }}
      </p>

      <small v-if="nextCapacity !== undefined" class="worker-lodge-panel__next">
        {{ t('workerLodge.nhanCong.nextLevel', { level: (instance?.level ?? 0) + 1, count: nextCapacity }) }}
      </small>
      <small v-else class="worker-lodge-panel__next">{{ t('workerLodge.nhanCong.maxLevel') }}</small>

      <p class="worker-lodge-panel__hint">
        {{ t('workerLodge.nhanCong.hint') }}
      </p>
    </div>

    <ChieuMoTab v-else-if="activeTab === 'chieu_mo'" />

    <DuyenPhanTab v-else-if="activeTab === 'duyen_phan'" />
  </section>
</template>

<style scoped>
.worker-lodge-panel {
  min-height: 100%;
  padding: 18px;
  color: var(--paper-text);
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--jade) 8%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.worker-lodge-panel__description {
  margin: 0 0 16px;
  color: var(--paper-text-soft);
  line-height: var(--lh-relaxed);
}

.worker-lodge-panel__tabs {
  margin: 0 0 12px;
}

.worker-lodge-panel__card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--jade) 40%, var(--paper-line));
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, color-mix(in srgb, var(--jade) 12%, var(--paper-50)), color-mix(in srgb, var(--jade) 5%, var(--paper-100)));
}

.worker-lodge-panel__card h3 {
  margin: 0;
  color: var(--jade);
  font: 700 var(--text-lg) var(--font-display);
}

.worker-lodge-panel__capacity {
  margin: 0;
  font-size: var(--text-lg);
}

.worker-lodge-panel__next {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.worker-lodge-panel__hint {
  margin: 0;
  color: var(--paper-text-muted);
  font-size: var(--text-sm);
}
</style>
