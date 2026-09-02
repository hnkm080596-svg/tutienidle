<script setup lang="ts">
// Chiêu Hiền Quán panel (chi-hien-quan spec 2026-09-02, functionType
// 'worker_lodge') — hiển thị cấp CHQ, nhân công tối đa (1+level×2),
// capacity kế tiếp. Nâng cấp qua header dùng chung FunctionOverlayPanel
// (useBuildingHeaderState) — panel chỉ đọc data + hiển thị.
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getWorkerCapacityForLevel } from '@/core/production/WorkerCapacity'

const BUILDING_ID = 'chi_hien_quan'

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

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

    <div class="worker-lodge-panel__card">
      <h3>Nhân công</h3>

      <p class="worker-lodge-panel__capacity">
        <strong>{{ capacity }}</strong> hiền sĩ theo về
      </p>

      <small v-if="nextCapacity !== undefined" class="worker-lodge-panel__next">
        Cấp {{ (instance?.level ?? 0) + 1 }}: {{ nextCapacity }} nhân công
      </small>
      <small v-else class="worker-lodge-panel__next">Cấp tối đa</small>

      <p class="worker-lodge-panel__hint">
        Nhân công được phân bổ vào các nguồn khai thác ở panel Sản Xuất.
      </p>
    </div>
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
