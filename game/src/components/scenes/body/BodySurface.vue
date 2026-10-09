<script setup lang="ts">
// Scene 08 (Luyen The) production adapter: mounts the approved body-v2
// fidelity surface (3-page paper flip - Luyen The / Bat Mach / Chu Thien)
// fed entirely by useBodySceneModel(), which already reads the canonical
// chapter read-models (BodyProgressionSystem + per-chapter data) and
// invests through realmAdvanceOps.investBodyChapter. Nothing here
// recomputes unit states, costs, gates, or chapter unlocks; the hidden
// rows port the same AUTH-2 discovery/frozen contract the retired
// detail panels owned.
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { useBodySceneModel, bodyChapterCtaKey, bodyChapterSubtitleKey } from './useBodySceneModel'
import { BODY_CHAPTER_LABEL_KEYS } from './useBodySceneModel'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import type { BodyUnitView } from './bodySceneModel'
import { getPhysiqueGrade } from '@/core/realm/body/BodyProgressionSystem'
import { betaHiddenRealmRecordFor } from '@/core/betaScopeSurface'
import { getQuanTheMechanic } from '@/core/realm/hidden/QuanTheDiversion'
import { formatNumber } from '@/core/format/NumberFormatter'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import BodyFidelityScene from './fidelity/BodyFidelityScene.vue'
import type {
  BodyPaperChapter,
  BodyPaperExtra,
  BodyPaperMilestone,
  BodyPaperModel,
  BodyPaperUnit,
} from './fidelity/bodyUi'


const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const model = useBodySceneModel()

const notice = ref('')
let noticeTimer: number | undefined
function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { noticeTimer = undefined; notice.value = '' }, 3200)
}
onBeforeUnmount(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })

const UI_TO_DOMAIN: Record<string, BodyChapterId> = {
  refinement: 'body_refinement',
  meridian: 'meridian',
  cycle: 'zhou_tian',
}
const DOMAIN_TO_UI: Record<BodyChapterId, string> = {
  body_refinement: 'refinement',
  meridian: 'meridian',
  zhou_tian: 'cycle',
}

const chapters = computed<BodyPaperChapter[]>(() =>
  model.chapters.value.map((chapter) => ({
    id: DOMAIN_TO_UI[chapter.id],
    label: t(BODY_CHAPTER_LABEL_KEYS[chapter.id]),
    hint: t(bodyChapterSubtitleKey(chapter.id)),
    unlocked: chapter.unlocked,
  })),
)

// Default chapter: first unlocked incomplete, else first unlocked, else
// Luyen The - same rule the retired scene used.
const pickedChapter = ref<string | null>(null)
const activeUiChapter = computed(() => {
  if (pickedChapter.value !== null) return pickedChapter.value
  const progress = model.chapters.value
  return DOMAIN_TO_UI[
    progress.find((chapter) => chapter.unlocked && chapter.completed < chapter.total)?.id
      ?? progress.find((chapter) => chapter.unlocked)?.id
      ?? 'body_refinement'
  ]
})
const activeDomainChapter = computed(() => UI_TO_DOMAIN[activeUiChapter.value] ?? 'body_refinement')
const activeModel = computed(() => model.chapter(activeDomainChapter.value))
const viewedUnit = computed(() => model.viewedUnit(activeDomainChapter.value))

function unitState(unit: BodyUnitView): BodyPaperUnit['state'] {
  switch (unit.status) {
    case 'done':
    case 'complete':
      return 'done'
    case 'active':
    case 'next':
      return 'current'
    default:
      return 'locked'
  }
}

function toUiUnit(unit: BodyUnitView): BodyPaperUnit {
  return {
    id: unit.id,
    label: unit.chip.label,
    title: unit.title,
    description: unit.description,
    state: unitState(unit),
    rows: unit.gains.map((gain) => ({ label: gain.label, value: gain.value })),
    costs: unit.costs.map((cost) => ({
      id: cost.id,
      name: cost.name,
      icon: cost.icon,
      have: cost.have,
      need: cost.need,
      // A completed tier has need=0 - printing 'have / 0' reads as a
      // broken cost, so the row shows the done label instead.
      amountLabel: cost.need === 0
        ? t('panels.body.states.done')
        : `${formatNumber(cost.have)} / ${formatNumber(cost.need)}`,
      met: cost.met,
    })),
    gates: unit.gates,
    progressLabel: unit.progress !== undefined
      ? `${formatNumber(unit.progress.value)} / ${formatNumber(unit.progress.max)}`
      : undefined,
    progressPct: unit.progress !== undefined && unit.progress.max > 0
      ? (unit.progress.value / unit.progress.max) * 100
      : undefined,
    actionLabel: t(bodyChapterCtaKey(activeDomainChapter.value)),
    actionDisabled: !unit.canInvest,
  }
}

const units = computed(() => activeModel.value.units.map(toUiUnit))

// Chu Thien lore milestones (Tieu 18 / Dai 36) ride the same rail as
// chips but own no detail card.
const milestones = computed<BodyPaperMilestone[]>(() =>
  activeModel.value.chips
    .filter((chip) => chip.id.startsWith('milestone_'))
    .map((chip) => ({ id: chip.id, label: chip.label, done: chip.status === 'done' })),
)

// AUTH-2 hidden rows: discovered + unfrozen records only - the beta
// scope lock resolves scope-hidden records to undefined upstream.
const extra = computed<BodyPaperExtra | null>(() => {
  stateVersion.value
  if (activeDomainChapter.value === 'body_refinement') {
    const record = betaHiddenRealmRecordFor(player.$state, 'mortal')
    if (record?.discovered !== true || record.frozen === true) return null
    const done = record.bodyCompleted === true
    return {
      title: t('hidden.mortal.tier7Name'),
      stateLabel: done ? t('hidden.mortal.stateDone') : t('hidden.mortal.stateTrial'),
      description: t('hidden.mortal.tier7Desc'),
      done,
    }
  }
  if (activeDomainChapter.value === 'meridian') {
    const record = betaHiddenRealmRecordFor(player.$state, 'qi_refining')
    if (record?.discovered !== true || record.frozen === true) return null
    const mechanic = getQuanTheMechanic(player.$state)
    const done = record.bodyCompleted === true
    return {
      title: t('hidden.qi.quanTheName'),
      stateLabel: done ? t('hidden.qi.stateDone') : t('hidden.qi.stateActive'),
      description: t('hidden.qi.quanTheDesc'),
      progress: mechanic?.progress ?? 0,
      progressMax: mechanic?.required ?? 0,
      progressLabel: `${formatNumber(mechanic?.progress ?? 0)} / ${formatNumber(mechanic?.required ?? 0)}`,
      done,
    }
  }
  return null
})

// Identity: the persisted physique grade (M-QI-07) rides the Luyen The
// page; the other pages show their chapter subtitle.
const identity = computed(() => {
  stateVersion.value
  return activeDomainChapter.value === 'body_refinement'
    ? t('panels.realm.physique.line', {
        grade: t(`panels.realm.physique.grades.${getPhysiqueGrade(player.$state)}`),
      })
    : t(bodyChapterSubtitleKey(activeDomainChapter.value))
})

const paperModel = computed<BodyPaperModel>(() => ({
  chapter: activeUiChapter.value,
  chapterLabel: t(BODY_CHAPTER_LABEL_KEYS[activeDomainChapter.value]),
  chapters: chapters.value,
  units: units.value,
  milestones: milestones.value,
  identity: identity.value,
  extra: extra.value,
  lockHint: activeModel.value.lockHint,
  progressLabel: `${activeModel.value.completed} / ${activeModel.value.total}`,
  progress: activeModel.value.total > 0
    ? (activeModel.value.completed / activeModel.value.total) * 100
    : 0,
}))

const paperUnit = computed(() => {
  const unit = viewedUnit.value
  return unit !== null ? toUiUnit(unit) : null
})

function selectChapter(id: string) {
  // Out-of-reach chapters are not viewable: the sealed tab refuses the
  // flip, same rule the technique tab lock uses on the nav rail.
  const domain = UI_TO_DOMAIN[id]
  const chapter = model.chapters.value.find((entry) => entry.id === domain)
  if (chapter && !chapter.unlocked) {
    return
  }
  pickedChapter.value = id
}
function selectUnit(id: string) { model.selectUnit(activeDomainChapter.value, id) }
function invest() {
  const consumed = model.investActive(activeDomainChapter.value)
  flashNotice(consumed > 0 ? t('body.investDone') : t('body.investUnavailable'))
}
</script>

<template>
  <SceneDesignCanvas overlay>
    <BodyFidelityScene
      :model="paperModel"
      :unit="paperUnit"
     
      :notice="notice"
      @chapter="selectChapter"
      @select="selectUnit"
      @invest="invest"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
