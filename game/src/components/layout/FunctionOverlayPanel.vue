<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'
import { useBuildingHeaderState } from '@/composables/useBuildingHeaderState'
import ProductionPanel from '@/components/panels/ProductionPanel.vue'
import SettingsPanel from '@/components/panels/SettingsPanel.vue'
import PillRoomPanel from '@/components/panels/PillRoomPanel.vue'
import EquipmentHallPanel from '@/components/panels/EquipmentHallPanel.vue'
import ScripturePavilionPanel from '@/components/panels/ScripturePavilionPanel.vue'
import StageSelectPanel from '@/components/panels/StageSelectPanel.vue'
import WorkerLodgePanel from '@/components/panels/WorkerLodgePanel.vue'
import VendorPanel from '@/components/panels/VendorPanel.vue'
import { useUiStore, type LeftPanelMode } from '@/stores/ui'
import { isBetaLeftPanelMode } from '@/core/betaScopeSurface'

const { t } = useI18n()

const ui = useUiStore()

type FunctionMode = Exclude<LeftPanelMode, 'character' | 'inventory' | null>

const TITLE_KEYS: Record<FunctionMode, string> = {
  exploration: 'layout.functionOverlay.titles.exploration',
  settings: 'layout.functionOverlay.titles.settings',
  equipment_hall: 'layout.functionOverlay.titles.equipment_hall',
  pill_room: 'layout.functionOverlay.titles.pill_room',
  worker_lodge: 'layout.functionOverlay.titles.worker_lodge',
  scripture_pavilion: 'layout.functionOverlay.titles.scripture_pavilion',
  stage_select: 'layout.functionOverlay.titles.stage_select',
  vendor: 'layout.functionOverlay.titles.vendor',
}

const BUILDINGS: Partial<Record<FunctionMode, string>> = {
  exploration: 'gathering_outpost',
  equipment_hall: 'equipment_hall',
  pill_room: 'pill_room',
  worker_lodge: 'chi_hien_quan',
  stage_select: 'teleport_array',
  vendor: 'vendor',
}

const mode = computed<FunctionMode | null>(() => {
  const value = ui.leftPanelMode
  // BETA SCOPE LOCK: mount-seam chokepoint - a scope-hidden mode never
  // mounts even when a caller bypasses ui.openLeftPanel and writes the
  // raw field (same defense the standalone-panel watcher carries).
  return value && isBetaLeftPanelMode(value) && value !== 'character' && value !== 'inventory'
    ? value
    : null
})

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
  <OverlayPanel
    :open="mode !== null"
    :title="mode ? t(TITLE_KEYS[mode]) : ''"
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

    <template v-if="header.template.value && header.instance.value" #header-actions>
      <div class="building-heading__upgrade-area">
        <GameButton
          v-if="header.hasNextLevel.value"
          class="building-heading__upgrade"
          size="sm"
          :disabled="!header.meetsRealmRequirement.value || !header.canAffordUpgrade.value"
          :title="!header.meetsRealmRequirement.value ? t('layout.functionOverlay.requiredRealm', { realm: header.requiredRealmName.value }) : header.upgradeCostLabel.value || t('layout.functionOverlay.noUpgradeCost')"
          @click="header.upgrade"
        >
          {{ t('layout.functionOverlay.upgrade') }}
        </GameButton>

        <small v-if="header.hasNextLevel.value" class="building-heading__cost">
          <template v-if="!header.meetsRealmRequirement.value">{{ t('layout.functionOverlay.requiredRealm', { realm: header.requiredRealmName.value }) }}</template>
          <template v-else-if="header.upgradeCostLabel.value">{{ header.upgradeCostLabel.value }}</template>
        </small>
      </div>
    </template>

    <div v-if="mode" class="function-overlay">
      <ProductionPanel v-if="mode === 'exploration'" />
      <SettingsPanel v-else-if="mode === 'settings'" />
      <PillRoomPanel v-else-if="mode === 'pill_room'" />
      <EquipmentHallPanel v-else-if="mode === 'equipment_hall'" />
      <WorkerLodgePanel v-else-if="mode === 'worker_lodge'" />
      <ScripturePavilionPanel v-else-if="mode === 'scripture_pavilion'" />
      <StageSelectPanel v-else-if="mode === 'stage_select'" />
      <VendorPanel v-else-if="mode === 'vendor'" />
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

.building-heading__upgrade-area { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }

.building-heading__upgrade:disabled {
  background: var(--ink-800);
  color: var(--surface-text-muted);
}

.building-heading__cost {
  text-align: right;
  color: var(--surface-text-muted);
  font-size: var(--text-xs);
}

@container overlay-panel (max-width: 640px) {
  .building-heading__upgrade-area { align-items: flex-start; }
  .building-heading__cost { text-align: left; }
}
</style>
