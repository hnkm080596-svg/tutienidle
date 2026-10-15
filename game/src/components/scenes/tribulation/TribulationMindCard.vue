<script setup lang="ts">
// Scene 13 mind-card region (spec: 1090/200/522/380, shell-panel,
// surface-m-panel + button-standard + timer-ring - all delivered).
// Question phase only; answer count is dynamic.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import CombatControlButton from '@/components/scenes/combat/CombatControlButton.vue'
import CombatArtSurface from '@/components/scenes/combat/CombatArtSurface.vue'

import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const props = defineProps<{
  question: string
  answers: readonly string[]
  secondsRemaining: number
  secondsLimit: number
}>()
const emit = defineEmits<{ answer: [index: number] }>()
const { t } = useI18n()
const timerRingUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/tribulation/countdown-v1.png')
const seconds = computed(() => Math.ceil(props.secondsRemaining))
</script>

<template>
  <CombatArtSurface family="tribulation" art="question-panel" class="tribulation-ui__mind" data-hk-region="mind-card">
    <p class="tribulation-ui__question">{{ question }}</p>
    <div class="tribulation-ui__answers">
      <CombatControlButton
        v-for="(answerText, index) in answers"
        :key="index"
        skin="answer"
        class="tribulation-ui__answer"
        @click="emit('answer', index)"
      >
        {{ answerText }}
      </CombatControlButton>
    </div>
    <div class="tribulation-ui__timer-wrap">
      <img v-if="timerRingUrl" class="tribulation-ui__timer-ring" :src="timerRingUrl" alt="" aria-hidden="true" />
      <div class="tribulation-ui__timer">{{ t('tribulation.overlay.seconds', { count: seconds }) }}</div>
    </div>
    <Bar class="tribulation-ui__time-track" :value="secondsRemaining" :max="Math.max(1, secondsLimit)" :height="6" anchor="right" />
  </CombatArtSurface>
</template>

<style scoped>
/* Spec 14 mind-card 1090/200/522/380: right-anchored at 21.25% top
   (right edge 3.59% off the canvas edge), 31.22vw wide, capped at
   40.38% tall. */
.tribulation-ui__mind { position:absolute; top:21.25%; right:3.59%; width:min(31.22vw, 522px); max-height:40.38%; overflow-y:auto; display:flex; flex-direction:column; gap:10px; pointer-events:auto; isolation:isolate; border-radius:var(--radius-md); padding:18px 20px; }
.tribulation-ui__mind > :not(.combat-art-surface__art) { position:relative; z-index:2; }
.tribulation-ui__question { margin:0; font-size:var(--text-lg); font-weight:700; color:var(--chrome-100); }
.tribulation-ui__answers { display:grid; grid-template-columns:1fr; gap:8px; }
.tribulation-ui__time-track { border:1px solid var(--scene-tribulation-line); border-radius:8px; --bar-track: var(--scene-tribulation-deep); --bar-from: var(--scene-tribulation-time); --bar-to: color-mix(in srgb, var(--scene-tribulation-line) 80%, white); }
.tribulation-ui__timer-wrap { position:relative; align-self:center; width:64px; height:64px; display:grid; place-items:center; }
.tribulation-ui__timer-ring { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; pointer-events:none; }
.tribulation-ui__timer { position:relative; font-size:var(--text-sm); font-weight:700; }
.tribulation-ui__mind.combat-art-surface { top: 178px; right: 30px; width: 465px; min-height: 335px; max-height: 430px; padding: 40px 52px 34px 34px; gap: 12px; box-sizing: border-box; border: 0; background: transparent; overflow-y: auto; }
.tribulation-ui__question { font-size: 18px; line-height: 1.4; color: #f0e5cc; }
.tribulation-ui__timer-wrap { width: 58px; height: 58px; }
.tribulation-ui__timer { font-size: 18px; color: #edf3f4; }
.tribulation-ui__time-track { height: 8px; }
</style>
