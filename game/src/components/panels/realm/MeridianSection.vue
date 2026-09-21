<script setup lang="ts">
// P7-M7 - read-only Bat Mach (meridian) list inside RealmPanel. The
// invest path is M13-PARKED (no Thong Mach Dan gateway), so rows are
// pure status display over the canonical chapter slice - no action.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { MERIDIANS } from '@/data/realm/Meridians'
import { getBodyChapterProgress } from '@/core/realm/body/BodyProgressionSystem'
import { statLabel } from '@/core/stats/StatLabels'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

const chapterProgress = computed(() => {
  stateVersion.value

  return getBodyChapterProgress(player.$state, 'meridian')
})

const meridianRows = computed(() => {
  stateVersion.value

  const completed = chapterProgress.value.completed

  return MERIDIANS.map((meridian, index) => {
    const status = index < completed
      ? 'opened'
      : index === completed
        ? 'next'
        : 'locked'

    return {
      id: meridian.id,
      name: meridian.name,
      description: meridian.description,
      statLabels: meridian.stats.map(stat => statLabel(stat)).join(' / '),
      percentLabel: `${(meridian.percentAtFullTier * 100).toFixed(0)}%`,
      status,
      // Only the next row shows requirements - later rows stay
      // bare (sequential contract makes their gates un-actionable).
      cost: index === completed ? meridian.thongMachDanCost : null,
      requiredRealmLevel: index === completed ? meridian.requiredRealmLevel : null,
      requiresAux: index === completed && meridian.requiresThienDiaChiKieu === true,
    }
  })
})
</script>

<template>
  <section class="meridian-section" :aria-label="t('panels.realm.meridian.title')">
    <div class="meridian-section__summary">
      <span>{{ t('panels.realm.meridian.summary', { completed: chapterProgress.completed, total: chapterProgress.total }) }}</span>
    </div>

    <div class="meridian-section__rows">
      <div
        v-for="row in meridianRows"
        :key="row.id"
        class="meridian-section__row"
        :class="`meridian-section__row--${row.status}`"
      >
        <div class="meridian-section__row-head">
          <span class="meridian-section__row-name">{{ row.name }}</span>
          <span class="meridian-section__row-state">
            {{ row.status === 'opened' ? t('panels.realm.meridian.stateOpened') : row.status === 'next' ? t('panels.realm.meridian.stateNext') : t('panels.realm.meridian.stateLocked') }}
          </span>
        </div>

        <p class="meridian-section__row-desc">{{ row.description }}</p>
        <p class="meridian-section__row-stats">{{ row.statLabels }} +{{ row.percentLabel }}</p>

        <p v-if="row.status === 'next'" class="meridian-section__row-gate">
          {{ t('panels.realm.meridian.cost', { count: row.cost }) }}
          · {{ t('panels.realm.meridian.realmGate', { level: row.requiredRealmLevel }) }}
          <template v-if="row.requiresAux">· {{ t('panels.realm.meridian.auxGate') }}</template>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.meridian-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.meridian-section__summary {
  display: flex;
  justify-content: space-between;
  font: 700 var(--text-lg) var(--font-display);
  color: var(--paper-text);
}

.meridian-section__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meridian-section__row {
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  opacity: 0.55;
}

.meridian-section__row--opened {
  opacity: 1;
  border-color: var(--jade);
}

.meridian-section__row--next {
  opacity: 0.9;
  border-color: var(--chrome-300);
}

.meridian-section__row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.meridian-section__row-name {
  font-weight: 600;
  color: var(--chrome-100);
  font-size: var(--text-md);
}

.meridian-section__row-state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.meridian-section__row--opened .meridian-section__row-state {
  color: var(--jade);
}

.meridian-section__row-desc {
  margin: 2px 0 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.meridian-section__row-stats {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.meridian-section__row-gate {
  margin: 4px 0 0;
  font-size: var(--text-sm);
  color: var(--crimson);
}
</style>
