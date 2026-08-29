<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const active = computed(() => { stateVersion.value; return gameManager.getActiveTribulation() })
const hp = computed(() => active.value?.hp ?? 0)
const maxHp = computed(() => active.value?.maxHp ?? 1)
const chapterProgress = computed(() => `${(active.value?.chapterIndex ?? 0) + 1} / ${active.value?.chaptersTotal ?? 1}`)
const questionSeconds = computed(() => Math.ceil(active.value?.questionSecondsRemaining ?? 0))
const isMindChapter = computed(() => active.value?.currentQuestion != null)
const isFinished = computed(() => active.value?.state === 'victory' || active.value?.state === 'defeat')
const resultTitle = computed(() => (active.value?.state === 'victory' ? 'VƯỢT KIẾP' : 'KIẾP THẤT BẠI'))
const resultText = computed(() =>
  active.value?.state === 'victory'
    ? 'Thiên kiếp tan biến — đạo tâm thêm vững.'
    : 'Thân hoại đạo tiêu — dưỡng thương rồi thử lại.',
)

function answer(index: number) {
  gameManager.answerTribulationQuestion(index)
}
</script>

<template>
  <div v-if="active" class="tribulation-ui">
    <div class="tribulation-ui__header">
      <div class="tribulation-ui__chapter">{{ active.chapterName }}</div>
      <div class="tribulation-ui__progress">Chương {{ chapterProgress }}</div>
    </div>

    <div class="tribulation-ui__hp-cluster">
      <Bar class="tribulation-ui__hp-track" :value="hp" :max="maxHp" :height="8" />
      <div class="tribulation-ui__hp">HP {{ formatNumber(Math.ceil(hp)) }} / {{ formatNumber(maxHp) }}</div>
    </div>

    <div v-if="!isMindChapter && !isFinished" class="tribulation-ui__tank">
      <div class="tribulation-ui__strikes">Lôi đã đỡ: {{ active.lightningStrikesTaken }}</div>
      <div class="tribulation-ui__hint">Trụ vững — lôi giáng xuống theo nhịp</div>
    </div>

    <div v-if="isMindChapter" class="tribulation-ui__mind">
      <p class="tribulation-ui__question">{{ active.currentQuestion!.question }}</p>
      <div class="tribulation-ui__answers">
        <GameButton
          v-for="(answerText, index) in active.currentQuestion!.answers"
          :key="index"
          size="sm"
          class="tribulation-ui__answer"
          @click="answer(index)"
        >
          {{ answerText }}
        </GameButton>
      </div>
      <Bar class="tribulation-ui__time-track" :value="active.questionSecondsRemaining" :max="Math.max(1, active.questionSecondsRemaining + 0.001)" :height="6" anchor="right" />
      <div class="tribulation-ui__timer">{{ questionSeconds }}s</div>
    </div>

    <div v-if="isFinished" class="tribulation-ui__result">
      <div class="tribulation-ui__result-title">{{ resultTitle }}</div>
      <div class="tribulation-ui__result-text">{{ resultText }}</div>
    </div>
  </div>
</template>

<style scoped>
/* Neo theo tỉ lệ viewport khớp TribulationScene.ts: title scene ở 0.17h,
   player ở 0.62h — DOM dùng calc(% + px) thay hằng số px cứng. */
.tribulation-ui { position:absolute; inset:0; z-index:15; pointer-events:none; color:var(--scene-tribulation-text); text-align:center; }
.tribulation-ui__header { position:absolute; top:calc(10% + 12px); left:50%; transform:translateX(-50%); display:flex; flex-direction:column; gap:2px; }
.tribulation-ui__chapter { font-family:var(--font-display); font-size:var(--text-display-md); font-weight:800; text-shadow:0 0 14px var(--scene-tribulation-glow); }
.tribulation-ui__progress { font-size:var(--text-xs); color:var(--scene-tribulation-text-soft); }
.tribulation-ui__hp-cluster { position:absolute; top:calc(62% + 84px); left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; width:min(340px, 80vw); }
.tribulation-ui__hp-track { width:100%; border:1px solid var(--scene-tribulation-line); border-radius:8px; --bar-track: var(--scene-tribulation-deep); --bar-from: var(--scene-tribulation-hp); --bar-to: var(--scene-tribulation-hp); }
.tribulation-ui__hp, .tribulation-ui__hint, .tribulation-ui__strikes { margin-top:6px; font-size:var(--text-xs); text-shadow:0 1px 3px #000; }
.tribulation-ui__hint, .tribulation-ui__strikes { color:var(--scene-tribulation-text-soft); }
.tribulation-ui__mind { position:absolute; top:16%; left:50%; transform:translateX(-50%); width:min(520px, 92vw); display:flex; flex-direction:column; gap:10px; pointer-events:auto; background:color-mix(in srgb, var(--ink-950) 72%, transparent); border:1px solid var(--scene-tribulation-line); border-radius:var(--radius-md); padding:16px 18px; }
.tribulation-ui__question { margin:0; font-size:var(--text-body-lg); font-weight:700; color:var(--chrome-100); }
.tribulation-ui__answers { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.tribulation-ui__time-track { border:1px solid var(--scene-tribulation-line); border-radius:8px; --bar-track: var(--scene-tribulation-deep); --bar-from: var(--scene-tribulation-time); --bar-to: color-mix(in srgb, var(--scene-tribulation-line) 80%, white); }
.tribulation-ui__timer { font-size:var(--text-sm); font-weight:700; }
.tribulation-ui__result { position:absolute; top:40%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; gap:8px; }
.tribulation-ui__result-title { font-family:var(--font-display); font-size:var(--text-display-lg); font-weight:800; text-shadow:0 0 18px var(--scene-tribulation-glow); }
.tribulation-ui__result-text { font-size:var(--text-sm); color:var(--scene-tribulation-text-soft); }
.tribulation-ui :deep(.bar__fill) { transition:width .15s linear; }
</style>
