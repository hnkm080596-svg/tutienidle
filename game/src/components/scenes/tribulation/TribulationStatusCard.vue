<script setup lang="ts">
// Scene 13 status-card region (spec: 60/560/420/220, shell-panel,
// surface-m-panel + timer-ring). Audit CORRECTED: real fields are the
// chapter timer (`secondsRemaining`) and `lightningStrikesTaken` —
// ref's "Độ Tâm Ma %" / attempt counters were invented, not rebuilt.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const props = defineProps<{
  chapterName: string
  chapterProgress: string
  secondsRemaining: number
  strikesTaken: number
  showTank: boolean
}>()
const { t } = useI18n()
const plaqueUrl = hkChromeUrl('scroll-title-plaque')

const timerLabel = computed(() => {
  const total = Math.max(0, Math.ceil(props.secondsRemaining))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <div class="tribulation-ui__status" data-hk-region="status-card">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <div class="tribulation-ui__header">
      <img v-if="plaqueUrl" class="tribulation-ui__plaque" :src="plaqueUrl" alt="" aria-hidden="true" />
      <div class="tribulation-ui__chapter">{{ chapterName }}</div>
      <div class="tribulation-ui__progress">{{ t('tribulation.overlay.chapter', { progress: chapterProgress }) }}</div>
    </div>

    <div v-if="secondsRemaining > 0" class="tribulation-ui__time-left">{{ t('tribulation.overlay.timeLeft') }} <b>{{ timerLabel }}</b></div>

    <div v-if="showTank" class="tribulation-ui__tank">
      <div class="tribulation-ui__strikes">{{ t('tribulation.overlay.strikesTaken', { count: strikesTaken }) }}</div>
      <div class="tribulation-ui__strike-pips" aria-hidden="true">
        <i
          v-for="n in Math.max(strikesTaken, 3)"
          :key="n"
          class="tribulation-ui__strike-pip art-needed"
          :class="{ 'is-lit': n <= strikesTaken }"
          :data-art-id="`tribulation-strike-pip`"
        />
      </div>
      <div class="tribulation-ui__hint">{{ t('tribulation.overlay.tankHint') }}</div>
    </div>
  </div>
</template>

<style scoped>
/* Spec 14 status-left: the chapter identity/status card anchors the left
   edge under the tracker; the tank phase's strikes/hint fold into it.
   surface-m-panel gives the card a real body so text can't escape the
   plaque's painted bounds. */
.tribulation-ui__status { position:absolute; top:calc(22% + 10px); left:4%; width:min(280px, 30vw); display:flex; flex-direction:column; gap:2px; text-align:center; isolation:isolate; padding:30px 16px 14px; border-radius:var(--radius-md); }
.tribulation-ui__status > :not(.ink-nine-slice) { position:relative; z-index:2; }
.tribulation-ui__header { position:relative; display:flex; flex-direction:column; gap:2px; align-items:center; }
.tribulation-ui__plaque { position:absolute; left:50%; top:-14px; transform:translateX(-50%); width:min(200px, 90%); height:auto; opacity:.9; pointer-events:none; }
.tribulation-ui__chapter { position:relative; font-family:var(--font-display); font-size:var(--text-display); font-weight:800; text-shadow:0 0 14px var(--scene-tribulation-glow); }
.tribulation-ui__progress { margin-top:30px; font-size:var(--text-xs); color:var(--scene-tribulation-text-soft); }
.tribulation-ui__time-left { margin-top:6px; font-size:var(--text-xs); color:var(--scene-tribulation-text-soft); }
.tribulation-ui__time-left b { font-variant-numeric:tabular-nums; color:var(--chrome-100); }
.tribulation-ui__hint, .tribulation-ui__strikes { margin-top:6px; font-size:var(--text-xs); text-shadow:0 1px 3px #000; color:var(--scene-tribulation-text-soft); }
.tribulation-ui__strike-pips { display:flex; justify-content:center; gap:5px; margin-top:6px; }
/* Ref: flame strike markers (temp art — lit = strike taken). */
.tribulation-ui__strike-pip {
  width: 10px;
  height: 14px;
  clip-path: polygon(50% 0%, 82% 28%, 100% 62%, 84% 100%, 16% 100%, 0% 62%, 18% 28%);
  background: #2a3234;
  border: 1px solid color-mix(in srgb, var(--hk-gold-muted, #b99a55) 40%, transparent);
}
.tribulation-ui__strike-pip.is-lit {
  background: radial-gradient(circle at 50% 70%, #ffd489, var(--hk-gold-muted, #b99a55) 60%, #6b4c1e);
  box-shadow: 0 0 6px color-mix(in srgb, #ffd489 70%, transparent);
}
</style>
