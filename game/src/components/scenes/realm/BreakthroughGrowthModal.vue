<script setup lang="ts">
import { computed, ref, useId, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BreakthroughGrowthSnapshot, RealmFoundationTotals } from '@/core/realm/RealmFoundationGrowth'
import { formatNumber } from '@/core/format/NumberFormatter'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { useAudioStore } from '@/stores/audio'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateButton from '@/components/common/art/OrnateButton.vue'
import OrnateDivider from '@/components/common/art/OrnateDivider.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'

const props = defineProps<{
  snapshot: BreakthroughGrowthSnapshot | null
}>()

const emit = defineEmits<{
  close: []
  openAttributes: []
}>()

const { t } = useI18n()
const titleId = useId()

const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null

function onContinue() {
  useAudioStore().cue('ui.confirm')
  useAudioStore().cue('ui.modal.close')
  emit('close')
}

function onOpenAttributes() {
  useAudioStore().cue('ui.confirm')
  emit('openAttributes')
}

useDialogFocus(
  panelEl,
  computed(() => Boolean(props.snapshot)),
  { onEscape: onContinue },
)

const STAT_LABEL_KEYS: Record<keyof RealmFoundationTotals, string> = {
  maxHp: 'panels.realm.growthModal.stats.maxHp',
  might: 'panels.realm.growthModal.stats.might',
  defense: 'panels.realm.growthModal.stats.defense',
  hpRegenPerTurn: 'panels.realm.growthModal.stats.hpRegenPerTurn',
  speed: 'panels.realm.growthModal.stats.speed',
  cultivationPercent: 'panels.realm.growthModal.stats.cultivationPercent',
  productionSpeedMultiplier: 'panels.realm.growthModal.stats.productionSpeedMultiplier',
  affixDeltaPercent: 'panels.realm.growthModal.stats.affixDeltaPercent',
  realmPassivePercent: 'panels.realm.growthModal.stats.realmPassivePercent',
}

const PERCENT_KEYS = new Set<keyof RealmFoundationTotals>([
  'cultivationPercent',
  'productionSpeedMultiplier',
  'affixDeltaPercent',
  'realmPassivePercent',
])

function formatStatVal(stat: keyof RealmFoundationTotals, val: number): string {
  if (PERCENT_KEYS.has(stat)) {
    const pct = val * 100
    return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
  }
  return Number.isInteger(val) ? formatNumber(val) : val.toFixed(1)
}
</script>

<template>
  <div
    v-if="snapshot"
    class="breakthrough-growth-modal"
    :style="{ zIndex: OVERLAY_LAYERS.modal }"
    data-testid="breakthrough-growth-modal"
    @click.self="onContinue"
  >
    <OrnateDialog
      ref="dialogRef"
      class="breakthrough-growth__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :title="t('panels.realm.growthModal.title')"
      :title-id="titleId"
      badge="info"
      show-close
      :close-label="t('panels.realm.growthModal.continueCta')"
      width="min(560px, 94vw)"
      @close="onContinue"
    >
      <div class="breakthrough-growth__transition">
        <span class="breakthrough-growth__realm-from">
          {{ snapshot.fromRealmName }} · {{ t('panels.realm.growthModal.floor', { level: snapshot.fromLevel }) }}
        </span>
        <span class="breakthrough-growth__arrow" aria-hidden="true">⟶</span>
        <strong class="breakthrough-growth__realm-to">
          {{ snapshot.toRealmName }} · {{ t('panels.realm.growthModal.floor', { level: snapshot.toLevel }) }}
        </strong>
      </div>

      <OrnateDivider />

      <ul class="breakthrough-growth__rows">
        <StatRow
          v-for="row in snapshot.statRows"
          :key="row.stat"
          :label="t(STAT_LABEL_KEYS[row.stat])"
          tone="positive"
        >
          <span class="breakthrough-growth__val-before">{{ formatStatVal(row.stat, row.before) }}</span>
          <span class="breakthrough-growth__val-sep" aria-hidden="true"> → </span>
          <strong class="breakthrough-growth__val-after">{{ formatStatVal(row.stat, row.after) }}</strong>
          <em class="breakthrough-growth__val-delta"> (+{{ formatStatVal(row.stat, row.delta) }})</em>
        </StatRow>
      </ul>

      <div v-if="snapshot.attributePointsGained > 0" class="breakthrough-growth__reward">
        <strong>{{ t('panels.realm.growthModal.freePointGain', { count: snapshot.attributePointsGained }) }}</strong>
        <small>{{ t('panels.realm.growthModal.freePointTotal', { total: snapshot.totalAttributePoints }) }}</small>
      </div>

      <template #actions>
        <OrnateButton
          v-if="snapshot.attributePointsGained > 0"
          class="breakthrough-growth__allocate"
          variant="dark"
          :sound="false"
          @click="onOpenAttributes"
        >
          {{ t('panels.realm.growthModal.allocateCta') }}
        </OrnateButton>
        <OrnateButton
          class="breakthrough-growth__continue"
          variant="gold"
          :sound="false"
          @click="onContinue"
        >
          {{ t('panels.realm.growthModal.continueCta') }}
        </OrnateButton>
      </template>
    </OrnateDialog>
  </div>
</template>

<style scoped>
/* SceneDesignCanvas(--overlay) sets pointer-events:none on its wrapper;
   explicitly re-enable pointer-events here so the dialog and its buttons
   receive clicks. */
.breakthrough-growth-modal {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim, rgba(10, 9, 7, 0.72));
}

.breakthrough-growth__panel {
  flex: none;
  pointer-events: auto;
  --ornate-button-label-size: min(2.9cqh, 1.8cqw, 20px);
}

.breakthrough-growth__panel :deep(.ornate-dialog__badge) {
  height: 13.5cqh;
  margin-top: 0.4%;
}

.breakthrough-growth__panel :deep(.ornate-dialog__actions) {
  margin-bottom: 3.2cqh;
}

.breakthrough-growth__transition {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0.2cqh;
  font-family: var(--font-display);
  font-size: min(3cqh, 16px);
  color: var(--paper-text, #302719);
}

.breakthrough-growth__realm-from {
  color: var(--paper-text-soft, #5e5a50);
}

.breakthrough-growth__arrow {
  color: #8a5a19;
  font-weight: 700;
}

.breakthrough-growth__realm-to {
  color: #6b3f08;
  font-weight: 700;
}

.breakthrough-growth__rows {
  --hk-text-primary: var(--paper-text, #302719);
  --hk-text-secondary: var(--paper-text-soft, #5e5a50);
  --hk-text-muted: var(--paper-text-muted, #8f897c);
  --hk-jade: var(--hk-jade-deep, #1f6b50);
  list-style: none;
  margin: 0.3cqh 0 0;
  padding: 0;
  width: 100%;
  font-family: var(--font-body);
  font-size: min(2.6cqh, 15px);
  display: flex;
  flex-direction: column;
  gap: 0.35cqh;
}

.breakthrough-growth__rows :deep(.stat-row) {
  padding: 2px 0;
}

.breakthrough-growth__val-before {
  color: var(--paper-text-soft, #675637);
  font-weight: 400;
}

.breakthrough-growth__val-sep {
  color: #8a6420;
}

.breakthrough-growth__val-after {
  color: var(--paper-text, #302719);
  font-weight: 700;
}

.breakthrough-growth__val-delta {
  font-style: normal;
  font-weight: 700;
  color: var(--hk-jade-deep, #1f6b50);
}

.breakthrough-growth__reward {
  margin-top: 0.8cqh;
  padding: 0.6cqh 1.6cqw 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid rgba(161, 132, 72, 0.45);
  font-family: var(--font-body);
  font-size: min(2.4cqh, 14px);
  color: #5a3811;
}

.breakthrough-growth__reward strong {
  font-weight: 700;
  color: #6b3f08;
}

.breakthrough-growth__reward small {
  font-size: min(2.2cqh, 13px);
  color: #675637;
}
</style>
