<script setup lang="ts">
// Tam Phap production adapter: mounts the approved technique-v2 fidelity
// surface (paper info card + artifact vista + tier track + upgrade rail)
// fed entirely by the canonical read-model -
// realmAdvanceOps.getBetaTechniqueSurfaceModel owns name/quality/
// description/sections/tier/mastery and the gradeAdvance quote
// (cost, owned, eligibility, disabledReason). The CTA keeps its owner:
// realmAdvanceOps.tryAdvanceTechniqueGrade is the only mutation called;
// nothing here recomputes costs, gates, or progression.
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { techniqueCodexUrl } from '@/presentation/technique/techniqueArt'
import { getActivePath } from '@/core/player/CultivationPathSystem'
import { ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import { TECHNIQUE_TIER_LABELS } from '@/core/technique/TechniqueProgression'
import { ITEM_QUALITY_LABELS } from '@/core/item/ItemQuality'
import type { TechniqueTier } from '@/core/technique/Technique'
import type { BetaTechniqueGradeAdvanceDisabledReason } from '@/core/betaScopeTechniqueDomain'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import TechniqueFidelityScene from './fidelity/TechniqueFidelityScene.vue'
import type { TechniqueUiModel } from './fidelity/techniqueUi'

const TIER_ORDER: readonly TechniqueTier[] = ['so_nhap', 'tieu_thanh', 'dai_thanh', 'vien_man']

// Placeholder signature colors for non-element pathways (Kiem Tu / The Tu).
const PATHWAY_PROGRESS_COLORS: Record<string, string> = {
  sword: '#38b6c8',
  body: '#d9822b',
}

const MATERIAL_CATEGORY_ART: Record<string, string> = {
  essence: '/assets/ui/tien-hiep-2026-10/controls/resource-essence-v1.png',
  spirit_stone: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
}

const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()

function formatTechniqueGrade(grade: number | undefined): string {
  if (grade === undefined) return '—'
  if (grade >= 1 && grade <= 10) {
    return t(`panels.skillPath.technique.grades.${grade}`)
  }
  return t('panels.skillPath.technique.gradeNode', { grade })
}

function materialIconFor(materialId: string | undefined): string | undefined {
  if (!materialId) return undefined
  try {
    const material = gameManager.materialRegistry?.get?.(materialId) as
      | { icon?: string; category?: string }
      | undefined
    const art = material?.icon ?? (material?.category ? MATERIAL_CATEGORY_ART[material.category] : undefined)
    return art ? resolveAssetUrl(art) : undefined
  } catch {
    return undefined
  }
}

const selected = ref('')
const notice = ref('')
let noticeTimer: number | undefined
function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { noticeTimer = undefined; notice.value = '' }, 3200)
}
onBeforeUnmount(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })

const surface = computed(() => {
  stateVersion.value
  return gameManager.realmAdvanceOps.getBetaTechniqueSurfaceModel(player.$state)
})

function disabledReasonLabel(reason: BetaTechniqueGradeAdvanceDisabledReason | null): string {
  switch (reason) {
    case 'grade-ceiling': return t('panels.skillPath.technique.reasonGradeCeiling')
    case 'realm-gate': return t('panels.skillPath.technique.reasonRealmGate')
    case 'insufficient-material': return t('panels.skillPath.technique.reasonInsufficientMaterial')
    case 'busy': return t('panels.skillPath.technique.reasonBusy')
    case 'no-technique': return t('panels.skillPath.technique.emptyNoTechnique')
    default: return ''
  }
}

function resolveProgressColor(element: TechniqueUiModel['progressColor'] | undefined): string {
  const activePath = getActivePath(player.$state)
  const activeElement = surface.value.element
  if (activePath === 'spell') {
    return activeElement ? ELEMENT_COLOR_VARS[activeElement] : 'var(--el-primordial)'
  }
  if (activePath && PATHWAY_PROGRESS_COLORS[activePath]) {
    return PATHWAY_PROGRESS_COLORS[activePath]
  }
  if (activeElement && ELEMENT_COLOR_VARS[activeElement]) {
    return ELEMENT_COLOR_VARS[activeElement]
  }
  return element ?? '#d4a548'
}

const model = computed<TechniqueUiModel>(() => {
  const m = surface.value
  const advance = m.gradeAdvance
  const tierIndex = m.tier !== undefined ? TIER_ORDER.indexOf(m.tier) : -1
  const masteryMax = m.masteryForNextRank ?? 0

  return {
    hasTechnique: m.state === 'available',
    name: m.name ?? '',
    quality: m.quality !== undefined ? ITEM_QUALITY_LABELS[m.quality] : '',
    qualityKey: m.quality,
    description: m.description ?? t('panels.skillPath.technique.emptyNoTechnique'),
    // The codex is shared decorative art; technique identity stays in the model.
    art: techniqueCodexUrl(m.element),
    sections: m.sections.map((section, s) => ({
      id: `section-${s}`,
      title: section.label,
      rows: section.rows.map((row, r) => ({ id: `section-${s}-row-${r}`, label: row.label, value: row.value })),
    })),
    stages: tierIndex < 0
      ? []
      : TIER_ORDER.map((tier, i) => ({
          id: tier,
          label: TECHNIQUE_TIER_LABELS[tier],
          state: i < tierIndex ? 'reached' : i === tierIndex ? 'current' : 'next',
        })),
    rankLabel: m.grade !== undefined && m.rank !== undefined
      ? t('panels.skillPath.technique.rankLine', { grade: formatTechniqueGrade(m.grade), rank: m.rank })
      : '—',
    masteryLabel: m.rankCapped
      ? (m.tier !== undefined ? TECHNIQUE_TIER_LABELS[m.tier] : '—')
      : m.masteryForNextRank === undefined
        ? '—'
        : `${formatNumber(m.mastery ?? 0)} / ${formatNumber(m.masteryForNextRank)}`,
    masteryPercent: m.rankCapped ? 100 : masteryMax > 0 ? ((m.mastery ?? 0) / masteryMax) * 100 : 0,
    currentGrade: formatTechniqueGrade(m.grade),
    nextGrade: formatTechniqueGrade(advance.targetGrade),
    material: {
      id: advance.materialId,
      name: advance.materialName ?? '—',
      icon: materialIconFor(advance.materialId),
      amountLabel: advance.cost !== undefined ? `${formatNumber(advance.owned ?? 0)} / ${formatNumber(advance.cost)}` : '—',
      have: advance.owned,
      need: advance.cost,
      met: advance.cost !== undefined ? (advance.owned ?? 0) >= advance.cost : true,
    },
    materialNote: '',
    advanceDisabled: !advance.available,
    disabledReason: disabledReasonLabel(advance.disabledReason),
    artTemporary: false,
    progressColor: resolveProgressColor(undefined),
  }
})

function onSelect(id: string) {
  const stage = model.value.stages.find((entry) => entry.id === id)
  if (!stage) return
  selected.value = id
  flashNotice(t('technique.stageNotice', { name: stage.label }))
}

function onAdvance() {
  const target = surface.value.gradeAdvance.targetGrade
  if (gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player.$state)) {
    bumpState()
    flashNotice(
      target !== undefined
        ? t('technique.advanceNotice', { grade: formatTechniqueGrade(target) })
        : t('technique.advanceNotice', { grade: '' }),
    )
  }
}
</script>

<template>
  <SceneDesignCanvas overlay>
    <TechniqueFidelityScene
      :model="model"
      :selected="selected"
      :notice="notice"
     
      @select="onSelect"
      @advance="onAdvance"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
