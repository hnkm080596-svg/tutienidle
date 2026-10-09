<script setup lang="ts">
import { ref, computed, useId, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateButton from '@/components/common/art/OrnateButton.vue'
import { usePlayerStore } from '@/stores/player'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { TUTORIAL_STEPS } from '@/data/tutorial/tutorialSteps'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

// UI-005 (Task 3, 2026-09-07) - tutorial la modal blocking: role="dialog"
// + aria-modal + focus trap qua useDialogFocus (cung primitive ConfirmModal/
// OverlayPanel dang dung, khong tu dung overlay behavior rieng nua).
const player = usePlayerStore()
const { t } = useI18n()

const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null
const isOpen = computed(() => !player.hasSeenTutorial)
// Escape = bo qua tutorial (cung action voi nut "Bo Qua" - behavior hop ly
// cho dialog huong dan, khong mat du lieu gi).
useDialogFocus(panelEl, isOpen, { onEscape: finish })

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
    <OrnateDialog
      ref="dialogRef"
      class="tutorial-overlay__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="bodyId"
      :title="t(currentStep.titleKey)"
      :title-id="titleId"
      badge="info"
      show-close
      :close-label="t('tutorial.skip')"
      @close="finish"
    >
      <p class="tutorial-overlay__progress">{{ currentIndex + 1 }} / {{ TUTORIAL_STEPS.length }}</p>
      <p :id="bodyId" class="tutorial-overlay__body">{{ t(currentStep.bodyKey) }}</p>

      <template #actions>
        <OrnateButton variant="dark" @click="finish">{{ t('tutorial.skip') }}</OrnateButton>
        <OrnateButton variant="gold" @click="next">
          {{ isLastStep ? t('tutorial.start') : t('tutorial.next') }}
        </OrnateButton>
      </template>
    </OrnateDialog>
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
  flex: none;
}

.tutorial-overlay__progress {
  flex: none;
  margin: 0.6cqh 0 0;
  font-size: min(2.4cqh, var(--text-xs));
  letter-spacing: 0.08em;
  color: var(--paper-eyebrow, #8f897c);
}

.tutorial-overlay__body {
  flex: none;
  margin: 1.6cqh 0 0;
  max-width: 100%;
  font-size: min(3.1cqh, var(--text-body));
  line-height: 1.55;
  color: var(--paper-text-soft, #5e5a50);
  text-align: center;
}
</style>
