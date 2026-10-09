<script setup lang="ts">
// Beta Phase 4 (muc XIV tai lieu) - thay console.log('Offline:'...) cu
// trong App.vue's onMounted(). Chi hien Thoi gian + Tu vi - he thong
// offline hien tai (core/idle/OfflineProgressSystem.ts) CHI tich tu
// vi, khong co material/tai nguyen nao khac de hien them (mockup muc
// XIV co "+ Tai nguyen/+ Progress" nhung do la vi du minh hoa, khong
// phai data that dang co).
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { useI18n } from 'vue-i18n'
import { onMounted, ref, useId, type ComponentPublicInstance } from 'vue'
import OrnateDialog from './art/OrnateDialog.vue'
import OrnateButton from './art/OrnateButton.vue'
import StatRow from './primitives/StatRow.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'

// UI-005 (Task 3, 2026-09-07) - Offline summary la blocking dialog that:
// role="dialog" + aria-modal + focus trap/restore qua useDialogFocus
// (UI-015: nguoi choi phai chu dong Continue, background khong bam duoc).
const props = defineProps<{
  elapsedSeconds: number

  cultivation: number
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null

// W7: stinger on mount (the offline report IS the reward moment) +
// ui.confirm on the one-way Continue/Escape close.
onMounted(() => {
  useAudioStore().cue('stinger.offline')
})

function onContinue() {
  useAudioStore().cue('ui.confirm')
  useAudioStore().cue('ui.modal.close')
  emit('close')
}

useDialogFocus(panelEl, ref(true), { onEscape: onContinue })

const titleId = useId()
</script>

<template>
  <div class="offline-summary" :style="{ zIndex: OVERLAY_LAYERS.modal }">
    <OrnateDialog
      ref="dialogRef"
      class="offline-summary__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :title="t('combat.offline.title')"
      :title-id="titleId"
      badge="info"
      show-close
      :close-label="t('combat.offline.continue')"
      width="min(500px, 94vw)"
      @close="onContinue"
    >
      <ul class="offline-summary__rows">
        <StatRow :label="t('combat.offline.labels.duration')">{{ formatDuration(props.elapsedSeconds) }}</StatRow>

        <!-- Chi Thoi gian + Tu vi - core/idle/OfflineProgressSystem.ts
             CHI tinh cultivationPerSecond * elapsedSeconds, khong co
             nguon thu offline nao khac trong game logic hien tai. Mo
             rong OfflineSummaryData (stores/offlineSummary.ts) + them
             row tuong ung neu sau nay OfflineProgressSystem co nguon
             thu moi. -->
        <StatRow :label="t('combat.offline.labels.cultivation')" tone="positive">{{ formatNumber(Math.floor(props.cultivation)) }}</StatRow>
      </ul>

      <template #actions>
        <OrnateButton class="offline-summary__continue" variant="gold" :sound="false" @click="onContinue">{{ t('combat.offline.continue') }}</OrnateButton>
      </template>
    </OrnateDialog>
  </div>
</template>

<style scoped>
.offline-summary {
  position: absolute;
  inset: 0;
  /* z-index via OVERLAY_LAYERS.modal (inline style) - single source for
     the app-level overlay order; the curtain must cover this modal. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.offline-summary__panel {
  flex: none;
}

.offline-summary__rows {
  /* StatRow renders --hk-text-* (light) labels/values by default; on
     paper the tokens remap to the dark paper family so the rows stay
     readable. --hk-jade-deep keeps the positive accent legible too. */
  --hk-text-primary: var(--paper-text, #302719);
  --hk-text-secondary: var(--paper-text-soft, #5e5a50);
  --hk-text-muted: var(--paper-text-muted, #8f897c);
  --hk-jade: var(--hk-jade-deep);
  list-style: none;
  margin: 4cqh 0 0;
  padding: 0;
  width: 100%;
  font-family: var(--font-body);
  font-size: min(3cqh, var(--text-body));
  display: flex;
  flex-direction: column;
  gap: 1.6cqh;
}

.offline-summary__rows .stat-row__value {
  font-weight: 600;
}
</style>
