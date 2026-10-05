<script setup lang="ts">
// Ban Menh Phap Bao (2026-08-27, foundation-artifact-system-plan.md
// muc 12.1) - panel standalone, cung pattern QuestPanel.vue/SkillPathPanel.vue.
// Phai render dung state "nghe chua co definition" (Kiem Tu, doc sec4)
// khong crash khi player.artifact undefined.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import { pcPaperIconUrl } from '@/presentation/assets/PcPaperIcons'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import EmptyState from '@/components/common/primitives/EmptyState.vue'
import ArtifactOverview from './artifact/ArtifactOverview.vue'
import ArtifactExperienceBar from './artifact/ArtifactExperienceBar.vue'
import ArtifactGradeSection from './artifact/ArtifactGradeSection.vue'
import ArtifactPathCards from './artifact/ArtifactPathCards.vue'
import { ARTIFACTS } from '@/data/artifact/Artifacts'
import { ARTIFACT_GRADE_LABELS, ARTIFACT_GRADE_ORDER, ARTIFACT_PATH_ORDER, resolveExpectedArtifactId } from '@/core/artifact/Artifact'
import type { ArtifactPath } from '@/core/artifact/Artifact'
import {
  DOAN_BAO_THACH_MATERIAL_ID,
  getArtifactExpRequired,
  getArtifactExpStatus,
  getArtifactGradeMultiplier,
  getArtifactGradeUpgradeCost,
  getNextArtifactGrade,
} from '@/core/artifact/ArtifactProgression'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { getActiveWayDefinition } from '@/core/player/CultivationPathKit'
import { formatStat } from '@/core/stats/StatLabels'

const ui = useUiStore()
const pageRef = ref<HTMLElement | null>(null)
useDialogFocus(pageRef, computed(() => ui.standalonePanel === 'artifact'), { onEscape: () => close() })
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { isBattleInProgress } = useTurnBattleInfo()
const { t } = useI18n()

const artifactId = computed(() => {
  stateVersion.value

  return resolveExpectedArtifactId(player)
})

const definition = computed(() => (artifactId.value ? ARTIFACTS[artifactId.value] : undefined))

const cultivationPathLabel = computed(() => {
  // M5 - the active way (cultivationWay authoritative) names the path,
  // so a collapsed ('body','hidden_body_pathway') save labels Ung The correctly.
  const way = getActiveWayDefinition(player)

  return way?.name ?? t('panels.artifact.noPath')
})

const canChange = computed(() => {
  stateVersion.value

  return !isBattleInProgress.value
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

// Artifact Pham is a 5-step axis - same ramp positions the Chat
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
  <SceneDesignCanvas v-if="ui.standalonePanel === 'artifact'" overlay :style="{ zIndex: OVERLAY_LAYERS.panel }">
    <section ref="pageRef" class="artifact-page" role="dialog" aria-modal="true" :aria-label="t('panels.artifact.title')">
      <PcPaperScene :title="t('panels.artifact.title')">
        <template #actions><PcPaperButton variant="secondary" @click="close">{{ t('pcUi.back') }}</PcPaperButton></template>
    <EmptyState v-if="!definition" size="lg">
      {{ t('panels.artifact.emptyNoDefinition', { path: cultivationPathLabel }) }}
    </EmptyState>

    <EmptyState v-else-if="!artifact" size="lg">
      {{ t('panels.artifact.emptyNotAwakened', { name: definition.name }) }}
    </EmptyState>

    <div v-else class="artifact-panel">
      <section class="artifact-panel__identity"><img class="artifact-panel__focal" :src="pcPaperIconUrl('artifact')" alt="">
      <ArtifactOverview
        :name="definition.name"
        :cultivation-path-label="cultivationPathLabel"
        :grade-label="gradeLabel"
        :grade-color-var="gradeColorVar"
      />

      <ArtifactPathCards
        :paths="pathDefinitions"
        :selected-path="artifact.selectedPath"
        :artifact-level="artifact.realmLevel"
        :can-change="canChange"
        @select="onSelectPath"
      />
      </section>
      <aside class="pc-paper-inspector artifact-panel__inspector">
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

      </aside>
    </div>
      </PcPaperScene>
    </section>
  </SceneDesignCanvas>
</template>

<style scoped>
.artifact-page{position:absolute;inset:0;pointer-events:auto}
:is(#app,body) .artifact-page .artifact-panel{height:100%;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:38px;grid-template-rows:minmax(0,1fr);overflow:hidden}
.artifact-panel__identity{min-height:0;overflow:auto;padding-right:12px;scrollbar-width:thin}
.artifact-panel__focal{float:left;width:150px;height:150px;object-fit:contain;margin:0 24px 15px 0}
.artifact-panel__identity :deep(.artifact-overview){min-height:150px;padding:15px 0 25px;background:transparent;border-bottom:1px solid #b08b4d66}
.artifact-panel__identity :deep(.artifact-overview__icon){display:none}
:is(#app,body) .artifact-panel__identity :deep(.artifact-overview__name){font:700 30px/1.3 var(--pc-font-body);color:#302718}
.artifact-panel__identity :deep(.artifact-overview__meta){font-size:18px;color:#765d32}
.artifact-panel__identity :deep(.artifact-path-cards){clear:both;padding:22px 0;gap:14px}
.artifact-panel__identity :deep(.artifact-path-cards__card){padding:15px 20px;border:3px double #ad8a45;border-radius:0;background:#f4e7cc80;color:#302718;font-family:var(--pc-font-body)}
.artifact-panel__identity :deep(.artifact-path-cards__card.is-selected){background:#dcb56955}
:is(#app,body) .artifact-panel__identity :deep(.artifact-path-cards__name){font-size:23px;color:#302718}
.artifact-panel__identity :deep(.artifact-path-cards__milestones){font-size:16px;color:#765d32}
.artifact-page .artifact-panel__inspector{background:var(--pc-inspector-art) center/100% 100%;padding:23px 27px;color:#f4e4c0;min-height:0;overflow:auto;scrollbar-width:thin;--paper-text:#f2e3c4;--paper-text-muted:#cbb996;--paper-text-soft:#ded1b4;--gold-700:#edcc87}
.artifact-panel__inspector :deep(.artifact-grade),.artifact-panel__inspector :deep(.artifact-exp){padding:16px 0;font-size:18px}
.artifact-panel__inspector :deep(.stat-row){font-size:19px}
.artifact-panel__inspector :deep(.artifact-grade__hint){color:#d6c49a;font-size:16px}
.artifact-page .artifact-panel__inspector :deep(.artifact-exp-bar__head),.artifact-page .artifact-panel__inspector :deep(.stat-row__label){color:#ded1b4;font-size:19px}
.artifact-page .artifact-panel__inspector :deep(.artifact-exp-bar__status){color:#d8c49a;font-size:16px}
</style>
