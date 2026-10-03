<script setup lang="ts">
// BETA FE-CONTRACT (work-order sec.4B): renders the canonical
// BetaQuestSurfaceModel rows via questOps - reward admission, target
// labels, the collect shortfall and claimability all resolve inside
// the domain model. The panel maps verdict -> i18n label / CSS class
// and never rebuilds release gating or reward admission itself.
//
// Huyen Kim scene 17 scaffold (ref 17-quest.jpg; spec scene "18"
// Quest): this panel keeps the imperial-scroll shell + the canonical
// read (getBetaQuestSurfaceModels - architecture contract anchors it
// here); presentation lives in scenes/quest/*.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import QuestScene from '@/components/scenes/quest/QuestScene.vue'

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

const rows = computed(() => {
  stateVersion.value

  return gameManager.questOps.getBetaQuestSurfaceModels()
})

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <ImperialScrollScene
    scene="quest" :open="ui.standalonePanel === 'quest'" :title="t('panels.quest.title')" @close="close">
    <QuestScene :rows="rows" />
  </ImperialScrollScene>
</template>
