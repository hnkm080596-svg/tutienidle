<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import GameCard from '@/components/common/GameCard.vue'

const props = defineProps<{
  question: string
  answers: readonly string[]
  secondsRemaining: number
  secondsLimit: number
}>()
const emit = defineEmits<{ answer: [index: number] }>()
const { t } = useI18n()
const seconds = computed(() => Math.ceil(props.secondsRemaining))
const choiceLetters = ['A', 'B', 'C', 'D', 'E', 'F']
</script>

<template>
  <GameCard as="section" class="tribulation-ui__mind" data-hk-region="mind-card">
    <div class="tribulation-ui__mind-top">
      <p class="tribulation-ui__question">{{ question }}</p>
      <div class="tribulation-ui__timer-wrap">
        <span class="tribulation-ui__timer">{{ t('tribulation.overlay.seconds', { count: seconds }) }}</span>
      </div>
    </div>

    <div class="tribulation-ui__answers">
      <button
        v-for="(answerText, index) in answers"
        :key="index"
        type="button"
        class="tribulation-ui__answer"
        @click="emit('answer', index)"
      >
        <span class="tribulation-ui__answer-key">{{ choiceLetters[index] ?? index + 1 }}</span>
        <span class="tribulation-ui__answer-text">{{ answerText }}</span>
      </button>
    </div>

    <Bar
      class="tribulation-ui__time-track"
      :value="secondsRemaining"
      :max="Math.max(1, secondsLimit)"
      :height="6"
      anchor="right"
    />
  </GameCard>
</template>

<style scoped>
.tribulation-ui__mind {
  position: absolute;
  top: 136px;
  right: 28px;
  width: min(430px, 38vw);
  max-height: calc(100% - 240px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  pointer-events: auto;
  isolation: isolate;
  padding: 20px 22px;
  text-align: left;
}

.tribulation-ui__mind-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(213, 183, 116, 0.22);
}

.tribulation-ui__question {
  margin: 0;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  color: #f4e7c8;
}

.tribulation-ui__timer-wrap {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border-radius: 14px;
  background: rgba(213, 183, 116, 0.14);
  border: 1px solid rgba(213, 183, 116, 0.45);
}

.tribulation-ui__timer {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f7ecd0;
}

.tribulation-ui__answers {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.tribulation-ui__answer {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(24, 33, 36, 0.9), rgba(14, 20, 22, 0.95));
  border: 1px solid rgba(213, 183, 116, 0.32);
  color: #eee2c8;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.12s ease;
}

.tribulation-ui__answer:hover {
  border-color: rgba(235, 202, 130, 0.85);
  background: linear-gradient(180deg, rgba(38, 50, 52, 0.95), rgba(22, 30, 33, 0.98));
  color: #fff6dc;
  transform: translateY(-1px);
}

.tribulation-ui__answer:active {
  transform: translateY(0);
}

.tribulation-ui__answer-key {
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgba(213, 183, 116, 0.16);
  border: 1px solid rgba(213, 183, 116, 0.42);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  color: #f3e7bd;
}

.tribulation-ui__answer-text {
  flex: 1;
}

.tribulation-ui__time-track {
  border: 1px solid rgba(213, 183, 116, 0.3);
  border-radius: 6px;
  --bar-track: rgba(10, 14, 18, 0.85);
  --bar-from: #b99a55;
  --bar-to: #f0d58c;
}
</style>
