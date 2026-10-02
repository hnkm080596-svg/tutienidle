<script setup lang="ts">
// Thám Hiểm (2026-08-14) — màn hình chọn màn trước khi chiến đấu.
// Scene 09 (Huyen Kim) scaffold: presentation decomposes into
// components/scenes/exploration/* — this panel keeps ALL selection
// logic and feeds children the canonical read-models
// (getStageSurfaceModels: state, boss, displayEnemy, rewardPreview,
// disabledReason — frontend-contract §7 DO-NOT-DERIVE).
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type BattleRunMode } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { ASSET_BUNDLE_MANAGER_KEY } from '@/presentation/PresentationContracts'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { useAudioStore } from '@/stores/audio'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import ExplorationChapterTabs from '@/components/scenes/exploration/ExplorationChapterTabs.vue'
import ExplorationZoneRail from '@/components/scenes/exploration/ExplorationZoneRail.vue'
import ExplorationMapPanel from '@/components/scenes/exploration/ExplorationMapPanel.vue'
import ExplorationChapterBand from '@/components/scenes/exploration/ExplorationChapterBand.vue'
import ExplorationDetailPanel from '@/components/scenes/exploration/ExplorationDetailPanel.vue'
import ExplorationProgressFooter from '@/components/scenes/exploration/ExplorationProgressFooter.vue'

// RESERVED slot (audit): the zone rail is not in ref 09 - flip this when
// the rail is implemented so the workspace grid gains its column.
const ZONE_RAIL_VISIBLE = false

// exploration-map-chrome-kit (stable art): frame around the map panel,
// chapter divider under the title, soft-edge mask on the scroll region.
// Geography/routes/stage marks stay runtime-owned - the kit is chrome only.
const MAP_FRAME_SRC = stableSceneArtUrl('exploration-map-frame', '@2x')
const MAP_MASK_SRC = stableSceneArtUrl('exploration-map-mask', '@2x')
const CHAPTER_DIVIDER_SRC = stableSceneArtUrl('exploration-chapter-divider', '@2x')
const bossSealUrl = hkChromeUrl('boss-seal')

const { t } = useI18n()

const player = usePlayerStore()
const ui = useUiStore()
const gameManager = useGameManager()
const { startSelectedStage } = useBattleActions()
const assetManager = inject(ASSET_BUNDLE_MANAGER_KEY, null)

onMounted(() => {
  assetManager?.prefetch(['combat']).catch(() => {})
})

// Combat UI Redesign mục 4/15 — Chọn Ải là nơi DUY NHẤT cấu hình Auto
// Battle TRƯỚC trận (Combat Scene giờ chiếm toàn màn hình, không còn
// BottomBar/BattleControls hiện ĐƯỢC nữa trong lúc combat để bật/tắt
// giữa chừng) và shortcut để chỉnh Build — KHÔNG dựng Build UI riêng,
// chỉ deep-link. Trước trỏ vào tab Tâm Pháp của LoadoutManager.vue (đã
// xoá); giờ mở thẳng SkillPathPanel.vue (2026-08-20) — quyết định build
// THẬT SỰ (chọn skill/node) nằm ở đó, Tâm Pháp giờ chỉ đọc, không còn
// gì để "chỉnh".
function openBuild() {
  ui.standalonePanel = 'skill'
}

const zones = computed(() => gameManager.zoneRegistry.getAll())

// Canonical stage read-models (contract §7) — the list consumes
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
const selectedChapter = ref<number>(stagesInZone.value[0]?.chapter ?? 1)

const mapPanel = ref<InstanceType<typeof ExplorationMapPanel> | null>(null)

// Auto-farm B5 — armed state is player state (survives reload), so the
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

// Ref map renders every chapter band at once; the chips scroll to the
// band and re-pick its first unlocked stage.
const chapterBands = computed(() =>
  chapterOptions.value.map(option => ({
    ...option,
    stages: stagesInZone.value.filter(stage => (stage.chapter ?? 1) === option.chapter),
  })),
)

const selectedChapterLabel = computed(() =>
  chapterOptions.value.find(option => option.chapter === selectedChapter.value)?.label ?? '',
)

const visibleStages = computed(() =>
  stagesInZone.value.filter(stage => (stage.chapter ?? 1) === selectedChapter.value),
)

function selectFirstStageInChapter() {
  selectedStageId.value = visibleStages.value.find(stage => modelById.value.get(stage.id)?.state !== 'locked')?.id
    ?? visibleStages.value[0]?.id
    ?? null
}

// Đổi Địa Giới thì bỏ chọn Màn cũ (Màn thuộc Địa Giới trước, không còn
// hợp lệ ở Địa Giới mới).
// Đổi chapter.value → watcher bên dưới tự chọn lại stage (đúng 1 lần);
// chapter GIỮ NGUYÊN (đa số zone đều bắt đầu ở chapter 1) thì watcher
// đó không bắn, nên gọi trực tiếp ở đây để không rơi mất lần chọn lại.
watch(selectedZoneId, () => {
  const nextChapter = stagesInZone.value[0]?.chapter ?? 1

  if (selectedChapter.value === nextChapter) {
    selectFirstStageInChapter()
  } else {
    selectedChapter.value = nextChapter
  }
}, { immediate: true })

watch(selectedChapter, selectFirstStageInChapter)

const selectedStage = computed(() =>
  stagesInZone.value.find(stage => stage.id === selectedStageId.value) ?? null,
)

const selectedModel = computed(() =>
  selectedStageId.value ? modelById.value.get(selectedStageId.value) : undefined,
)

// Ref footer: zone completion bar - "Tien Do Tham Hiem {done}/{total}".
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
// writer of selectedStageId (selectStage click, zone/chapter re-pick)
// funnels through this watcher, so one reset covers all paths.
watch(selectedStageId, () => {
  mode.value = 'manual'
})

// Auto-farm Task 6 — chip thứ 4 chỉ bật khi stage đang chọn đã Hoàn Mỹ.
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

function selectChapter(chapter: number) {
  selectedChapter.value = chapter
  void nextTick(() => mapPanel.value?.scrollToChapter(chapter))
}

function selectStage(stageId: string) {
  selectedStageId.value = stageId
}

function start() {
  if (!selectedZone.value || !selectedStage.value || !canStart.value) {
    return
  }

  // Auto-farm Task 6 (2026-09-04) — perfect_farm KHÔNG start trận thật:
  // gọi startAutoFarm trực tiếp (roll reward theo wall-clock, không
  // hoạt ảnh) — khác mọi mode khác đều qua startSelectedStage.
  if (mode.value === 'perfect_farm') {
    // Only close on an accepted start - a refused start (slot held by a
    // running farm, missing perfect clear) keeps the panel open so the
    // failure is visible instead of silent (partial T4-38).
    if (gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player.$state, selectedStage.value.id)) {
      useAudioStore().cue('farm.arm')
      ui.leftPanelMode = null
    } else {
      useAudioStore().cue('ui.error')
    }
    return
  }

  void startSelectedStage(selectedZone.value.id, selectedStage.value, mode.value)
}
</script>

<template>
  <BuildingConstructionGate building-id="teleport_array">
  <div class="stage-select-shell">
    <div class="stage-select">
      <ExplorationChapterTabs
        :zones="zones"
        :selected-zone-id="selectedZoneId"
        :is-zone-unlocked="isZoneUnlocked"
        :chapter-options="chapterOptions"
        :selected-chapter="selectedChapter"
        @select-zone="selectZone"
        @select-chapter="selectChapter"
      />

      <div class="stage-select__workspace" :class="{ 'stage-select__workspace--rail': ZONE_RAIL_VISIBLE }">
        <!-- zone-rail: RESERVED architecture slot (audit) - renders nothing. -->
        <ExplorationZoneRail :visible="ZONE_RAIL_VISIBLE" />

        <ExplorationMapPanel
          ref="mapPanel"
          :zone-name="selectedZone?.name ?? ''"
          :frame-src="MAP_FRAME_SRC"
          :divider-src="CHAPTER_DIVIDER_SRC"
          :mask-src="MAP_MASK_SRC"
          :has-stages="stagesInZone.length > 0"
        >
          <ExplorationChapterBand
            v-for="band in chapterBands"
            :key="band.chapter"
            :chapter="band.chapter"
            :label="band.label"
            :stages="band.stages"
            :models="modelById"
            :selected-stage-id="selectedStageId"
            :boss-seal-url="bossSealUrl"
            @select-stage="selectStage"
          />
        </ExplorationMapPanel>

        <ExplorationDetailPanel
          :stage="selectedStage"
          :model="selectedModel"
          :chapter-label="selectedChapterLabel"
          :armed-farm-stage-name="armedFarmStage?.name ?? null"
          :mode="mode"
          :perfect-clear="isSelectedStagePerfectClear"
          :can-start="canStart"
          @stop-farm="stopAutoFarm"
          @open-build="openBuild"
          @start="start"
          @update:mode="mode = $event"
        />
      </div>

      <ExplorationProgressFooter
        :zone-name="selectedZone?.name ?? ''"
        :completed="zoneProgress.completed"
        :total="zoneProgress.total"
      />
    </div>
  </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.stage-select-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(circle at 70% 0, color-mix(in srgb, var(--scene-portal-glow) 10%, transparent), transparent 40%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 60%, var(--paper-200) 100%);
}

.stage-select {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  font-family: var(--font-body);
  color: var(--paper-text);
}

.stage-select__workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(290px, .75fr);
}

/* RESERVED rail column appears only when the slot is enabled. */
.stage-select__workspace--rail {
  grid-template-columns: auto minmax(0, 1.25fr) minmax(290px, .75fr);
}

/* Fit-refactor đợt 2 — đo theo CARD (overlay-panel container), không còn
   viewport; scene clamp tự co nên bỏ flex-basis override. */
@container overlay-panel (max-width: 900px) {
  .stage-select__workspace { display: flex; flex-direction: column; }
  .stage-select__detail { min-height: 360px; }
}
</style>
