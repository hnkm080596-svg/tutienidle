<script setup lang="ts">
// Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md
// §12.1) — panel standalone, cùng pattern QuestPanel.vue/TechniquePanel.vue.
// Phải render đúng state "nghề chưa có definition" (Kiếm Tu, doc §4)
// không crash khi player.artifact undefined.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import ArtifactOverview from './artifact/ArtifactOverview.vue'
import ArtifactExperienceBar from './artifact/ArtifactExperienceBar.vue'
import ArtifactGradeSection from './artifact/ArtifactGradeSection.vue'
import ArtifactPathCards from './artifact/ArtifactPathCards.vue'
import { ARTIFACTS } from '@/data/artifact/Artifacts'
import { ARTIFACT_ID_BY_CULTIVATION_PATH, ARTIFACT_GRADE_LABELS, ARTIFACT_GRADE_ORDER, ARTIFACT_PATH_ORDER } from '@/core/artifact/Artifact'
import type { ArtifactPath } from '@/core/artifact/Artifact'
import {
  DOAN_BAO_THACH_MATERIAL_ID,
  getArtifactExpRequired,
  getArtifactExpStatus,
  getArtifactGradeMultiplier,
  getArtifactGradeUpgradeCost,
  getNextArtifactGrade,
} from '@/core/artifact/ArtifactProgression'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import { formatStat } from '@/core/stats/StatLabels'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const artifactId = computed(() => {
  stateVersion.value

  return player.cultivationPath ? ARTIFACT_ID_BY_CULTIVATION_PATH[player.cultivationPath] : undefined
})

const definition = computed(() => (artifactId.value ? ARTIFACTS[artifactId.value] : undefined))

const cultivationPathLabel = computed(() =>
  player.cultivationPath ? CULTIVATION_PATH_KITS[player.cultivationPath].name : t('panels.artifact.noPath'),
)

const canChange = computed(() => {
  stateVersion.value

  return !isBattleInProgress(gameManager.getBattle()?.state)
})

const stoneAmount = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(DOAN_BAO_THACH_MATERIAL_ID)
})

const artifact = computed(() => {
  stateVersion.value

  return player.artifact
})

const requiredExp = computed(() => (artifact.value ? getArtifactExpRequired(artifact.value.realmLevel) : 0))

const expStatus = computed(() =>
  artifact.value ? getArtifactExpStatus(artifact.value.realmLevel, player.realmId, player.realmLevel) : 'training',
)

const gradeLabel = computed(() => (artifact.value ? ARTIFACT_GRADE_LABELS[artifact.value.grade] : ''))

// Artifact Pham is a 5-step axis — same ramp positions the Chat
// 5-step uses (--rank-color-1/3/5/7/9) so grade text matches item
// colors (user ruling: every Pham/Chat text carries its set color).
const gradeColorVar = computed(() =>
  artifact.value
    ? `var(--rank-color-${ARTIFACT_GRADE_ORDER.indexOf(artifact.value.grade) * 2 + 1})`
    : undefined,
)

const multiplierPercentLabel = computed(() =>
  artifact.value
    ? `×${formatStat('artifactGradeMultiplier', getArtifactGradeMultiplier(artifact.value.grade))}`
    : '',
)

const nextGrade = computed(() => (artifact.value ? getNextArtifactGrade(artifact.value.grade) : undefined))

const upgradeCost = computed(() =>
  artifact.value ? getArtifactGradeUpgradeCost(artifact.value.grade) : undefined,
)

const nextGradeLabel = computed(() => (nextGrade.value ? ARTIFACT_GRADE_LABELS[nextGrade.value] : undefined))

const nextGradeColorVar = computed(() =>
  nextGrade.value
    ? `var(--rank-color-${ARTIFACT_GRADE_ORDER.indexOf(nextGrade.value) * 2 + 1})`
    : undefined,
)

function onUpgrade() {
  if (!player.artifact) {
    return
  }

  if (gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player.$state)) {
    bumpState()
  }
}

function onSelectPath(path: ArtifactPath) {
  if (!player.artifact) {
    return
  }

  if (gameManager.realmAdvanceOps.setArtifactPath(player.$state, path)) {
    bumpState()
  }
}

const pathDefinitions = computed(() =>
  definition.value ? ARTIFACT_PATH_ORDER.map((path) => definition.value!.paths[path]) : [],
)

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'artifact'" :title="t('panels.artifact.title')" width="min(560px, 92vw)" height="min(720px, 88vh)" @close="close">
    <EmptyState v-if="!definition" size="lg">
      {{ t('panels.artifact.emptyNoDefinition', { path: cultivationPathLabel }) }}
    </EmptyState>

    <EmptyState v-else-if="!artifact" size="lg">
      {{ t('panels.artifact.emptyNotAwakened', { name: definition.name }) }}
    </EmptyState>

    <div v-else class="artifact-panel">
      <ArtifactOverview
        :name="definition.name"
        :cultivation-path-label="cultivationPathLabel"
        :grade-label="gradeLabel"
        :grade-color-var="gradeColorVar"
      />

      <ArtifactExperienceBar
        :realm-level="artifact.realmLevel"
        :experience="artifact.experience"
        :required="requiredExp"
        :status="expStatus"
      />

      <ArtifactGradeSection
        :grade-label="gradeLabel"
        :grade-color-var="gradeColorVar"
        :multiplier-percent-label="multiplierPercentLabel"
        :stone-amount="stoneAmount"
        :upgrade-cost="upgradeCost"
        :next-grade-label="nextGradeLabel"
        :next-grade-color-var="nextGradeColorVar"
        :disabled="!canChange"
        @upgrade="onUpgrade"
      />

      <ArtifactPathCards
        :paths="pathDefinitions"
        :selected-path="artifact.selectedPath"
        :artifact-level="artifact.realmLevel"
        :can-change="canChange"
        @select="onSelectPath"
      />
    </div>
  </OverlayPanel>
</template>

<style scoped>
.artifact-panel {
  display: flex;
  flex-direction: column;
}

.artifact-panel .empty-state {
  padding: var(--space-6);
  color: var(--paper-text-soft);
}
</style>
