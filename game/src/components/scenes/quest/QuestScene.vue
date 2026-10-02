<script setup lang="ts">
// Scene 17 quest scaffold (ref 17-quest.jpg; spec scene "18" Quest):
// group-tabs | quest-list (620 col) beside detail-panel (608 col) on
// the 1244 x 610 imperial-scroll content band.
//
// The panel wrapper (QuestPanel.vue) owns the canonical read
// (getBetaQuestSurfaceModels - architecture contract) and the scroll
// shell; this scene owns presentation: cadence tab filter, selection,
// and the claim action against questOps.claimQuest.
import { computed, ref, watch } from 'vue'
import { useStateVersion, useGameManager } from '@/composables/useGameState'
import QuestGroupTabs from './tabs/QuestGroupTabs.vue'
import QuestList from './list/QuestList.vue'
import QuestDetailPanel from './detail/QuestDetailPanel.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{
  rows: readonly BetaQuestSurfaceModel[]
}>()

const gameManager = useGameManager()
const { bumpState } = useStateVersion()

// Cadence filter is model-driven: beta admits 'once' only, so the tab
// strip renders Tat Ca + one tab per cadence actually present (other
// cadences stay RESERVED - contract DO-NOT-DERIVE).
const activeCadence = ref<'all' | BetaQuestSurfaceModel['cadence']>('all')

const cadences = computed(() => {
  const set = new Set<BetaQuestSurfaceModel['cadence']>()
  for (const row of props.rows) set.add(row.cadence)
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
  <div class="quest-scene">
    <QuestGroupTabs
      class="quest-scene__tabs"
      :cadences="cadences"
      :active="activeCadence"
      :on-select="selectCadence"
    />

    <QuestList
      class="quest-scene__list"
      :rows="visibleRows"
      :selected-id="selectedQuestId"
      :on-select="(id: string) => { selectedQuestId = id }"
    />

    <QuestDetailPanel
      class="quest-scene__detail"
      :row="selectedRow"
      :on-claim="onClaim"
    />
  </div>
</template>

<style scoped>
/* Spec scene "18" columns: tabs+list 620 | detail 608, 16px gap. */
.quest-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 620fr) minmax(0, 608fr);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px 16px;
  padding: 6px 2px;
  color: var(--hk-text-primary, var(--paper-text));
  font-family: var(--hk-font-ui, var(--font-body));
}

.quest-scene > * { min-width: 0; min-height: 0; }
.quest-scene__detail { grid-row: 1 / -1; grid-column: 2; }

@container (max-width: 860px) {
  .quest-scene { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 40%) minmax(0, 1fr); overflow-y: auto; }
  .quest-scene__detail { grid-row: auto; grid-column: auto; }
}
</style>
