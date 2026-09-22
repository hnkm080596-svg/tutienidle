<script setup lang="ts">
// P7-M7 - Luyen The tier block inside RealmPanel, ported verbatim from
// the retired LuyenThePanel.vue (panel chrome stripped). Read-only:
// Tinh Hoa Pham The auto-invests through the tick (BodyRefinementChapter).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { baseGainKeys, BODY_REFINEMENT_TIERS } from '@/data/realm/BodyRefinement'
import { getActiveTierIndex, getRefinementCurrentTierProgress, getTierCap, isTierRequiredRealmLevelMet } from '@/core/realm/body/BodyRefinementChapter'
import { getBodyChapterProgress, getPhysiqueGrade } from '@/core/realm/body/BodyProgressionSystem'
import { statLabel } from '@/core/stats/StatLabels'
import { formatNumber } from '@/core/format/NumberFormatter'
import Bar from '@/components/common/primitives/Bar.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

const activeTierIndex = computed(() => {
  stateVersion.value

  return getActiveTierIndex(player.$state)
})

const chapterProgress = computed(() => {
  stateVersion.value

  return getBodyChapterProgress(player.$state, 'body_refinement')
})

// M-QI-07 (QI-D4) - persisted physique grade, pure read through the
// canonical read model (the transform lives in BodyProgressionSystem,
// never in this component).
const physiqueGradeLabel = computed(() => {
  stateVersion.value

  return t(`panels.realm.physique.grades.${getPhysiqueGrade(player.$state)}`)
})

const tierRows = computed(() => {
  stateVersion.value

  const completedTiers = chapterProgress.value.completed
  const currentTierProgress = getRefinementCurrentTierProgress(player.$state)

  return BODY_REFINEMENT_TIERS.map((tier, index) => {
    const cap = getTierCap(index)

    let progress = 0
    let status: 'done' | 'active' | 'realm_locked' | 'locked' = 'locked'

    if (index < completedTiers) {
      progress = cap
      status = 'done'
    } else if (index === completedTiers) {
      progress = currentTierProgress
      status = isTierRequiredRealmLevelMet(player.$state, index) ? 'active' : 'realm_locked'
    }

    return {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      statLabels: baseGainKeys(tier.baseGains).map(stat => statLabel(stat)).join(' / '),
      requiredRealmLevel: tier.requiredRealmLevel,
      progress,
      cap,
      percent: cap > 0 ? Math.min(100, (progress / cap) * 100) : 0,
      status,
    }
  })
})
</script>

<template>
  <section class="body-refinement" :aria-label="t('panels.realm.bodyRefinement.title')">
    <div class="body-refinement__summary">
      <span>{{ t('panels.realm.bodyRefinement.summary', { completed: chapterProgress.completed }) }}</span>
      <span class="body-refinement__physique">
        {{ t('panels.realm.physique.line', { grade: physiqueGradeLabel }) }}
      </span>
    </div>

    <p class="body-refinement__note">
      {{ t('panels.realm.bodyRefinement.note') }}
    </p>

    <template v-if="activeTierIndex !== undefined">
      <div class="body-refinement__tiers">
        <div
          v-for="row in tierRows"
          :key="row.id"
          class="body-refinement__tier"
          :class="`body-refinement__tier--${row.status}`"
        >
          <div class="body-refinement__tier-head">
            <span class="body-refinement__tier-name">{{ row.name }}</span>
            <span class="body-refinement__tier-stat">{{ row.statLabels }}</span>
          </div>

          <p class="body-refinement__tier-desc">{{ row.description }}</p>

          <p v-if="row.status === 'realm_locked'" class="body-refinement__tier-lock">
            {{ t('panels.realm.bodyRefinement.tierLock', { level: row.requiredRealmLevel }) }}
          </p>

          <Bar class="body-refinement__tier-bar" :value="row.progress" :max="row.cap" :height="5" />

          <span class="body-refinement__tier-progress">
            {{ formatNumber(row.progress) }} / {{ formatNumber(row.cap) }}
          </span>
        </div>
      </div>
    </template>

    <EmptyState v-else size="lg">{{ t('panels.realm.bodyRefinement.empty') }}</EmptyState>
  </section>
</template>

<style scoped>
.body-refinement {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.body-refinement__summary {
  display: flex;
  justify-content: space-between;
  font: 700 var(--text-lg) var(--font-display);
  color: var(--paper-text);
}

.body-refinement__physique {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--jade);
}

.body-refinement__note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--jade);
}

.body-refinement__tiers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.body-refinement__tier {
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  opacity: 0.55;
}

.body-refinement__tier--active {
  opacity: 1;
  border-color: var(--chrome-300);
}

.body-refinement__tier--realm_locked {
  opacity: 0.8;
  border-color: var(--ink-line-soft);
}

.body-refinement__tier--done {
  opacity: 1;
}

.body-refinement__tier-lock {
  margin: 2px 0 6px;
  font-size: var(--text-sm);
  color: var(--crimson);
}

.body-refinement__tier-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.body-refinement__tier-name {
  font-weight: 600;
  color: var(--chrome-100);
  font-size: var(--text-md);
}

.body-refinement__tier-stat {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.body-refinement__tier-desc {
  margin: 2px 0 6px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.body-refinement__tier-bar {
  border-radius: 3px;
}

.body-refinement__tier-progress {
  display: block;
  margin-top: 3px;
  font-size: var(--text-md);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
</style>
