<script setup lang="ts">
import { ref, computed } from 'vue'
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
      <p class="tutorial-overlay__progress">{{ currentIndex + 1 }} / {{ TUTORIAL_STEPS.length }}</p>

      <h3 class="tutorial-overlay__title">{{ currentStep.title }}</h3>

      <p class="tutorial-overlay__body">{{ currentStep.body }}</p>

      <div class="tutorial-overlay__actions">
        <button type="button" class="tutorial-overlay__skip" @click="finish">Bỏ Qua</button>

        <button type="button" class="tutorial-overlay__next" @click="next">
          {{ isLastStep ? 'Bắt Đầu' : 'Tiếp Theo' }}
        </button>
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
  background: rgba(10, 10, 13, 0.72);
}

.tutorial-overlay__panel {
  width: 420px;
  padding: 24px 28px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
}

.tutorial-overlay__progress {
  margin: 0 0 8px;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  text-align: right;
}

.tutorial-overlay__title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--gold-500);
}

.tutorial-overlay__body {
  margin: 0 0 20px;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--text-primary);
}

.tutorial-overlay__actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.tutorial-overlay__actions button {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  font-family: var(--font-body);
}

.tutorial-overlay__skip {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
}

.tutorial-overlay__skip:hover {
  color: var(--text-primary);
  border-color: var(--ink-line);
}

.tutorial-overlay__next {
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  font-weight: 700;
}
</style>
