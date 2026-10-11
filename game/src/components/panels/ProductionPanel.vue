<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatDuration } from '@/core/format/formatDuration'
import ProductionSiteCard from '@/components/panels/production/ProductionSiteCard.vue'
import ProductionVeinCard from '@/components/panels/production/ProductionVeinCard.vue'
import ProductionWorkerAllocation from '@/components/panels/production/ProductionWorkerAllocation.vue'
import type { ProductionSiteRow } from '@/components/panels/production/productionViewTypes'

// San Xuat (2026-08-25, resource-professions-rework plan sec9.1) - thay
// ExplorationPanel: moi Dia Gioi hien thi dung ba card Lam/Quang/
// Dong Thien voi level + speed, trang thai idle/producing, dong ho
// cycle, normalized realm-tier weights, Auto toggle. Mission D
// (spec D3): sites produce on worker lanes only - no Start button;
// NO Claim button - completions go straight to Bag (sec 4.3).
// 2026-10-11 landscape port: the inner pieces (worker allocation, linh
// mach vein card, per-source site cards) extracted into
// panels/production/* and rendered through the shared art components
// (LANDSCAPE preview shape). This file keeps the frame: the row
// projection, the 500ms tick clock, the summary and the card grid.
const { t } = useI18n()

const KNOWN_KINDS = new Set(['forest', 'mine', 'grotto'])

const gameManager = useGameManager()

const { stateVersion } = useStateVersion()

const nowMs = ref(Date.now())

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const rows = computed<ProductionSiteRow[]>(() => {
  stateVersion.value

  void nowMs.value

  return gameManager.buildingOps.getProductionViews(nowMs.value).map((view) => {
    const cycleRemainingMs = view.cycleRemainingMs ?? 0

    const totalMs = view.cycleTotalMs ?? 1

    const remainingSeconds = Math.ceil(cycleRemainingMs / 1000)

    const kind = view.definition.kind

    return {
      siteId: view.definition.siteId,

      kind,

      kindLabel: KNOWN_KINDS.has(kind)
        ? t(`panels.production.kinds.${kind}` as const)
        : kind,

      name: view.definition.name,

      description: view.definition.description,

      level: view.state.level,

      maxLevel: view.definition.maxLevel,

      productionSpeedMultiplier: view.productionSpeedMultiplier,

      nextProductionSpeedMultiplier: view.nextProductionSpeedMultiplier,

      autoRestart: view.state.autoRestart,

      activeWorkerSlots: view.state.activeWorkerSlots,

      assignedWorkers: view.state.assignedWorkers,

      isProducing: (view.state.workerCycles?.length ?? 0) > 0 || view.state.activeWorkerSlots > 0,

      progress: Math.min(1, Math.max(0, 1 - cycleRemainingMs / totalMs)),

      remainingLabel:
        remainingSeconds > 0 ? formatDuration(remainingSeconds) : t('panels.production.done'),
    }
  })
})
</script>

<template>
  <div class="production-panel scrollfade">
      <p class="production-panel__summary">
        {{ t('panels.production.summary') }}
      </p>

      <!-- Chieu Hien Quan - phan bo nhan cong (2026-09-02). The piece
           self-hides under beta via the manualWorkforce flag. -->
      <ProductionWorkerAllocation :rows="rows" :now-ms="nowMs" />

      <!-- Linh mach Khai Vat Duong - claim Linh Thach (the Linh Tuyen) -->
      <ProductionVeinCard :now-ms="nowMs" />

      <div class="production-panel__grid">
        <ProductionSiteCard v-for="row in rows" :key="row.siteId" :row="row" />
      </div>
    </div>
</template>

<style scoped>
.production-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 12px;
  overflow-y: auto;
  color: var(--paper-text);
  font-family: var(--font-body);
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 50% 0, color-mix(in srgb, var(--jade) 8%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.production-panel__summary {
  margin: 0;
  color: var(--paper-eyebrow);
  font-size: var(--text-sm);
}

.production-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 10px;
}
</style>
