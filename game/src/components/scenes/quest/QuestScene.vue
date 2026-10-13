<script setup lang="ts">
// Scene 18 quest production surface (Codex landscape port): the
// approved 3-column composition - thematic group medallion rail |
// EquipmentArtCard list | EquipmentArtCard detail - on the shared
// paper sheet. The left rail's axis is the row `group` field
// (BetaQuestSurfaceModel.group; rows without one bucket under their
// cadence 'once' so nothing disappears). The cadence/status strip is
// orphaned by the preview's group axis - it is NOT deleted (owner
// ruling pending on placement): it rides inside the list card above
// the rows and keeps filtering exactly as before.
import { computed, ref, watch } from 'vue'
import { useStateVersion, useGameManager } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import QuestFidelityScene from './fidelity/QuestFidelityScene.vue'
import QuestGroupRail from './groups/QuestGroupRail.vue'
import QuestGroupTabs from './tabs/QuestGroupTabs.vue'
import QuestList from './list/QuestList.vue'
import QuestDetailPanel from './detail/QuestDetailPanel.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'
import { selectVisibleQuestId } from '@/presentation/questUi'

const props = defineProps<{
  rows: readonly BetaQuestSurfaceModel[]
}>()

const ui = useUiStore()
const gameManager = useGameManager()
const { bumpState } = useStateVersion()

// Group axis (ruling 2026-10-11): rail shows 'all' + every group id the
// rows carry. Rows without `group` bucket under their cadence so the
// existing surface still renders unchanged.
function rowGroup(row: BetaQuestSurfaceModel): string {
  return row.group ?? row.cadence
}

const groups = computed(() => {
  const set = new Set<string>()
  for (const row of props.rows) set.add(rowGroup(row))
  return [...set]
})

const activeGroup = ref<string>('all')
const groupRows = computed(() =>
  activeGroup.value === 'all'
    ? props.rows
    : props.rows.filter((row) => rowGroup(row) === activeGroup.value),
)

function selectGroup(id: string) {
  if (id !== 'all' && !groups.value.some((g) => g === id)) return
  activeGroup.value = id
}

// Cadence strip is model-driven: beta admits 'once' only, so it renders
// Tat Ca + one tab per cadence actually present (other cadences stay
// RESERVED - contract DO-NOT-DERIVE). A row claiming a foreign cadence
// (e.g. 'weekly') is malformed input and mints no tab.
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
    ? groupRows.value
    : groupRows.value.filter((row) => row.cadence === activeCadence.value),
)

const selectedQuestId = ref<string | null>(null)
const selectedRow = computed(
  () => visibleRows.value.find((row) => row.id === selectedQuestId.value && !row.lockedPreview) ?? null,
)
const onlyLockedRows = computed(() =>
  visibleRows.value.length > 0 && visibleRows.value.every((row) => !!row.lockedPreview),
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
    selectedQuestId.value = selectVisibleQuestId(list, selectedQuestId.value)
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
  <QuestFidelityScene :quests="[]" :selected="undefined" filter="all" :rewards="[]" notice="" @back="ui.closeHomeOverlays()">
    <template #groups>
      <QuestGroupRail
        class="quest-groups-slot"
        :groups="groups"
        :active="activeGroup"
        :on-select="selectGroup"
      />
    </template>
    <template #list>
      <div class="quest-list-slot">
        <QuestGroupTabs
          class="quest-tabs-slot"
          :cadences="cadences"
          :active="activeCadence"
          :on-select="selectCadence"
        />
        <QuestList
          class="quest-rows-slot"
          :rows="visibleRows"
          :selected-id="selectedQuestId"
          :on-select="(id: string) => { selectedQuestId = id }"
        />
      </div>
    </template>
    <template #detail>
      <QuestDetailPanel :row="selectedRow" :only-locked="onlyLockedRows" :on-claim="onClaim" />
    </template>
  </QuestFidelityScene>
  </SceneDesignCanvas>
</template>

<style scoped>
/* Slot content carries this scope id - rail/list chrome is applied
   here so the real components inherit the fidelity geometry. */
.quest-groups-slot {
  height: 100%;
}
.quest-list-slot {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.quest-tabs-slot {
  flex: 0 0 auto;
  margin-bottom: 6px;
}
.quest-rows-slot {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
