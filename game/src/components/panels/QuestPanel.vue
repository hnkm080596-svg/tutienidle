<script setup lang="ts">
// BETA FE-CONTRACT (work-order sec.4B): renders the canonical
// BetaQuestSurfaceModel rows via questOps - reward admission, target
// labels, the collect shortfall and claimability all resolve inside
// the domain model. The panel maps verdict -> i18n label / CSS class
// and never rebuilds release gating or reward admission itself.
//
// Huyen Kim scene 18 (Nhiem Vu): the imperial-scroll shell is retired -
// the production surface now owns the shared paper chrome on an overlay
// design canvas (same chrome as the other migrated tabs). This seam
// keeps the canonical read (getBetaQuestSurfaceModels - architecture
// contract anchors it here); presentation lives in scenes/quest/*.
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import QuestScene from '@/components/scenes/quest/QuestScene.vue'

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const rows = computed(() => {
  stateVersion.value

  return gameManager.questOps.getBetaQuestSurfaceModels()
})
</script>

<template>
  <Transition name="th-panel-swap"><QuestScene v-if="ui.standalonePanel === 'quest'" :rows="rows" /></Transition>
</template>
