<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import TribulationChapterTracker from '@/components/scenes/tribulation/TribulationChapterTracker.vue'
import TribulationStatusCard from '@/components/scenes/tribulation/TribulationStatusCard.vue'
import TribulationRealmCard from '@/components/scenes/tribulation/TribulationRealmCard.vue'
import TribulationHpCluster from '@/components/scenes/tribulation/TribulationHpCluster.vue'
import TribulationMindCard from '@/components/scenes/tribulation/TribulationMindCard.vue'
import TribulationResultBanner from '@/components/scenes/tribulation/TribulationResultBanner.vue'
import { pcPaperControlStyles } from '@/presentation/assets/PcPaperControls'
import '@/assets/tien-hiep-outcomes.css'

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const active = computed(() => { stateVersion.value; return gameManager.tribulationDirector.getState() })
const hp = computed(() => active.value?.hp ?? 0)
const maxHp = computed(() => active.value?.maxHp ?? 1)
const chapterProgress = computed(() => `${(active.value?.chapterIndex ?? 0) + 1} / ${active.value?.chaptersTotal ?? 1}`)
const isMindChapter = computed(() => active.value?.currentQuestion != null)
const isFinished = computed(() => active.value?.state === 'victory' || active.value?.state === 'defeat')
const realmName = computed(() => {
  const id = active.value?.targetRealmId
  if (!id) return ''
  try { return getCurrentRealm(id).name } catch { return id }
})
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
</script>

<template>
  <div v-if="active" class="tribulation-ui pc-outcome-live" :style="pcPaperControlStyles()">
    <TribulationChapterTracker
      :chapter-names="active.chapterNames"
      :chapter-index="active.chapterIndex"
      :label="t('tribulation.overlay.chapter', { progress: chapterProgress })"
    />

    <TribulationStatusCard
      :chapter-name="active.chapterName"
      :chapter-progress="chapterProgress"
      :seconds-remaining="active.secondsRemaining"
      :strikes-taken="active.lightningStrikesTaken"
      :show-tank="!isMindChapter && !isFinished"
    />

    <TribulationRealmCard
      :realm-name="realmName"
      :chapter-progress="chapterProgress"
      :strikes-taken="active.lightningStrikesTaken"
    />

    <TribulationHpCluster :hp="hp" :max-hp="maxHp" />

    <TribulationMindCard
      v-if="isMindChapter"
      :question="active.currentQuestion!.question"
      :answers="active.currentQuestion!.answers"
      :seconds-remaining="active.questionSecondsRemaining"
      :seconds-limit="active.questionSecondsLimit"
      @answer="answer"
    />

    <TribulationResultBanner v-if="isFinished" :title="resultTitle" :text="resultText" />
  </div>
</template>

<style scoped>
.tribulation-ui { position:absolute; inset:0; z-index:15; pointer-events:none; color:var(--scene-tribulation-text); text-align:center; }
.tribulation-ui :deep(.bar__fill) { transition:width .15s linear; }
</style>
