<script setup lang="ts">
// Scene 10 (Tham Hiem - Son Ha Do) production adapter: mounts the
// approved exploration-v2 paper surface fed entirely by the canonical
// stage read-models (getStageSurfaceModels: state/boss/displayEnemy/
// rewardPreview/disabledReason/startAvailable - frontend-contract
// sec.7 DO-NOT-DERIVE). All selection/watch/mode/farm logic ports
// verbatim from the retired StageSelectPanel composition; mutations
// still route through startSelectedStage / autoFarmOps.
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type BattleRunMode } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { ASSET_BUNDLE_MANAGER_KEY } from '@/presentation/PresentationContracts'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { useAudioStore } from '@/stores/audio'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { AmountRange, DropEntry } from '@/core/drop/DropTable'
import { materials } from '@/data/materials/materials'
import { equipment } from '@/data/equipment/equipment'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import ExplorationFidelityScene from './fidelity/ExplorationFidelityScene.vue'
import type {
  ExplorationChapter,
  ExplorationDetail,
  ExplorationNode,
  ExplorationPaperModel,
} from './fidelity/explorationUi'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import { disabledReasonLabel } from './disabledReasonLabel'

const TERRAIN_SRC = resolveAssetUrl('/assets/ui/huyen-kim/scene/exploration-v2/terrain-three-realms-v1.png')
const MODES: readonly BattleRunMode[] = ['manual', 'repeat', 'progress', 'perfect_farm']
const MODE_LABEL_KEYS: Record<BattleRunMode, string> = {
  manual: 'panels.stageSelect.modes.manual',
  repeat: 'panels.stageSelect.modes.repeat',
  progress: 'panels.stageSelect.modes.progress',
  perfect_farm: 'panels.stageSelect.modes.perfectFarm',
}
const MODE_HINT_KEYS: Record<BattleRunMode, string> = {
  manual: 'panels.stageSelect.modeHints.manual',
  repeat: 'panels.stageSelect.modeHints.repeat',
  progress: 'panels.stageSelect.modeHints.progress',
  perfect_farm: 'panels.stageSelect.modeHints.perfectFarm',
}
const ARCHETYPE_LABEL_KEYS: Record<string, string> = {
  melee: 'panels.stageSelect.archetypes.melee',
  ranged: 'panels.stageSelect.archetypes.ranged',
  caster: 'panels.stageSelect.archetypes.caster',
  tank: 'panels.stageSelect.archetypes.tank',
}
const KIND_LABEL_KEYS: Record<string, string> = {
  material: 'panels.stageSelect.rewards.kinds.material',
  equipment: 'panels.stageSelect.rewards.kinds.equipment',
  equipment_any: 'panels.stageSelect.rewards.kinds.equipmentAny',
  pill: 'panels.stageSelect.rewards.kinds.pill',
}

const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
const { startSelectedStage } = useBattleActions()
const assetManager = inject(ASSET_BUNDLE_MANAGER_KEY, null)
const { items: navItems, navigate } = usePaperNavigation()

const notice = ref('')
let noticeTimer: number | undefined
function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { noticeTimer = undefined; notice.value = '' }, 3200)
}

onMounted(() => {
  assetManager?.prefetch(['combat']).catch(() => {})
})

onBeforeUnmount(() => {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
})

// Chon Ai is the ONLY place Auto Battle is configured pre-combat, and
// the build deep-link goes to the real build surface (skill panel).
function openBuild() {
  ui.standalonePanel = 'skill'
}

const zones = computed(() => gameManager.zoneRegistry.getAll())

// Canonical stage read-models (contract sec.7) - the map consumes
// state/disabledReason/displayEnemy/rewardPreview from here, never by
// re-calling isStageUnlocked/stageLockReasonCode per node.
const surfaceModels = computed(() => gameManager.stageOps.getStageSurfaceModels(player.$state))
const modelById = computed(() => new Map(surfaceModels.value.map(model => [model.stageId, model])))

function isZoneUnlocked(zoneId: string): boolean {
  const zone = zones.value.find(candidate => candidate.id === zoneId)
  const firstStageId = zone?.stageIds[0]
  return Boolean(firstStageId && modelById.value.get(firstStageId)?.state !== 'locked')
}

const selectedZoneId = ref<string | null>(zones.value[0]?.id ?? null)

const selectedZone = computed(() =>
  zones.value.find(zone => zone.id === selectedZoneId.value) ?? null,
)

const stagesInZone = computed(() => {
  if (!selectedZone.value) {
    return []
  }

  return selectedZone.value.stageIds
    .map(stageId => gameManager.catalogOps.getStage(stageId))
    .filter((stage): stage is NonNullable<typeof stage> => stage !== undefined)
})

const selectedStageId = ref<string | null>(null)

// Auto-farm B5 - armed state is player state (survives reload), so the
// panel mirrors it: running farm row + stop control, and the perfect-farm
// start only closes the panel when the domain accepted it.
const armedFarmStage = computed(() => {
  const armed = player.$state.autoFarmStage
  if (!armed) {
    return null
  }

  return gameManager.catalogOps.getStage(armed.stageId) ?? null
})

function stopAutoFarm() {
  gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player.$state)
  useAudioStore().cue('farm.stop')
}

const chapterOptions = computed(() => {
  const chapters = new Map<number, { chapter: number; label: string }>()

  for (const stage of stagesInZone.value) {
    const chapter = stage.chapter ?? 1
    if (!chapters.has(chapter)) {
      chapters.set(chapter, {
        chapter,
        label: stage.requiredRealmId ? getCurrentRealm(stage.requiredRealmId).name : t('panels.stageSelect.labels.chapterPrefix', { chapter }),
      })
    }
  }

  return [...chapters.values()]
})

// Detail header chapter label follows the SELECTED stage's chapter -
// the Son Ha Do map renders every band at once and nodes across all
// chapters are directly pickable, so there is no chapter-tab state to
// keep in sync.
const selectedChapterLabel = computed(() => {
  const stage = selectedStage.value
  if (!stage) {
    return ''
  }
  const chapter = stage.chapter ?? 1
  return chapterOptions.value.find(option => option.chapter === chapter)?.label ?? ''
})

// Zone change re-picks the first unlocked stage of the new zone
// (stageIds order = chapter order, so this lands in the earliest
// incomplete chapter - same semantics the chapter-tab auto-pick had).
function selectFirstStageInZone() {
  selectedStageId.value = stagesInZone.value.find(stage => modelById.value.get(stage.id)?.state !== 'locked')?.id
    ?? stagesInZone.value[0]?.id
    ?? null
}

watch(selectedZoneId, selectFirstStageInZone, { immediate: true })

const selectedStage = computed(() =>
  stagesInZone.value.find(stage => stage.id === selectedStageId.value) ?? null,
)

const selectedModel = computed(() =>
  selectedStageId.value ? modelById.value.get(selectedStageId.value) : undefined,
)

const zoneProgress = computed(() => {
  const zone = selectedZone.value
  if (!zone) {
    return { completed: 0, total: 0 }
  }

  const done = player.$state.completedStageIds
  return {
    completed: zone.stageIds.filter(stageId => done.includes(stageId)).length,
    total: zone.stageIds.length,
  }
})

const mode = ref<BattleRunMode>('manual')

// T4-38 - an armed mode must not leak across stage selection: every
// writer of selectedStageId funnels through this watcher.
watch(selectedStageId, () => {
  mode.value = 'manual'
})

const isSelectedStagePerfectClear = computed(() =>
  Boolean(selectedStage.value && player.$state.perfectClearStageIds.includes(selectedStage.value.id)),
)

const canStart = computed(() => {
  if (!selectedZone.value || !selectedStage.value) {
    return false
  }

  return isZoneUnlocked(selectedZone.value.id) && (selectedModel.value?.startAvailable ?? false)
})

function selectZone(zoneId: string) {
  selectedZoneId.value = zoneId
}

function selectStage(stageId: string) {
  selectedStageId.value = stageId
}

function pickMode(id: string) {
  const next = id as BattleRunMode
  if (!MODES.includes(next) || (next === 'perfect_farm' && !isSelectedStagePerfectClear.value)) {
    return
  }
  mode.value = next
}

function start() {
  if (!selectedZone.value || !selectedStage.value || !canStart.value) {
    return
  }

  // perfect_farm does NOT start a real battle - startAutoFarm rolls
  // rewards by wall-clock; every other mode goes through
  // startSelectedStage. A refused start keeps the panel open so the
  // failure is visible instead of silent (partial T4-38).
  if (mode.value === 'perfect_farm') {
    if (gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, selectedStage.value.id)) {
      useAudioStore().cue('farm.arm')
      ui.leftPanelMode = null
    } else {
      useAudioStore().cue('ui.error')
      flashNotice(t('exploration.startFailed'))
    }
    return
  }

  void startSelectedStage(selectedZone.value.id, selectedStage.value, mode.value)
}

// ----- read-model -> paper model mapping ---------------------------------

function nodeState(stageId: string): ExplorationNode['state'] {
  switch (modelById.value.get(stageId)?.state) {
    case 'completed':
    case 'perfect':
      return 'cleared'
    case 'current':
      return 'current'
    case 'locked':
    case undefined:
      return 'locked'
    default:
      return 'available'
  }
}

// Zigzag trail inside each 720x140 chapter band: 10 nodes per row,
// alternating y - the approved preview geometry.
function nodePosition(index: number): { x: number; y: number } {
  const row = Math.floor(index / 10)
  const column = index % 10
  return { x: 58 + column * 66, y: 60 + row * 50 + (column % 2 === 0 ? 0 : 17) }
}

const TONES = ['', 'blue', 'violet'] as const

const paperChapters = computed<ExplorationChapter[]>(() =>
  chapterOptions.value.map((option, chapterIndex) => {
    const stages = stagesInZone.value.filter(stage => (stage.chapter ?? 1) === option.chapter)
    const nodes: ExplorationNode[] = stages.map((stage, index) => {
      const model = modelById.value.get(stage.id)
      const { x, y } = nodePosition(index)
      return {
        id: stage.id,
        label: String(model?.floor ?? stage.floor ?? stage.requiredRealmLevel ?? index + 1),
        x,
        y,
        state: nodeState(stage.id),
        boss: model?.isBossFloor ?? false,
        perfect: model?.state === 'perfect',
        enemy: model?.displayEnemy?.name,
      }
    })
    return {
      id: String(option.chapter),
      label: option.label,
      tone: TONES[chapterIndex % TONES.length]!,
      nodes,
      edges: nodes.slice(1).map((node, index) => ({ from: nodes[index]!.id, to: node.id })),
    }
  }),
)

const itemNames = new Map<string, string>()
for (const item of materials) {
  itemNames.set(item.id, item.name)
}
for (const item of equipment) {
  itemNames.set(item.id, item.name)
}

function rangeLabel(range: AmountRange): string {
  return range.min === range.max
    ? formatNumber(range.min)
    : `${formatNumber(range.min)}–${formatNumber(range.max)}`
}

function dropEntryLabel(entry: DropEntry): string {
  if (entry.kind === 'equipment_any') {
    return t(KIND_LABEL_KEYS['equipment_any'] ?? 'panels.stageSelect.rewards.kinds.equipmentAny')
  }
  const name = entry.itemId ? itemNames.get(entry.itemId) : undefined
  const label = name ?? t(KIND_LABEL_KEYS[entry.kind] ?? 'panels.stageSelect.rewards.kinds.material')
  return entry.amount ? `${label} ×${rangeLabel(entry.amount)}` : label
}

const paperStage = computed<ExplorationDetail | null>(() => {
  const stage = selectedStage.value
  if (!stage) {
    return null
  }
  const model = selectedModel.value
  const enemy = model?.displayEnemy
  const preview = model?.rewardPreview

  const rewards: { label: string; amount: string }[] = []
  if (preview) {
    rewards.push(
      { label: t('combat.rewards.spiritStone'), amount: rangeLabel(preview.spiritStone) },
      { label: t('combat.rewards.techniqueMastery'), amount: rangeLabel(preview.techniqueMastery) },
    )
    for (const entry of preview.guaranteed) {
      rewards.push({ label: dropEntryLabel(entry), amount: '' })
    }
    for (const entry of preview.poolItems) {
      rewards.push({ label: dropEntryLabel(entry), amount: '' })
    }
  }

  const floor = model?.floor ?? stage.floor ?? stage.requiredRealmLevel ?? 1
  const chapter = stage.chapter ?? 1
  // Same pair the old detail rail carried: the encounter count line is
  // always visible; the Boss name line is ADDITIONAL on boss floors.
  const enemySummary = `${stage.totalEnemyCount} ${t('panels.stageSelect.labels.enemiesSuffix')}`
  const bossLine = model?.isBossFloor && enemy ? `${t('panels.stageSelect.labels.bossNamePrefix')} ${enemy.name}` : ''
  const chapterLabel = selectedChapterLabel.value
  return {
    id: stage.id,
    title: `${chapter}-${floor} ${stage.name}`,
    chapter: chapterLabel
      ? `${t('panels.stageSelect.labels.chapterPrefix', { chapter })} · ${chapterLabel}`
      : chapterLabel,
    description: stage.description,
    state: nodeState(stage.id),
    stateLabel: t(`exploration.state.${nodeState(stage.id)}`),
    enemySummary: bossLine ? `${enemySummary} · ${bossLine}` : enemySummary,
    enemyLabel: enemy
      ? `${enemy.name}${enemy.level ? ` · ${t('panels.stageSelect.labels.levelPrefix', { level: enemy.level })}` : ''} · ${t(ARCHETYPE_LABEL_KEYS[enemy.archetype ?? 'melee'] ?? 'panels.stageSelect.archetypes.melee')}`
      : t('exploration.noEnemy'),
    rewards,
    disabledLabel: disabledReasonLabel(model?.disabledReason, t),
    modes: MODES.map(id => ({
      id,
      label: t(MODE_LABEL_KEYS[id]),
      active: mode.value === id,
      disabled: id === 'perfect_farm' && !isSelectedStagePerfectClear.value,
    })),
    modeHint: t(MODE_HINT_KEYS[mode.value]),
    buildLabel: t('panels.stageSelect.actions.editBuild'),
    startLabel: t('panels.stageSelect.actions.start'),
    startDisabled: !canStart.value,
  }
})

const paperZones = computed(() =>
  zones.value.map(zone => ({
    id: zone.id,
    label: zone.name,
    unlocked: isZoneUnlocked(zone.id),
  })),
)

const subtitle = computed(() => {
  const zone = selectedZone.value
  return zone?.requiredRealmId ? getCurrentRealm(zone.requiredRealmId).name : ''
})

const paperModel = computed<ExplorationPaperModel>(() => ({
  title: selectedZone.value?.name ?? t('exploration.title'),
  subtitle: subtitle.value,
  terrain: TERRAIN_SRC,
  zones: paperZones.value,
  zone: selectedZoneId.value ?? '',
  chapters: paperChapters.value,
  progress: zoneProgress.value.total > 0
    ? (zoneProgress.value.completed / zoneProgress.value.total) * 100
    : 0,
  progressLabel: `${zoneProgress.value.completed} / ${zoneProgress.value.total}`,
  armedFarm: armedFarmStage.value ? { stageName: armedFarmStage.value.name } : null,
  stopLabel: t('autoFarm.stop'),
}))
</script>

<template>
  <SceneDesignCanvas overlay>
    <ExplorationFidelityScene
      :model="paperModel"
      :stage="paperStage"
      :navigation="navItems"
      :notice="notice"
      @select="selectStage"
      @zone="selectZone"
      @navigate="navigate"
      @mode="pickMode"
      @stop-farm="stopAutoFarm"
      @open-build="openBuild"
      @start="start"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
