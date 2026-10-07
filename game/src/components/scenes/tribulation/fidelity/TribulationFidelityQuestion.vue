<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import TribulationFidelityFrame from './TribulationFidelityFrame.vue'
import type { TribulationAnswerDisplay } from './tribulationUi'
import CombatFidelityMeter from '@/components/scenes/combat/fidelity/CombatFidelityMeter.vue'
defineProps<{ question: string; answers: readonly TribulationAnswerDisplay[]; selected: string | null; seconds: string; percent: number; notice: string }>()
const emit = defineEmits<{ answer: [id: string] }>()
const { t } = useI18n()
const answerArt = {
  normal: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/tribulation/answer-normal-v1.png'),
  hover: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/tribulation/answer-hover-v1.png'),
  selected: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/tribulation/answer-selected-v1.png'),
  pressed: resolveAssetUrl('/assets/ui/tien-hiep-2026-10/tribulation/answer-pressed-v1.png'),
}
const timeTube = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/tribulation/time-tube-v1.png')
</script>
<template><TribulationFidelityFrame class="question-card" skin="question" :style="{ '--time-tube': `url('${timeTube}')` }"><p class="question-eyebrow">{{ t('mindTrial') }}</p><h2 class="question-text">{{ question }}</h2><div class="answers"><button v-for="(answer, i) in answers" :key="answer.id" :class="{ chosen: answer.id === selected }" :aria-pressed="answer.id === selected" :style="{ '--answer-normal': `url('${answerArt.normal}')`, '--answer-hover': `url('${answerArt.hover}')`, '--answer-selected': `url('${answerArt.selected}')`, '--answer-pressed': `url('${answerArt.pressed}')` }" @click="emit('answer', answer.id)"><span class="answer-seal">{{ String.fromCharCode(65 + i) }}</span><span>{{ answer.label }}</span></button></div><div class="question-time"><span>{{ t('answerTime') }}</span><strong>{{ seconds }}</strong></div><CombatFidelityMeter :label="t('answerTime')" :value="seconds" :percent="percent" tone="ward" /><p class="question-notice" role="status">{{ notice }}</p></TribulationFidelityFrame></template>
<style scoped>
.question-card { position:absolute; right:31px; top:225px; width:321px; height:408px; padding:38px 30px 24px; pointer-events:auto; }.question-eyebrow { margin:0 0 10px; font-size:12px; letter-spacing:2px; color:#bba273; }.question-text { margin:0 0 20px; height:80px; overflow:auto; font-size:20px; line-height:1.5; font-weight:500; color:#f7e8c7; }.answers { display:flex; flex-direction:column; gap:10px; max-height:185px; overflow:auto; padding:3px; scrollbar-width:none; }.answers button { display:flex; align-items:center; gap:6px; flex:none; width:100%; min-height:44px; padding:4px 14px 4px 6px; border:0; background:var(--answer-normal) center/100% 100% no-repeat; color:#4a3413; text-align:left; font:600 12px/1.3 var(--font-display,Georgia,serif); cursor:pointer; }.answer-seal { flex:none; display:grid; place-items:center; width:34px; font-size:13px; font-weight:700; color:#5c3f14; }.answers button.chosen { background-image:var(--answer-selected); color:#7a2000; box-shadow:0 0 9px #bd944744; }.chosen .answer-seal { color:#7a2000; }.answers button:hover,.answers button:focus-visible { background-image:var(--answer-hover); outline:none; color:#5c3410; }.answers button:active { background-image:var(--answer-pressed); }.question-time { margin:14px 0 6px; display:flex; justify-content:space-between; font-size:12px; color:#cbb88b; }.question-time strong { color:#f2d890; }.question-notice { margin:8px 0 0; height:30px; font-size:10px; line-height:1.5; color:#d7c59b; }
.question-card { height:480px; }.question-text { height:96px; font-size:18px; line-height:1.5; }.answer-seal { transform:none; border-radius:50%; }.question-card :deep(.meter) { height:26px; border:0; box-shadow:none; transform:none; background:var(--time-tube) center/100% 100% no-repeat; overflow:visible; }.question-card :deep(.meter .fill) { top:5px; bottom:5px; border-top:0; }
</style>
