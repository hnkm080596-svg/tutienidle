<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import { useBuildingHeaderState } from '@/composables/useBuildingHeaderState'
import InventoryPanel from '@/components/panels/InventoryPanel.vue'
import CharacterSurface from '@/components/scenes/character/CharacterSurface.vue'
import ProductionPanel from '@/components/panels/ProductionPanel.vue'
import SettingsSurface from '@/components/scenes/settings/SettingsSurface.vue'
import PillRoomPanel from '@/components/panels/PillRoomPanel.vue'
import EquipmentHallPanel from '@/components/panels/EquipmentHallPanel.vue'
import ScripturePavilionPanel from '@/components/panels/ScripturePavilionPanel.vue'
import StageSelectPanel from '@/components/panels/StageSelectPanel.vue'
import WorkerLodgePanel from '@/components/panels/WorkerLodgePanel.vue'
import ArchitectureSurface from '@/components/scenes/architecture/ArchitectureSurface.vue'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { isBetaLeftPanelMode } from '@/core/betaScopeSurface'

const { t } = useI18n()

const ui = useUiStore()

type FunctionMode = Exclude<LeftPanelMode, 'character' | 'inventory' | null>

const TITLE_KEYS: Record<FunctionMode, string> = {
  exploration: 'layout.functionOverlay.titles.exploration',
  architecture: 'architecture.title',
  settings: 'layout.functionOverlay.titles.settings',
  equipment_hall: 'layout.functionOverlay.titles.equipment_hall',
  pill_room: 'layout.functionOverlay.titles.pill_room',
  worker_lodge: 'layout.functionOverlay.titles.worker_lodge',
  scripture_pavilion: 'layout.functionOverlay.titles.scripture_pavilion',
  stage_select: 'layout.functionOverlay.titles.stage_select',
}

// Modes whose fidelity surface owns the shared paper chrome on its own
// overlay design canvas - mounted outside the legacy shell.
const PAPER_MODES: ReadonlySet<FunctionMode> = new Set([
  'architecture',
  'stage_select',
  'pill_room',
  'equipment_hall',
  'settings',
  'exploration',
])

const BUILDINGS: Partial<Record<FunctionMode, string>> = {
  exploration: 'gathering_outpost',
  equipment_hall: 'equipment_hall',
  pill_room: 'pill_room',
  worker_lodge: 'chi_hien_quan',
  stage_select: 'teleport_array',
}

const mode = computed<FunctionMode | null>(() => {
  const value = ui.leftPanelMode
  // BETA SCOPE LOCK: mount-seam chokepoint - a scope-hidden mode never
  // mounts even when a caller bypasses ui.openLeftPanel and writes the
  // raw field (same defense the standalone-panel watcher carries).
  return value && value !== 'worker_lodge' && isBetaLeftPanelMode(value) && value !== 'character' && value !== 'inventory'
    ? value
    : null
})

const paperMode = computed<FunctionMode | null>(() =>
  mode.value && PAPER_MODES.has(mode.value) ? mode.value : null,
)
const legacyMode = computed<FunctionMode | null>(() =>
  mode.value && !PAPER_MODES.has(mode.value) ? mode.value : null,
)

const buildingId = computed(() => (mode.value ? BUILDINGS[mode.value] : undefined))

const header = useBuildingHeaderState(buildingId)

// Header art 404 (e.g. a future building without a v2 bundle) hides the
// <img> instead of showing the browser's broken-image glyph on the
// cream placeholder. Re-mounts on path change reset the flag.
const artBroken = ref(false)

watch(header.artPath, () => {
  artBroken.value = false
})

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <!-- Scene 04/09/10/11/12/17 fidelity: character, inventory, stage_select,
       pill_room, equipment_hall, settings, architecture, and exploration
       own their paper chrome - they mount inside one shared transition
       governed by `ui.activeHomeSurface` (Slice 3.2). -->
  <Transition name="th-panel-swap">
    <CharacterSurface v-if="ui.activeHomeSurface === 'character'" />
    <InventoryPanel v-else-if="ui.activeHomeSurface === 'inventory'" />
    <StageSelectPanel v-else-if="paperMode === 'stage_select'" />
    <PillRoomPanel v-else-if="paperMode === 'pill_room'" />
    <EquipmentHallPanel v-else-if="paperMode === 'equipment_hall'" />
    <SettingsSurface v-else-if="paperMode === 'settings'" />
    <ArchitectureSurface v-else-if="paperMode === 'architecture'" />
    <ProductionPanel v-else-if="paperMode === 'exploration'" />
  </Transition>

  <!-- Legacy micro-overlay surfaces (not part of the scene redesign). -->
  <OverlayPanel
    :open="legacyMode !== null"
    :title="legacyMode ? t(TITLE_KEYS[legacyMode]) : ''"
    width="min(1120px, 94vw)"
    height="min(820px, 92vh)"
    data-testid="function-overlay-panel"
    @close="close"
  >
    <!-- Header building GOP LAM 1 (2026-08-30, bug report: 2 dai trung
         ten/cap) -- anh + Ten + Cap bom thang vao title bar OverlayPanel,
         nut Nang cap bom vao header-actions cung dai, KHONG con dai phu
         rieng ben duoi. -->
    <template v-if="header.template.value" #heading>
      <div class="building-heading">
        <img
          v-if="!artBroken"
          class="building-heading__art"
          :src="header.artPath.value"
          alt=""
          @error="artBroken = true"
        />
        <div class="building-heading__text">
          <p class="building-heading__name">{{ header.template.value.name }}</p>
          <small class="building-heading__level">{{ t('layout.functionOverlay.levelRange', { level: header.instance.value?.level ?? 0, max: header.template.value.maxLevel }) }}</small>
        </div>
      </div>
    </template>

    <div v-if="legacyMode" class="function-overlay">
      <WorkerLodgePanel v-if="legacyMode === 'worker_lodge'" />
      <ScripturePavilionPanel v-else-if="legacyMode === 'scripture_pavilion'" />
    </div>
  </OverlayPanel>
</template>

<style scoped>
.function-overlay { height: 100%; display: flex; flex-direction: column; }

.building-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.building-heading__art {
  flex: 0 0 auto;
  width: 44px;
  height: 38px;
  object-fit: cover;
  border: 1px solid var(--frame-outer);
  border-radius: 50% 50% var(--radius-sm) var(--radius-sm);
  background: var(--paper-200);
  filter: saturate(.9) contrast(1.08);
}

.building-heading__text { min-width: 0; }
/* Name/cost sit on the DARK ink header of OverlayPanel -- they must use
   the surface ramp, not the light-paper ramp (audit H4: --paper-text on
   the ink title bar rendered dark-on-dark). */
.building-heading__name { margin: 0; color: var(--surface-text); font: 700 var(--text-title) var(--font-display); letter-spacing: .06em; }
.building-heading__level { color: var(--jade); font-size: var(--text-sm); }

/* Unnamed container query: resolves against the imperial-scroll
   envelope in scene mounts and the overlay-panel card in legacy
   mounts - the named 'overlay-panel' container never exists inside
   the scene shell, so the name would silently disable this block. */
@container (max-width: 640px) {
  .building-heading__upgrade-area { align-items: flex-start; }
}
</style>
