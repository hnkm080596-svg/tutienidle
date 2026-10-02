<script setup lang="ts">
// Scene 09 scaffold - detail-panel region (spec 1160/176/372/610).
// Ref order: chapter head, stage vista, enemies, rewards, CTA, modes.
// The INVALID attempt counter and the power-compare rows have no
// read-model and are not built (flagged to coordinator).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Stage } from '@/core/stage/Stage'
import type { StageSurfaceModel } from '@/core/game/GameManagerStageOps'
import type { BattleRunMode } from '@/stores/ui'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import ExplorationAutoFarmRow from './ExplorationAutoFarmRow.vue'
import ExplorationStageHead from './ExplorationStageHead.vue'
import ExplorationStageThumb from './ExplorationStageThumb.vue'
import ExplorationEnemyList from './ExplorationEnemyList.vue'
import ExplorationRewardRow from './ExplorationRewardRow.vue'
import ExplorationStartRow from './ExplorationStartRow.vue'
import ExplorationModeGroup from './ExplorationModeGroup.vue'

const props = defineProps<{
  stage: Stage | null
  model: StageSurfaceModel | undefined
  chapterLabel: string
  armedFarmStageName: string | null
  mode: BattleRunMode
  perfectClear: boolean
  canStart: boolean
}>()

const emit = defineEmits<{
  (e: 'stop-farm'): void
  (e: 'open-build'): void
  (e: 'start'): void
  (e: 'update:mode', mode: BattleRunMode): void
}>()

const { t } = useI18n()

const stageCode = computed(() => {
  const stage = props.stage
  if (!stage) {
    return ''
  }
  return `${stage.chapter ?? 1}-${stage.floor ?? stage.requiredRealmLevel ?? 1}`
})

</script>

<template>
  <section class="stage-select__detail art-needed" data-art-id="exploration-detail-panel-bg">
    <ExplorationAutoFarmRow
      v-if="props.armedFarmStageName"
      :stage-name="props.armedFarmStageName"
      @stop="emit('stop-farm')"
    />
    <template v-if="props.stage">
      <ExplorationStageHead :stage="props.stage" :model="props.model" :chapter-label="props.chapterLabel" />
      <ExplorationStageThumb :code="stageCode" />
      <ExplorationEnemyList :stage="props.stage" :model="props.model" />
      <ExplorationRewardRow :preview="props.model?.rewardPreview" />
      <ExplorationStartRow :can-start="props.canStart" @open-build="emit('open-build')" @start="emit('start')" />
      <ExplorationModeGroup :model-value="props.mode" :perfect-clear="props.perfectClear" @update:model-value="emit('update:mode', $event)" />
    </template>

    <EmptyState v-else size="lg">{{ t('panels.stageSelect.empty.selectStage') }}</EmptyState>
  </section>
</template>

<style scoped>
/* Ref detail slab: dark ink panel with gold accents riding the
   parchment interior. */
.stage-select__detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  /* Deeper bottom pad: the last content line clipped at the panel's
     bottom edge against the slab's painted rim. */
  padding: 12px 12px 20px;
  border-radius: var(--radius-sm);
  margin: 8px;
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--hk-gold, #b99a55) 10%, transparent), transparent 55%),
    linear-gradient(180deg, color-mix(in srgb, #101718 96%, var(--paper-50)), #101718);
  color: var(--paper-50);
}

.stage-select__detail :deep(.stage-select__title) {
  margin: 0 0 8px;
  font-family: var(--font-display);
  color: var(--paper-50);
  font-size: var(--text-body);
}

.stage-select__detail :deep(.exploration-head__eyebrow) {
  color: color-mix(in srgb, var(--hk-gold, #b99a55) 80%, var(--paper-50));
}

.stage-select__detail :deep(.stage-select__description),
.stage-select__detail :deep(.stage-select__mode-hint),
.stage-select__detail :deep(.exploration-section-label),
.stage-select__detail :deep(.stage-select__autofarm),
.stage-select__detail :deep(.stage-select__enemy small),
.stage-select__detail :deep(.stage-map__copy small) {
  color: color-mix(in srgb, var(--paper-50) 72%, transparent);
}

.stage-select__detail :deep(.stage-select__enemy) {
  border-color: color-mix(in srgb, var(--paper-50) 18%, transparent);
  background: color-mix(in srgb, var(--paper-50) 7%, transparent);
}
.stage-select__detail :deep(.stage-select__enemy strong) { color: var(--paper-50); }

.stage-select__detail :deep(.stage-select__encounter-summary span) {
  border-color: color-mix(in srgb, var(--hk-gold, #b99a55) 35%, transparent);
  background: color-mix(in srgb, var(--paper-50) 8%, transparent);
  color: color-mix(in srgb, var(--paper-50) 85%, transparent);
}
.stage-select__detail :deep(.stage-select__encounter-summary .is-boss) {
  border-color: color-mix(in srgb, var(--crimson) 55%, transparent);
  color: color-mix(in srgb, var(--crimson) 55%, var(--paper-50));
}

.stage-select__detail :deep(.exploration-rewards__slot) {
  background: color-mix(in srgb, var(--paper-50) 7%, transparent);
  border-color: color-mix(in srgb, var(--hk-gold, #b99a55) 40%, transparent);
}
.stage-select__detail :deep(.exploration-rewards__slot strong) { color: color-mix(in srgb, var(--paper-50) 78%, transparent); }
.stage-select__detail :deep(.exploration-rewards__slot small) { color: var(--hk-gold, #b99a55); }

.stage-select__detail :deep(.empty-state) {
  color: color-mix(in srgb, var(--paper-50) 65%, transparent);
  font-size: var(--text-xs);
}
</style>
