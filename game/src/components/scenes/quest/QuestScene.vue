<script setup lang="ts">
// Scene 18 quest production surface (ref 17-quest.jpg): the approved
// fidelity composition - cadence tab bar | quest list rail | detail
// panel - now mounted on the shared paper chrome inside an overlay
// design canvas, like every other migrated tab. The real
// QuestGroupTabs/QuestList/QuestDetailPanel mount through the scene's
// slots. Cadence filter, selection fallback, and claim are model-driven
// (getBetaQuestSurfaceModels rows from the panel; claimQuest via
// questOps - contract DO-NOT-DERIVE kept).
import { computed, ref, watch } from 'vue'
import { useStateVersion, useGameManager } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import QuestFidelityScene from './fidelity/QuestFidelityScene.vue'
import QuestGroupTabs from './tabs/QuestGroupTabs.vue'
import QuestList from './list/QuestList.vue'
import QuestDetailPanel from './detail/QuestDetailPanel.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{
  rows: readonly BetaQuestSurfaceModel[]
}>()

const ui = useUiStore()
const gameManager = useGameManager()
const { bumpState } = useStateVersion()
const { items: navItems, navigate } = usePaperNavigation()

// Cadence filter is model-driven: beta admits 'once' only, so the tab
// strip renders Tat Ca + one tab per cadence actually present (other
// cadences stay RESERVED - contract DO-NOT-DERIVE). A row claiming a
// foreign cadence (e.g. 'weekly') is malformed input and mints no tab.
const MODEL_CADENCES: readonly BetaQuestSurfaceModel['cadence'][] = ['once']

const activeCadence = ref<'all' | BetaQuestSurfaceModel['cadence']>('all')

const cadences = computed(() => {
  const set = new Set<BetaQuestSurfaceModel['cadence']>()
  for (const row of props.rows) {
    if (MODEL_CADENCES.includes(row.cadence)) set.add(row.cadence)
  }
  return [...set]
})

const visibleRows = computed(() =>
  activeCadence.value === 'all'
    ? props.rows
    : props.rows.filter((row) => row.cadence === activeCadence.value),
)

const selectedQuestId = ref<string | null>(null)
const selectedRow = computed(
  () => visibleRows.value.find((row) => row.id === selectedQuestId.value) ?? null,
)

// Tabs emit plain strings; the scene owns the filter union and ignores
// anything outside it ('all' or a cadence the models actually emit).
function selectCadence(id: string) {
  if (id !== 'all' && !cadences.value.some((c) => c === id)) return
  activeCadence.value = id as 'all' | BetaQuestSurfaceModel['cadence']
}

watch(
  visibleRows,
  (list) => {
    if (!list.some((row) => row.id === selectedQuestId.value)) {
      selectedQuestId.value = list[0]?.id ?? null
    }
  },
  { immediate: true },
)

function onClaim(questId: string) {
  if (gameManager.questOps.claimQuest(questId)) {
    bumpState()
  }
}
</script>

<template>
  <SceneDesignCanvas overlay>
  <QuestFidelityScene :quests="[]" :selected="undefined" filter="all" :rewards="[]" :navigation="navItems" notice="" @navigate="navigate" @back="ui.closeHomeOverlays()">
    <template #tabs>
      <QuestGroupTabs
        class="quest-tabs-slot"
        :cadences="cadences"
        :active="activeCadence"
        :on-select="selectCadence"
      />
    </template>
    <template #list>
      <QuestList
        class="quest-list-slot"
        :rows="visibleRows"
        :selected-id="selectedQuestId"
        :on-select="(id: string) => { selectedQuestId = id }"
      />
    </template>
    <template #detail>
      <QuestDetailPanel :row="selectedRow" :on-claim="onClaim" />
    </template>
  </QuestFidelityScene>
  </SceneDesignCanvas>
</template>

<style scoped>
/* Slot content carries this scope id - rail/tab chrome is applied here
   so the real components inherit the fidelity geometry. */
.quest-tabs-slot {
  margin-bottom: 17px;
  border-bottom: 1px solid #81663a66;
  flex: 0 0 auto;
}
.quest-list-slot {
  overflow: auto;
  border-right: 1px solid #866b3b55;
  padding-right: 21px;
  min-height: 0;
}
</style>
