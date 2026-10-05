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
import { onMounted, ref, useId } from 'vue'
import GameButton from './GameButton.vue'
import StatRow from './primitives/StatRow.vue'
import PcPaperChrome from './PcPaperChrome.vue'
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

const panelRef = ref<HTMLElement | null>(null)

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

useDialogFocus(panelRef, ref(true), { onEscape: onContinue })

const titleId = useId()
</script>

<template>
  <div class="offline-summary" :style="{ zIndex: OVERLAY_LAYERS.modal }">
    <section
      ref="panelRef"
      class="offline-summary__panel paper-on-dark"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >

      <PcPaperChrome />


      <h3 :id="titleId" class="offline-summary__title">{{ t('combat.offline.title') }}</h3>

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

      <GameButton class="offline-summary__continue" :sound="false" @click="onContinue">{{ t('combat.offline.continue') }}</GameButton>
    </section>
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

/* M-tier InkNineSlice (surface-m-paper + frame-m-seal-corner) thay
   cho GamePanel ornate (frame-xl-ceremony, slice 80px) - khung XL ve
   de len noi dung o card nho 320px vi bang khung 80px moi ben khong
   con cho cho padding hop ly. thickness="18" (thay vi slice goc 32px)
   thu nho muc ve lai - 32px nguyen ban qua day voi card 320-420px,
   nuot gan het canh thanh 1 dai den. Padding noi them de chu lui han
   vao trong, khong con sat vien muc. */
.offline-summary__panel {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: min(320px, 92vw);
  padding: 44px 40px;
  color: var(--paper-text, #211f1a);
  font-family: var(--font-body);
}

.offline-summary__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.offline-summary__title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  letter-spacing: 0.06em;
  color: var(--paper-text, #211f1a);
  text-align: center;
}

.offline-summary__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--font-body);
  font-size: var(--text-body);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.offline-summary__rows .stat-row__value {
  font-weight: 600;
}

.offline-summary__continue {
  margin-top: 10px;
}
</style>
