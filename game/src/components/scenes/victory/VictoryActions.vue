<script setup lang="ts">
// Scene 14 region `actions` (design 526/690/620/80): "Thu Lai" (jade,
// retry glyph) + "Tiep Tuc" (gold ceremonial, double-chevron). Auto
// run-mode keeps the same contract the old panel had: continue hides,
// retry locks and shows the countdown until the auto-refight fires.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import type { BattleRunMode } from '@/stores/ui'

const props = defineProps<{
  runMode: BattleRunMode
  countdownLabel: string
}>()

const emit = defineEmits<{ retry: []; continue: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="victory-actions" data-hk-region="actions">
    <GameButton
      class="victory-actions__retry combat-victory-panel__retry"
      :class="{ 'is-disabled': props.runMode !== 'manual' }"
      :disabled="props.runMode !== 'manual'"
      variant="secondary"
      @click="emit('retry')"
    >
      <svg class="victory-actions__glyph art-needed" data-art-id="victory-action-retry" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M7 2a5 5 0 1 1-4.6 3.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <path d="M2.6 1.6v3.4h3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ t('combat.victory.retry') }}<template v-if="props.runMode !== 'manual'"> {{ props.countdownLabel }}</template>
    </GameButton>

    <GameButton
      v-if="props.runMode === 'manual'"
      class="victory-actions__continue combat-victory-panel__continue"
      size="lg"
      variant="primary"
      @click="emit('continue')"
    >
      <svg class="victory-actions__glyph art-needed" data-art-id="victory-action-continue" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3 3l4 4-4 4M8 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ t('combat.victory.continue') }}
    </GameButton>
  </div>
</template>

<style scoped>
.victory-actions {
  display: flex;
  justify-content: center;
  gap: 26px;
  margin-top: 14px;
}
.victory-actions :deep(button) {
  width: 230px;
  min-height: 50px;
}
.victory-actions__glyph {
  width: 14px;
  height: 14px;
  margin-right: 6px;
  vertical-align: -2px;
}
.victory-actions__retry {
  /* Jade treatment for the secondary retry action (ref shows a teal
     jade button vs the gold ceremonial continue). */
  --btn-accent: var(--hk-jade-soft, #67c4ab);
}
.victory-actions__retry.is-disabled {
  filter: grayscale(0.5) brightness(0.7);
}
</style>
