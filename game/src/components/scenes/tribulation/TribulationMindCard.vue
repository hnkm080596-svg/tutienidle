<script setup lang="ts">
// Scene 13 mind-card region (spec: 1090/200/522/380, shell-panel,
// surface-m-panel + button-standard + timer-ring — all delivered).
// Question phase only; answer count is dynamic.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{
  question: string
  answers: readonly string[]
  secondsRemaining: number
  secondsLimit: number
}>()
const emit = defineEmits<{ answer: [index: number] }>()
const { t } = useI18n()
const timerRingUrl = hkChromeUrl('timer-ring')
const seconds = computed(() => Math.ceil(props.secondsRemaining))
</script>

<template>
  <div class="tribulation-ui__mind" data-hk-region="mind-card">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <p class="tribulation-ui__question">{{ question }}</p>
    <div class="tribulation-ui__answers">
      <GameButton
        v-for="(answerText, index) in answers"
        :key="index"
        size="sm"
        class="tribulation-ui__answer"
        @click="emit('answer', index)"
      >
        {{ answerText }}
      </GameButton>
    </div>
    <div class="tribulation-ui__timer-wrap">
      <img v-if="timerRingUrl" class="tribulation-ui__timer-ring" :src="timerRingUrl" alt="" aria-hidden="true" />
      <div class="tribulation-ui__timer">{{ t('tribulation.overlay.seconds', { count: seconds }) }}</div>
    </div>
    <Bar class="tribulation-ui__time-track" :value="secondsRemaining" :max="Math.max(1, secondsLimit)" :height="6" anchor="right" />
  </div>
</template>

<style scoped>
/* Spec 14 question-right: the mind card hugs the right edge under the
   tracker. top:26% keeps it clear of the scene's THIEN KIEP title band
   (~17% height) - at 16% the card edge clipped the title mid-glyph
   (ui-audit progression fix). */
.tribulation-ui__mind { position:absolute; top:26%; right:4%; width:min(430px, 42vw); display:flex; flex-direction:column; gap:10px; pointer-events:auto; isolation:isolate; border-radius:var(--radius-md); padding:18px 20px; }
.tribulation-ui__mind > :not(.ink-nine-slice) { position:relative; z-index:2; }
.tribulation-ui__question { margin:0; font-size:var(--text-lg); font-weight:700; color:var(--chrome-100); }
.tribulation-ui__answers { display:grid; grid-template-columns:1fr; gap:8px; }
.tribulation-ui__time-track { border:1px solid var(--scene-tribulation-line); border-radius:8px; --bar-track: var(--scene-tribulation-deep); --bar-from: var(--scene-tribulation-time); --bar-to: color-mix(in srgb, var(--scene-tribulation-line) 80%, white); }
.tribulation-ui__timer-wrap { position:relative; align-self:center; width:64px; height:64px; display:grid; place-items:center; }
.tribulation-ui__timer-ring { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; pointer-events:none; }
.tribulation-ui__timer { position:relative; font-size:var(--text-sm); font-weight:700; }
</style>
