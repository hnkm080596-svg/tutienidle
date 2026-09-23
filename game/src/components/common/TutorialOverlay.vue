<script setup lang="ts">
import { ref, computed, useId } from 'vue'
import GameButton from '@/components/common/GameButton.vue'
import SysModalBase from '@/components/common/system/SysModalBase.vue'
import { usePlayerStore } from '@/stores/player'
import { TUTORIAL_STEPS } from '@/data/tutorial/tutorialSteps'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

// UI-005 (Task 3, 2026-09-07) — tutorial là modal blocking: role="dialog"
// + aria-modal + focus trap (SysModalBase owns all three now).
// Escape = bỏ qua tutorial (cùng action với nút "Bỏ Qua" — behavior hợp lý
// cho dialog hướng dẫn, không mất dữ liệu gì).
// M-UI-OVERHAUL: system console + segmented progress rail (spec 2.4).
const player = usePlayerStore()

const isOpen = computed(() => !player.hasSeenTutorial)

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
  <SysModalBase
    :open="isOpen"
    :title="currentStep.title"
    width="min(420px, 92vw)"
    :layer="OVERLAY_LAYERS.modal"
    :described-by="bodyId"
    :close-on-scrim="false"
    card-class="tutorial-overlay"
    @close="finish"
  >
    <div class="tutorial-overlay__rail">
      <!-- Segmented rail = the step indicator; the count stays as the
           accessible text (never a hue-only signal). -->
      <div class="sys-seg" aria-hidden="true">
        <span
          v-for="(step, i) in TUTORIAL_STEPS"
          :key="step.title"
          class="sys-seg__cell"
          :class="{ 'is-on': i <= currentIndex }"
        />
      </div>
      <p class="tutorial-overlay__progress">{{ currentIndex + 1 }} / {{ TUTORIAL_STEPS.length }}</p>
    </div>

    <p :id="bodyId" class="tutorial-overlay__body">{{ currentStep.body }}</p>

    <div class="tutorial-overlay__actions">
      <GameButton variant="system" accent-var="var(--sys-text-dim)" @click="finish">Bỏ Qua</GameButton>

      <GameButton variant="system" @click="next">
        {{ isLastStep ? 'Bắt Đầu' : 'Tiếp Theo' }}
      </GameButton>
    </div>
  </SysModalBase>
</template>

<style scoped>
.tutorial-overlay__rail {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.tutorial-overlay__rail .sys-seg {
  flex: 1;
}

.tutorial-overlay__progress {
  margin: 0;
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
  color: var(--sys-text-muted, var(--paper-eyebrow));
}

.tutorial-overlay__body {
  margin: 0 0 20px;
  font-size: var(--text-body);
  line-height: 1.55;
  color: var(--sys-text-muted, var(--paper-text-soft));
}

.tutorial-overlay__actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
</style>
