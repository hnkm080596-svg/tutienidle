<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import GameButton from '@/components/common/GameButton.vue'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type {
  VictoryGrowthCardView,
  VictorySlotView,
} from '@/components/scenes/victory/victorySceneModel'
import CeremonyTitle from './CeremonyTitle.vue'
import CeremonyRewardLedger from './CeremonyRewardLedger.vue'
import { useResultCeremonyPlayback } from './useResultCeremonyPlayback'

const props = defineProps<{
  outcome: 'victory' | 'defeat'
  stageName: string | null
  slots: VictorySlotView[]
  growth: VictoryGrowthCardView[]
  fast: boolean
}>()
const { t } = useI18n()
const { elapsed, pace, complete, finish } = useResultCeremonyPlayback(() => props.fast)
const card = useTemplateRef<HTMLElement>('card')
useDialogFocus(card, true, { onEscape: finish })

function revealBeforeAction(event: MouseEvent) {
  if (complete.value) return
  event.preventDefault()
  event.stopPropagation()
  finish()
}
</script>

<template>
  <section
    ref="card"
    class="result-ceremony"
    :class="[`result-ceremony--${outcome}`, { 'is-complete': complete }]"
    :style="{ '--ceremony-pace': pace }"
    role="dialog"
    aria-modal="true"
    :aria-label="t(`combat.${outcome}.title`)"
    tabindex="-1"
    :data-outcome="outcome"
    :data-complete="complete"
    @click.capture="revealBeforeAction"
  >
    <header class="result-ceremony__hero">
      <CeremonyTitle :outcome="outcome" />
      <p class="result-ceremony__stage">{{ stageName ?? t(`combat.${outcome}.subtitle`) }}</p>
      <p class="result-ceremony__flavor">
        {{ t(outcome === 'victory' ? 'combat.victory.flavor' : 'combat.defeat.subtitle') }}
      </p>
    </header>

    <div class="result-ceremony__paper">
      <InkNineSlice chrome-id="imperial-scroll-body" layer="surface" />
      <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />
      <div class="result-ceremony__paper-content">
        <CeremonyRewardLedger
          :slots="slots"
          :growth="growth"
          :elapsed="elapsed"
          :outcome="outcome"
        />
      </div>
    </div>

    <footer class="result-ceremony__footer">
      <div class="result-ceremony__actions"><slot name="actions" /></div>
      <GameButton class="result-ceremony__skip" variant="ghost" size="sm" @click="finish">
        {{ t(complete ? 'combat.ceremony.settled' : 'combat.ceremony.skip') }}
      </GameButton>
    </footer>
  </section>
</template>

<style scoped>
.result-ceremony {
  --ceremony-accent: #d6b56c;
  --ceremony-glow: #bf902a24;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(720px, 100%);
  max-height: 100%;
  min-height: 0;
  outline: none;
}
.result-ceremony--defeat {
  --ceremony-accent: #bd5a48;
  --ceremony-glow: #b7372626;
}
.result-ceremony__hero {
  flex: 0 0 auto;
  width: 100%;
  text-align: center;
}
.result-ceremony__stage {
  margin: 14px 0 0;
  color: #e3d6b8;
  font: 600 clamp(16px, 2vw, 21px) var(--font-display, serif);
  letter-spacing: 0.08em;
  animation: layer-in calc(450ms * var(--ceremony-pace)) calc(500ms * var(--ceremony-pace)) both;
}
.result-ceremony__flavor {
  margin: 8px 12px 0;
  color: #b9ad92;
  font-size: 13px;
  animation: layer-in calc(450ms * var(--ceremony-pace)) calc(650ms * var(--ceremony-pace)) both;
}
.result-ceremony__paper {
  background: #f2e8d0;
  border-radius: 3px;
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transform-origin: center top;
  animation: paper-open calc(650ms * var(--ceremony-pace)) calc(600ms * var(--ceremony-pace)) both;
}
.result-ceremony__paper > .ink-nine-slice {
  pointer-events: none;
}
.result-ceremony__paper-content {
  position: relative;
  z-index: 1;
  padding: 30px 40px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.result-ceremony__footer {
  flex: 0 0 auto;
  width: 100%;
  text-align: center;
  animation: layer-in calc(400ms * var(--ceremony-pace)) calc(1300ms * var(--ceremony-pace)) both;
}
.result-ceremony__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
.result-ceremony__actions :deep(button) {
  min-width: 180px;
  min-height: 46px;
}
.result-ceremony__skip {
  margin-top: 10px;
  color: #c3b595;
  min-height: 28px;
  font-size: 12px;
}
.is-complete :deep(*) {
  animation: none !important;
}
.is-complete :deep(.ceremony-title__art) {
  mask-position: 0 0;
}
@keyframes layer-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes paper-open {
  from {
    opacity: 0;
    clip-path: inset(0 0 100% 0);
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    clip-path: inset(0);
    transform: none;
  }
}
@media (max-height: 650px) {
  .result-ceremony {
    gap: 8px;
  }
  .result-ceremony__paper-content {
    padding: 22px 28px;
    gap: 8px;
  }
  .result-ceremony__flavor {
    display: none;
  }
  .result-ceremony__stage {
    margin-top: 7px;
  }
}
@media (max-width: 540px) {
  .result-ceremony__paper-content {
    padding: 24px;
  }
  .result-ceremony__actions :deep(button) {
    min-width: 140px;
    flex: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .result-ceremony :deep(*) {
    animation: none !important;
  }
  .result-ceremony :deep(.ceremony-title__art) {
    mask-position: 0 0;
  }
}
</style>
