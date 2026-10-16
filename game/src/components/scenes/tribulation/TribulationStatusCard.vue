<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameCard from '@/components/common/GameCard.vue'

const props = defineProps<{
  chapterName: string
  chapterProgress: string
  secondsRemaining: number
  strikesTaken: number
  showTank: boolean
}>()
const { t } = useI18n()

const timerLabel = computed(() => {
  const total = Math.max(0, Math.ceil(props.secondsRemaining))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <GameCard as="section" class="tribulation-ui__status" data-hk-region="status-card">
    <div class="tribulation-ui__header">
      <div class="tribulation-ui__chapter">{{ chapterName }}</div>
      <div class="tribulation-ui__progress">{{ t('tribulation.overlay.chapter', { progress: chapterProgress }) }}</div>
    </div>

    <div v-if="secondsRemaining > 0" class="tribulation-ui__stat-row tribulation-ui__time-left">
      <span>{{ t('tribulation.overlay.timeLeft') }}</span>
      <b>{{ timerLabel }}</b>
    </div>

    <div v-if="showTank" class="tribulation-ui__tank">
      <div class="tribulation-ui__stat-row tribulation-ui__strikes">
        <span>{{ t('tribulation.overlay.strikesTaken', { count: strikesTaken }) }}</span>
        <div class="tribulation-ui__strike-pips" aria-hidden="true">
          <i
            v-for="n in Math.max(strikesTaken, 3)"
            :key="n"
            class="tribulation-ui__strike-pip"
            :class="{ 'is-lit': n <= strikesTaken }"
          />
        </div>
      </div>
      <div class="tribulation-ui__hint">{{ t('tribulation.overlay.tankHint') }}</div>
    </div>
  </GameCard>
</template>

<style scoped>
.tribulation-ui__status {
  position: absolute;
  top: 136px;
  left: 28px;
  width: min(280px, 26vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  isolation: isolate;
  padding: 16px 20px;
}

.tribulation-ui__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(213, 183, 116, 0.22);
}

.tribulation-ui__chapter {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: #f4e7c8;
}

.tribulation-ui__progress {
  font-size: 12px;
  color: #d5b774;
  white-space: nowrap;
}

.tribulation-ui__stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: rgba(233, 220, 196, 0.85);
}

.tribulation-ui__time-left b {
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  color: #f7ecd0;
}

.tribulation-ui__tank {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tribulation-ui__strike-pips {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.tribulation-ui__strike-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(213, 183, 116, 0.35);
}

.tribulation-ui__strike-pip.is-lit {
  background: #ffd489;
  border-color: #fff2cf;
  box-shadow: 0 0 6px rgba(255, 212, 137, 0.75);
}

.tribulation-ui__hint {
  font-size: 12px;
  line-height: 1.4;
  color: rgba(213, 183, 116, 0.8);
}
</style>
