<script setup lang="ts">
// Chieu Hien Quan - phan bo nhan cong (moved out of ProductionPanel
// 2026-10-11 for the landscape port). FINAL POLICY (sec.4C): the
// manual workforce surface is entirely scope-hidden under beta - the
// allocation block AND the workers stat are governed by the ONE flag
// read. Automatic production keeps running; nothing workforce-related
// renders.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { betaSurfaceVisible } from '@/core/betaScope'
import type { ProductionSiteRow } from './productionViewTypes'

const props = defineProps<{ rows: readonly ProductionSiteRow[]; nowMs: number }>()

const { t } = useI18n()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

const workerSurfaceVisible = betaSurfaceVisible('manualWorkforce')

// Workforce read model (Mission D / spec D1): renders the domain's
// WorkforceView verbatim - no local capacity math, no local mode flag
// (audit T4-29/T4-30).
const workforce = computed(() => {
  stateVersion.value

  // Track the same tick clock the rows read - reserved/available/
  // effective totals and the slider :max must refresh every tick too,
  // not only on bumpState() interactions (T4-30 reintroduction guard).
  void props.nowMs

  return gameManager.buildingOps.getWorkforceView()
})

const workerMode = computed(() =>
  Object.keys(workforce.value.requested).length > 0 ? 'manual' : 'auto',
)

const assignedTotal = computed(() =>
  Object.values(workforce.value.requested).reduce((sum, count) => sum + count, 0),
)

const effectiveTotal = computed(() =>
  Object.values(workforce.value.effective).reduce((sum, count) => sum + count, 0),
)

function setWorkerMode(mode: 'auto' | 'manual') {
  if (mode === 'auto') {
    // Back to auto: clear every manual assignment.
    for (const row of props.rows) {
      gameManager.buildingOps.assignWorkers(row.siteId, undefined)
    }
  } else {
    // Entering manual snapshots the CURRENT allocator grants so the
    // sliders start from domain truth (mode is derived, so requested
    // must be non-empty for 'manual' to show).
    for (const row of props.rows) {
      gameManager.buildingOps.assignWorkers(row.siteId, workforce.value.effective[row.siteId] ?? 0)
    }
  }

  bumpState()
}

function assign(row: ProductionSiteRow, count: number) {
  gameManager.buildingOps.assignWorkers(row.siteId, count)

  bumpState()
}
</script>

<template>
  <div v-if="workerSurfaceVisible" class="worker-allocation">
    <header class="worker-allocation__header">
      <strong>{{ t('panels.production.workersHeader', { used: workerMode === 'manual' ? assignedTotal : effectiveTotal, total: workforce.available }) }}</strong>

      <small v-if="workforce.reserved > 0" class="worker-allocation__reserved">
        {{ t('panels.production.workersReserved', { count: workforce.reserved }) }}
      </small>

      <div class="worker-allocation__mode">
        <label>
          <input
            type="radio"
            name="worker-mode"
            :checked="workerMode === 'auto'"
            @change="setWorkerMode('auto')"
          />
          {{ t('panels.production.workerModeAuto') }}
        </label>

        <label>
          <input
            type="radio"
            name="worker-mode"
            :checked="workerMode === 'manual'"
            @change="setWorkerMode('manual')"
          />
          {{ t('panels.production.workerModeManual') }}
        </label>
      </div>
    </header>

    <div v-if="workerMode === 'manual'" class="worker-allocation__sliders">
      <label v-for="row in rows" :key="row.siteId" class="worker-allocation__slider">
        <span>{{ row.name }}</span>

        <input
          type="range"
          min="0"
          :max="workforce.available"
          :value="row.assignedWorkers ?? 0"
          :aria-label="t('panels.production.workerAssignAria', { name: row.name })"
          @input="assign(row, Number(($event.target as HTMLInputElement).value))"
        />

        <span class="worker-allocation__count">
          {{ row.assignedWorkers ?? 0 }}
        </span>
      </label>
    </div>

    <p v-else class="worker-allocation__auto-hint">
      {{ t('panels.production.workerAutoHint') }}
    </p>
  </div>
</template>

<style scoped>
/* Canonical allocation block (no preview counterpart) - chrome nudged
   toward the ported paper-card look, structure untouched. */
.worker-allocation {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 3px double #b58a42;
  background: #f7ecd4 url('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png') center / cover;
  color: #30271b;
}

.worker-allocation__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.worker-allocation__mode {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.worker-allocation__mode label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.worker-allocation__sliders {
  display: grid;
  gap: 6px;
}

.worker-allocation__slider {
  display: grid;
  grid-template-columns: minmax(80px, auto) 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.worker-allocation__count {
  min-width: 2ch;
  text-align: right;
  color: #468358;
}

.worker-allocation__auto-hint {
  margin: 0;
  color: #8a7450;
  font-size: 12px;
}

.worker-allocation__reserved {
  color: #8a7450;
  font-size: 12px;
}
</style>
