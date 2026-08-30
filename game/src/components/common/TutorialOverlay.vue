<script setup lang="ts">
import { ref, computed } from 'vue'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { usePlayerStore } from '@/stores/player'
import { TUTORIAL_STEPS } from '@/data/tutorial/tutorialSteps'

const player = usePlayerStore()

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
  <div v-if="!player.hasSeenTutorial" class="tutorial-overlay">
    <div class="tutorial-overlay__panel">
      <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
      <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

      <p class="tutorial-overlay__progress">{{ currentIndex + 1 }} / {{ TUTORIAL_STEPS.length }}</p>

      <h3 class="tutorial-overlay__title">{{ currentStep.title }}</h3>

      <p class="tutorial-overlay__body">{{ currentStep.body }}</p>

      <div class="tutorial-overlay__actions">
        <GameButton variant="ghost" @click="finish">Bỏ Qua</GameButton>

        <GameButton variant="primary" @click="next">
          {{ isLastStep ? 'Bắt Đầu' : 'Tiếp Theo' }}
        </GameButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tutorial-overlay {
  position: absolute;
  inset: 0;
  z-index: 1900;
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

.tutorial-overlay__panel > :not(.ink-nine-slice) {
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
