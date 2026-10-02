<script setup lang="ts">
// Huyen Kim scene 06 - Tam Phap dedicated imperial scroll (mission
// sec.11): the ACTIVE technique showcased, not a library browser.
// Decomposed per ref 06-technique.jpg: info card + artifact vista +
// grade track + upgrade rail. All state/mutations stay on the canonical
// beta read-model (realmAdvanceOps.getBetaTechniqueSurfaceModel /
// tryAdvanceTechniqueGrade) - this scene adds no domain calls of its own.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import TechniqueSlotCard from '@/components/panels/skill-path/TechniqueSlotCard.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'
import { TECHNIQUE_TIER_LABELS } from '@/core/technique/TechniqueProgression'
import TechniqueInfoCard from './card/TechniqueInfoCard.vue'
import TechniqueArtifactVista from './vista/TechniqueArtifactVista.vue'
import TechniqueGradeTrack, { type TechniqueTrackNode } from './track/TechniqueGradeTrack.vue'
import TechniqueUpgradePanel from './upgrade/TechniqueUpgradePanel.vue'

const PLINTH_SRC = stableSceneArtUrl('technique-display-plinth', '@2x')

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const model = computed(() => {
  stateVersion.value

  return gameManager.realmAdvanceOps.getBetaTechniqueSurfaceModel(player.$state)
})

const gradeAdvance = computed(() => model.value.gradeAdvance)

// Spec 06 bottom grade-track: the live grade -> next grade node trail.
// Runtime owns both ends; hidden grades never render as placeholders.
const trackNodes = computed<TechniqueTrackNode[]>(() => {
  const current = model.value.grade
  const target = gradeAdvance.value.targetGrade
  const nodes: TechniqueTrackNode[] = []

  if (current !== undefined) {
    nodes.push({ key: `grade-${current}`, label: t('panels.skillPath.technique.gradeNode', { grade: current }), state: 'current' })
  }
  if (target !== undefined && target !== current) {
    nodes.push({ key: `grade-${target}`, label: t('panels.skillPath.technique.gradeNode', { grade: target }), state: 'next' })
  }

  return nodes
})

const rankLine = computed(() =>
  model.value.grade !== undefined && model.value.rank !== undefined
    ? t('panels.skillPath.technique.rankLine', { grade: model.value.grade, rank: model.value.rank })
    : '—',
)
const masteryValue = computed(() => (model.value.rankCapped ? 1 : (model.value.mastery ?? 0)))
const masteryMax = computed(() => (model.value.rankCapped ? 1 : (model.value.masteryForNextRank || 1)))
const masteryLabel = computed(() => {
  if (model.value.rankCapped) {
    return model.value.tier ? TECHNIQUE_TIER_LABELS[model.value.tier] : '—'
  }
  return model.value.masteryForNextRank === undefined
    ? '—'
    : `${formatNumber(model.value.mastery ?? 0)} / ${formatNumber(model.value.masteryForNextRank)}`
})

function upgradeGrade(): void {
  if (gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player.$state)) {
    bumpState()
  }
}

function close() { ui.closeHomeOverlays() }
</script>

<template>
  <ImperialScrollScene
    scene="technique"
    :open="ui.standalonePanel === 'technique'"
    :title="t('panels.skillPath.technique.title')"
    @close="close"
  >
    <div class="technique-scene">
      <!-- Left: the "Cong Phap" info card (name/seal/pham/desc/sections) -->
      <TechniqueInfoCard :model="model" />

      <!-- Center: plinth dais + artifact frame; the runtime slot card is
           the centerpiece stand-in for the excluded painted artifact. -->
      <TechniqueArtifactVista :plinth-src="PLINTH_SRC">
        <TechniqueSlotCard :label="t('panels.skillPath.technique.heroLabel')" size="hero" />
      </TechniqueArtifactVista>

      <!-- Right: grade compare + materials + ceremonial CTA -->
      <TechniqueUpgradePanel :model="model" @advance="upgradeGrade" />

      <!-- Bottom: caption + grade chain + rank mastery line -->
      <TechniqueGradeTrack
        v-if="trackNodes.length"
        :caption="t('panels.skillPath.technique.gradeTrackTitle')"
        :nodes="trackNodes"
        :rank-line="rankLine"
        :mastery-value="masteryValue"
        :mastery-max="masteryMax"
        :mastery-label="masteryLabel"
      />
    </div>
  </ImperialScrollScene>
</template>

<style scoped>
/* Ref 06: card (400) | artifact vista (448) | upgrade rail (364, full
   height), grade track across card+vista bottom (864 x 118). */
.technique-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 400fr) minmax(0, 448fr) minmax(0, 364fr);
  grid-template-rows: minmax(0, 480fr) minmax(0, 118fr);
  /* Spec 06 gaps on the 1244x610 band: 16 design-px columns -> 1.29%
     (16/1244), 12 design-px row -> 1.97% (12/610); raw px renders
     ~1.306x and shifts grade-track off its spec band. */
  row-gap: 1.97%;
  column-gap: 1.29%;
  padding: 6px 2px;
}

.technique-scene > :nth-child(1) { grid-area: 1 / 1; }
.technique-scene > :nth-child(2) { grid-area: 1 / 2; }
.technique-scene > :nth-child(3) { grid-area: 1 / 3 / -1; }
.technique-scene > :nth-child(4) { grid-area: 2 / 1 / 3; }

@container (max-width: 900px) {
  /* Percent row-gap resolves to 0 on the indefinite stacked height. */
  .technique-scene { grid-template-columns: 1fr; grid-template-rows: auto minmax(160px, 30%) 1fr auto; row-gap: 12px; overflow-y: auto; }
  .technique-scene > * { grid-area: auto !important; }
}
</style>
