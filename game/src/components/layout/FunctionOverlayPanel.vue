<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
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

// Huyen Kim rebuild: these left-panel modes are imperial-scroll scenes
// (layout spec scenes 10/11/12/17). Vendor + scripture pavilion stay on
// the legacy micro-overlay shell until their own redesign lands.
const IMPERIAL_MODES: ReadonlySet<FunctionMode> = new Set([
  'stage_select',
  'pill_room',
  'equipment_hall',
  'exploration',
  'settings',
])

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

const imperialMode = computed<FunctionMode | null>(() =>
  mode.value && IMPERIAL_MODES.has(mode.value) ? mode.value : null,
)
const legacyMode = computed<FunctionMode | null>(() =>
  mode.value && !IMPERIAL_MODES.has(mode.value) ? mode.value : null,
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
  <!-- Scene 10/11/12 fidelity: stage_select + pill_room + equipment_hall
       own their paper chrome (Son Ha Do / Luyen Dan / Khi Duong scene) -
       they mount outside the imperial scroll while keeping the same
       mode/beta-gate/close contract. -->
  <StageSelectPanel v-if="imperialMode === 'stage_select'" />
  <PillRoomPanel v-else-if="imperialMode === 'pill_room'" />
  <EquipmentHallPanel v-else-if="imperialMode === 'equipment_hall'" />

  <!-- Imperial scroll scenes: Cai Dat. -->
  <ImperialScrollScene
    :open="imperialMode !== null && imperialMode !== 'stage_select' && imperialMode !== 'pill_room' && imperialMode !== 'equipment_hall'"
    :title="imperialMode && imperialMode !== 'stage_select' && imperialMode !== 'pill_room' && imperialMode !== 'equipment_hall' ? t(TITLE_KEYS[imperialMode]) : ''"
    :scene="imperialMode ?? undefined"
    data-testid="function-overlay-panel"
    @close="close"
  >
    <!-- Building identity + upgrade keep their canonical behavior; the
         scroll's header band replaces the old modal title row. -->
    <template v-if="header.template.value" #header>
      <div class="building-heading building-heading--imperial">
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
        <div v-if="header.instance.value" class="building-heading__upgrade-area">
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
      </div>
    </template>

    <div v-if="imperialMode" class="function-overlay">
      <SettingsPanel v-if="imperialMode === 'settings'" />
      <ProductionPanel v-else-if="imperialMode === 'exploration'" />
    </div>
  </ImperialScrollScene>

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

    <div v-if="legacyMode" class="function-overlay">
      <WorkerLodgePanel v-if="legacyMode === 'worker_lodge'" />
      <ScripturePavilionPanel v-else-if="legacyMode === 'scripture_pavilion'" />
      <VendorPanel v-else-if="legacyMode === 'vendor'" />
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

.building-heading--imperial {
  justify-content: space-between;
  padding: 0 4px;
}
/* The imperial scroll interior is PALE paper - the on-dark ramp used by
   OverlayPanel's ink header would render the name as washed-out glyphs
   (audit: "Truyen Tong Tran" read as clipped text). Use the paper ramp. */
.building-heading--imperial .building-heading__name { color: var(--paper-text); }
.building-heading--imperial .building-heading__level { color: color-mix(in srgb, var(--hk-gold, var(--jade)) 55%, var(--paper-text)); }
.building-heading--imperial .building-heading__text { margin-right: auto; }
.building-heading--imperial .building-heading__upgrade-area { flex-direction: row; align-items: center; gap: 10px; }

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

/* Unnamed container query: resolves against the imperial-scroll
   envelope in scene mounts and the overlay-panel card in legacy
   mounts - the named 'overlay-panel' container never exists inside
   the scene shell, so the name would silently disable this block. */
@container (max-width: 640px) {
  .building-heading__upgrade-area { align-items: flex-start; }
  .building-heading__cost { text-align: left; }
}
</style>
