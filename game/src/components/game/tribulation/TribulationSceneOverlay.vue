<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const active = computed(() => { stateVersion.value; return gameManager.tribulationDirector.getState() })
const hp = computed(() => active.value?.hp ?? 0)
const maxHp = computed(() => active.value?.maxHp ?? 1)
const chapterProgress = computed(() => `${(active.value?.chapterIndex ?? 0) + 1} / ${active.value?.chaptersTotal ?? 1}`)
const questionSeconds = computed(() => Math.ceil(active.value?.questionSecondsRemaining ?? 0))
const isMindChapter = computed(() => active.value?.currentQuestion != null)
const isFinished = computed(() => active.value?.state === 'victory' || active.value?.state === 'defeat')
const resultTitle = computed(() =>
  t(active.value?.state === 'victory' ? 'tribulation.overlay.resultVictory' : 'tribulation.overlay.resultDefeat'),
)
const resultText = computed(() =>
  t(
    active.value?.state === 'victory'
      ? 'tribulation.overlay.resultVictoryText'
      : 'tribulation.overlay.resultDefeatText',
  ),
)

function answer(index: number) {
  gameManager.tribulationDirector.answerQuestion(index)
}

// Scene 14 spec: sequential chapter pips (dao-luan-node), plaque title
// band, circular timer ring on the mind question.
const nodeUrl = hkChromeUrl('dao-luan-node')
const plaqueUrl = hkChromeUrl('scroll-title-plaque')
const timerRingUrl = hkChromeUrl('timer-ring')
</script>

<template>
  <div v-if="active" class="tribulation-ui">
    <!-- Sequential chapter tracker (spec 14): Tam Ma -> Than Kiep -> Loi
         Kiep pips, current pip lit. Names come from the run profile. -->
    <ol class="tribulation-ui__tracker" :aria-label="t('tribulation.overlay.chapter', { progress: chapterProgress })">
      <li
        v-for="(name, index) in active.chapterNames"
        :key="index"
        class="tribulation-ui__tracker-pip"
        :class="{ 'is-done': index < active.chapterIndex, 'is-current': index === active.chapterIndex }"
      >
        <img v-if="nodeUrl" :src="nodeUrl" alt="" aria-hidden="true" />
        <span>{{ name }}</span>
      </li>
    </ol>

    <!-- Status card hugs the LEFT edge (spec 14): current chapter +
         progress; the tank phase folds its strikes/hint into the same
         card so the left rail is always the status surface. -->
    <div class="tribulation-ui__status">
      <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
      <div class="tribulation-ui__header">
        <img v-if="plaqueUrl" class="tribulation-ui__plaque" :src="plaqueUrl" alt="" aria-hidden="true" />
        <div class="tribulation-ui__chapter">{{ active.chapterName }}</div>
        <div class="tribulation-ui__progress">{{ t('tribulation.overlay.chapter', { progress: chapterProgress }) }}</div>
      </div>
      <div v-if="!isMindChapter && !isFinished" class="tribulation-ui__tank">
        <div class="tribulation-ui__strikes">{{ t('tribulation.overlay.strikesTaken', { count: active.lightningStrikesTaken }) }}</div>
        <div class="tribulation-ui__hint">{{ t('tribulation.overlay.tankHint') }}</div>
      </div>
    </div>

    <div class="tribulation-ui__hp-cluster">
      <div class="tribulation-ui__hp-frame">
        <InkNineSlice chrome-id="entity-bar" layer="frame" />
        <Bar class="tribulation-ui__hp-track" :value="hp" :max="maxHp" :height="14" />
      </div>
      <div class="tribulation-ui__hp">{{ t('tribulation.overlay.hp', { hp: formatNumber(Math.ceil(hp)), max: formatNumber(maxHp) }) }}</div>
    </div>

    <!-- Mind-question card hugs the RIGHT edge (spec 14). -->
    <div v-if="isMindChapter" class="tribulation-ui__mind">
      <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
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
      <div class="tribulation-ui__timer-wrap">
        <img v-if="timerRingUrl" class="tribulation-ui__timer-ring" :src="timerRingUrl" alt="" aria-hidden="true" />
        <div class="tribulation-ui__timer">{{ t('tribulation.overlay.seconds', { count: questionSeconds }) }}</div>
      </div>
      <Bar class="tribulation-ui__time-track" :value="active.questionSecondsRemaining" :max="Math.max(1, active.questionSecondsLimit)" :height="6" anchor="right" />
    </div>

    <div v-if="isFinished" class="tribulation-ui__result">
      <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
      <div class="tribulation-ui__result-title">{{ resultTitle }}</div>
      <div class="tribulation-ui__result-text">{{ resultText }}</div>
    </div>
  </div>
</template>

<style scoped>
/* Neo theo tỉ lệ viewport khớp TribulationScene.ts: title scene ở 0.17h,
   player ở 0.62h — DOM dùng calc(% + px) thay hằng số px cứng. */
.tribulation-ui { position:absolute; inset:0; z-index:15; pointer-events:none; color:var(--scene-tribulation-text); text-align:center; }
/* Sequential chapter tracker (spec 14 chapter-tracker region). */
.tribulation-ui__tracker { position:absolute; top:calc(6.5% + 0px); left:50%; transform:translateX(-50%); display:flex; gap:18px; margin:0; padding:0; list-style:none; }
.tribulation-ui__tracker-pip { position:relative; display:grid; place-items:center; min-width:64px; padding:4px 10px; font-family:var(--font-display); font-size:var(--text-xs); letter-spacing:.12em; color:var(--scene-tribulation-text-soft); opacity:.55; }
.tribulation-ui__tracker-pip img { position:absolute; inset:-6px; width:calc(100% + 12px); height:calc(100% + 12px); object-fit:fill; opacity:.5; pointer-events:none; }
.tribulation-ui__tracker-pip span { position:relative; }
.tribulation-ui__tracker-pip.is-done { opacity:.8; color:var(--scene-tribulation-text); }
.tribulation-ui__tracker-pip.is-current { opacity:1; color:var(--chrome-100); text-shadow:0 0 10px var(--scene-tribulation-glow); }
.tribulation-ui__tracker-pip.is-current img { opacity:1; filter:drop-shadow(0 0 8px var(--scene-tribulation-glow)); }
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
.tribulation-ui__hp-cluster { position:absolute; top:calc(62% + 84px); left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; width:min(340px, 80vw); }
/* entity-bar art frames the canonical HP fill (spec 14 hp-cluster). */
.tribulation-ui__hp-frame { position:relative; width:100%; padding:2px 4px; }
.tribulation-ui__hp-track { width:100%; border-radius:4px; --bar-track: var(--scene-tribulation-deep); --bar-from: var(--scene-tribulation-hp); --bar-to: var(--scene-tribulation-hp); }
.tribulation-ui__hp, .tribulation-ui__hint, .tribulation-ui__strikes { margin-top:6px; font-size:var(--text-xs); text-shadow:0 1px 3px #000; }
.tribulation-ui__hint, .tribulation-ui__strikes { color:var(--scene-tribulation-text-soft); }
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
.tribulation-ui__result { position:absolute; top:40%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; gap:8px; isolation:isolate; padding:26px 40px; border-radius:var(--radius-md); }
.tribulation-ui__result > :not(.ink-nine-slice) { position:relative; z-index:2; }
.tribulation-ui__result-title { font-family:var(--font-display); font-size:var(--text-display-lg); font-weight:800; text-shadow:0 0 18px var(--scene-tribulation-glow); }
.tribulation-ui__result-text { font-size:var(--text-sm); color:var(--scene-tribulation-text-soft); }
.tribulation-ui :deep(.bar__fill) { transition:width .15s linear; }
</style>
