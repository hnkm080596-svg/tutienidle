<script setup lang="ts">
// Beta Phase 4 (muc XIV tai lieu) - thay console.log('Offline:'...) cu
// trong App.vue's onMounted(). Chi hien Thoi gian + Tu vi - he thong
// offline hien tai (core/idle/OfflineProgressSystem.ts) CHI tich tu
// vi, khong co material/tai nguyen nao khac e hien them (mockup muc
// XIV co "+ Tai nguyen/+ Progress" nhung o la vi du minh hoa, khong
// phai data that ang co).
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { useI18n } from 'vue-i18n'
import { onMounted, ref, useId } from 'vue'
import { AudioManager } from '@/core/audio/AudioManager'
import GameButton from './GameButton.vue'
import StatRow from './primitives/StatRow.vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

// UI-005 (Task 3, 2026-09-07) - Offline summary la blocking dialog that:
// role="dialog" + aria-modal + focus trap/restore qua useDialogFocus
// (UI-015: nguoi choi phai chu ong Continue, background khong bam uoc).
const props = defineProps<{
  elapsedSeconds: number

  cultivation: number
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)

// W7: stinger on mount (the offline report IS the reward moment) +
// ui.confirm on the one-way Continue/Escape close.
const audio = AudioManager.getInstance()
onMounted(() => {
  audio.playCue('stinger.offline')
})

function onContinue() {
  audio.playCue('ui.confirm')
  audio.playCue('ui.modal.close')
  emit('close')
}

useDialogFocus(panelRef, ref(true), { onEscape: onContinue })

const titleId = useId()
</script>

<template>
  <div class="offline-summary" :style="{ zIndex: OVERLAY_LAYERS.modal }">
    <section
      ref="panelRef"
      class="offline-summary__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <InkNineSlice asset-id="surface-m-paper" layer="surface" />
      <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" :thickness="18" />

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
  /* z-index via OVERLAY_LAYERS.modal (inline style) — single source for
     the app-level overlay order; the curtain must cover this modal. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

/* M-tier InkNineSlice (surface-m-paper + frame-m-seal-corner) thay
   cho GamePanel ornate (frame-xl-ceremony, slice 80px) — khung XL vẽ
   đè lên nội dung ở card nhỏ 320px vì băng khung 80px mỗi bên không
   còn chỗ cho padding hợp lý. thickness="18" (thay vì slice gốc 32px)
   thu nhỏ mực vẽ lại — 32px nguyên bản quá dày với card 320-420px,
   nuốt gần hết cạnh thành 1 dải đen. Padding nới thêm để chữ lùi hẳn
   vào trong, không còn sát viền mực. */
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
