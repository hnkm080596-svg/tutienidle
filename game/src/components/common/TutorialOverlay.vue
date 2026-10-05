<script setup lang="ts">
import { ref, computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import PcPaperChrome from '@/components/common/PcPaperChrome.vue'
import { usePlayerStore } from '@/stores/player'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { TUTORIAL_STEPS } from '@/data/tutorial/tutorialSteps'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

// UI-005 (Task 3, 2026-09-07) - tutorial la modal blocking: role="dialog"
// + aria-modal + focus trap qua useDialogFocus (cung primitive ConfirmModal/
// OverlayPanel dang dung, khong tu dung overlay behavior rieng nua).
const player = usePlayerStore()
const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => !player.hasSeenTutorial)
// Escape = bo qua tutorial (cung action voi nut "Bo Qua" - behavior hop ly
// cho dialog huong dan, khong mat du lieu gi).
useDialogFocus(panelRef, isOpen, { onEscape: finish })

const titleId = useId()
const bodyId = useId()

const currentIndex = ref(0)

const currentStep = computed(() => TUTORIAL_STEPS[currentIndex.value]!)
const isLastStep = computed(() => currentIndex.value === TUTORIAL_STEPS.length - 1)

function finish() {
  player.hasSeenTutorial = true
}

function next() {
  if (isLastStep.value) {
    finish()

    return
  }

  currentIndex.value++
}
</script>

<template>
  <div v-if="!player.hasSeenTutorial" class="tutorial-overlay" :style="{ zIndex: OVERLAY_LAYERS.modal }">
    <div
      ref="panelRef"
      class="tutorial-overlay__panel paper-on-dark"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="bodyId"
    >
      <PcPaperChrome />

      <p class="tutorial-overlay__progress">{{ currentIndex + 1 }} / {{ TUTORIAL_STEPS.length }}</p>

      <h3 :id="titleId" class="tutorial-overlay__title">{{ t(currentStep.titleKey) }}</h3>

      <p :id="bodyId" class="tutorial-overlay__body">{{ t(currentStep.bodyKey) }}</p>

      <div class="tutorial-overlay__actions">
        <GameButton variant="ghost" @click="finish">{{ t('tutorial.skip') }}</GameButton>

        <GameButton variant="primary" @click="next">
          {{ isLastStep ? t('tutorial.start') : t('tutorial.next') }}
        </GameButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tutorial-overlay {
  position: absolute;
  inset: 0;
  /* z-index via OVERLAY_LAYERS.modal (inline style). */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

.tutorial-overlay__panel {
  position: relative;
  isolation: isolate;
  width: min(420px, 92vw);
  padding: 28px 32px;
  color: var(--paper-text);
  box-shadow: var(--shadow-panel);
  font-family: var(--font-body);
}

.tutorial-overlay__panel > :not(.pc-paper-chrome) {
  position: relative;
  z-index: 3;
}

.tutorial-overlay__progress {
  margin: 0 0 8px;
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  color: var(--paper-eyebrow);
  text-align: right;
}

.tutorial-overlay__title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--paper-text);
}

.tutorial-overlay__body {
  margin: 0 0 20px;
  font-size: var(--text-body);
  line-height: 1.55;
  color: var(--paper-text-soft);
}

.tutorial-overlay__actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
</style>
