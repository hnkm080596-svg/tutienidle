<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Building } from '@/core/building/Building'
import { useGameManager } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import type { BuildingTooltipContent } from '@/composables/useTooltip'
import { useUiStore } from '@/stores/ui'
import {
  DONG_FU_BUILDING_ART,
  dongFuSeasonOverlayUrl,
  type DongFuBuildingArtEntry,
  type DongFuBuildingId,
} from '@/game/support/DongFuBuildingArt'
import type { ThanhVanVariant } from '@/game/support/ThanhVanArt'
import DongFuBuildingSprite from './DongFuBuildingSprite.vue'

interface SceneBuilding {
  art: DongFuBuildingArtEntry
  building: Building
}

const { variant } = defineProps<{
  variant: ThanhVanVariant
}>()

const gameManager = useGameManager()
const stageActive = useStageActive()
const navigation = useBuildingNavigation()
const ui = useUiStore()
const definitions = computed(() => gameManager.getBuildingDefinitions())
const reducedMotion = ref(false)
const assetErrors = ref<Set<DongFuBuildingId>>(new Set())

let reducedMotionQuery: MediaQueryList | undefined

const sceneBuildings = computed<SceneBuilding[]>(() =>
  DONG_FU_BUILDING_ART.flatMap((art) => {
    const building = definitions.value.find((entry) => entry.id === art.buildingId)
    return building ? [{ art, building }] : []
  }),
)
const seasonOverlayUrl = computed(() => dongFuSeasonOverlayUrl(variant.season))

function anchorStyle(entry: DongFuBuildingArtEntry) {
  return {
    left: `${entry.scenePlacement.xPercent}%`,
    top: `${entry.scenePlacement.yPercent}%`,
    width: `${entry.scenePlacement.scale * 100}%`,
    zIndex: entry.scenePlacement.zIndex,
    '--baseline-y': `${entry.baselineY / entry.canvas.height * 100}%`,
    '--baseline-offset': `${-entry.baselineY / entry.canvas.height * 100}%`,
    '--hit-left': `${entry.hitbox.x / entry.canvas.width * 100}%`,
    '--hit-top': `${entry.hitbox.y / entry.canvas.height * 100}%`,
    '--hit-width': `${entry.hitbox.width / entry.canvas.width * 100}%`,
    '--hit-height': `${entry.hitbox.height / entry.canvas.height * 100}%`,
  }
}

function presentationFor(buildingId: string) {
  return navigation.getBuildingPresentation(buildingId)
}

function statusFor(buildingId: string) {
  return navigation.getBuildingStatus(buildingId)
}

function isSelected(building: Building): boolean {
  return ui.activeBuildingPopoverId === building.id
    || (building.functionType !== undefined && ui.leftPanelMode === building.functionType)
}

function tooltipFor(building: Building): BuildingTooltipContent {
  const presentation = presentationFor(building.id)
  return {
    kind: 'building',
    name: building.name,
    functionLabel: building.description,
    statusLabel: presentation.isBuilt
      ? `Đã mở · Cấp ${presentation.level}/${building.maxLevel}`
      : 'Chưa mở · Nhấn để xem yêu cầu',
  }
}

function markAssetError(buildingId: DongFuBuildingId): void {
  assetErrors.value = new Set(assetErrors.value).add(buildingId)
}

function handleReducedMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reducedMotion.value = reducedMotionQuery?.matches ?? false
  reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange)
})

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange)
})
</script>

<template>
  <div v-if="!stageActive" class="home-building-hotspots">
    <div class="home-building-hotspots__art-space">
      <div
        v-for="scene in sceneBuildings"
        :key="scene.art.buildingId"
        class="building-hotspot-anchor"
        :class="{ 'has-asset-error': assetErrors.has(scene.art.buildingId) }"
        :style="anchorStyle(scene.art)"
        :data-building-id="scene.art.buildingId"
      >
        <button
          type="button"
          class="building-hotspot"
          :class="{
            'is-built': presentationFor(scene.building.id).isBuilt,
            'is-upgradeable': presentationFor(scene.building.id).isUpgradeable,
            'is-selected': isSelected(scene.building),
          }"
          :aria-label="presentationFor(scene.building.id).isBuilt
            ? `Mở ${scene.building.name}`
            : `Xem yêu cầu mở ${scene.building.name}`"
          v-tooltip="tooltipFor(scene.building)"
          @click.stop="navigation.openBuilding(scene.building.id)"
        >
          <DongFuBuildingSprite
            :art="scene.art"
            :status="statusFor(scene.building.id)"
            :selected="isSelected(scene.building)"
            :disabled="false"
            :season="variant.season"
            :time="variant.time"
            :reduced-motion="reducedMotion"
            @asset-error="markAssetError"
          />
          <span class="building-hotspot__hitbox" />
          <span class="building-hotspot__hover-label">
            {{ scene.building.name }}
            <small>{{ presentationFor(scene.building.id).isBuilt
              ? `Cấp ${presentationFor(scene.building.id).level}`
              : 'Chưa mở' }}</small>
          </span>
        </button>

        <span
          class="building-nameplate"
          :class="`building-nameplate--${statusFor(scene.building.id)}`"
          aria-hidden="true"
        >
          <span v-if="statusFor(scene.building.id) === 'locked'" class="building-nameplate__lock" />
          <span v-else-if="statusFor(scene.building.id) === 'ready'" class="building-nameplate__ready" />
          <span v-else-if="statusFor(scene.building.id) === 'active'" class="building-nameplate__active" />
          <span v-else-if="statusFor(scene.building.id) === 'upgradeable'" class="building-nameplate__upgradeable" />
          <span class="building-nameplate__text">{{ scene.building.name }}</span>
        </span>
      </div>

      <img
        class="home-building-hotspots__season-overlay"
        :src="seasonOverlayUrl"
        :data-season="variant.season"
        alt=""
        draggable="false"
        aria-hidden="true"
      >
    </div>
  </div>
</template>

<style scoped>
.home-building-hotspots {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  overflow: hidden;
  pointer-events: none;
}

.home-building-hotspots__art-space {
  position: relative;
  aspect-ratio: 1672 / 941;
  min-width: 100%;
  min-height: 100%;
  pointer-events: none;
}

.building-hotspot-anchor {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, var(--baseline-offset));
  pointer-events: none;
}

.building-hotspot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--paper-text);
  pointer-events: none;
  -webkit-tap-highlight-color: transparent;
}

.building-hotspot__hitbox {
  position: absolute;
  left: var(--hit-left);
  top: var(--hit-top);
  width: var(--hit-width);
  height: var(--hit-height);
  cursor: pointer;
  pointer-events: auto;
}

.building-hotspot:focus-visible { outline: none; }
.building-hotspot:focus-visible .building-hotspot__hitbox {
  outline: 2px solid var(--gold-500);
  outline-offset: 3px;
  border-radius: 42%;
}

.building-hotspot__hover-label {
  position: absolute;
  left: 50%;
  top: calc(var(--baseline-y) - 2px);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: max-content;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--gold-500) 55%, var(--frame-outer));
  border-radius: 999px;
  background: var(--paper-50);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  font: 600 var(--text-xs) var(--font-body);
  opacity: 0;
  transform: translate(-50%, 8px);
  transition: opacity 140ms ease, transform 160ms ease;
  pointer-events: none;
}

.building-hotspot__hover-label small {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
  font-weight: 400;
}

.building-hotspot:hover .building-hotspot__hover-label,
.building-hotspot:focus-visible .building-hotspot__hover-label {
  opacity: 1;
  transform: translate(-50%, 0);
}

.building-nameplate {
  position: absolute;
  left: 50%;
  top: var(--baseline-y);
  z-index: 6;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: max-content;
  max-width: 220%;
  padding: 2px 8px;
  border: 1px solid var(--frame-outer);
  border-radius: var(--radius-sm);
  background:
    var(--paper-grain) 0 0 / 100px 100px repeat,
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  color: var(--paper-text);
  font: 500 var(--text-xs) var(--font-body);
  line-height: var(--lh-tight);
  transform: translateX(-50%);
  pointer-events: none;
}

.building-nameplate__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.building-nameplate__lock {
  position: relative;
  flex: 0 0 auto;
  width: 0.58em;
  height: 0.5em;
  border: 1px solid currentColor;
  border-radius: 2px;
}
.building-nameplate__lock::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -0.55em;
  width: 0.36em;
  height: 0.55em;
  border: 1px solid currentColor;
  border-bottom: 0;
  border-radius: 0.36em 0.36em 0 0;
  transform: translateX(-50%);
}
.building-nameplate__ready,
.building-nameplate__active,
.building-nameplate__upgradeable {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.building-nameplate--locked { color: var(--paper-text-muted); opacity: 0.85; }
.building-nameplate--locked .building-nameplate__lock { border-color: var(--paper-text-muted); }
.building-nameplate--ready { color: var(--jade-on-paper, var(--jade)); }
.building-nameplate--ready .building-nameplate__ready { background: var(--jade); box-shadow: 0 0 6px var(--jade); }
.building-nameplate--active { color: var(--el-fire); }
.building-nameplate--active .building-nameplate__active { background: var(--el-fire); box-shadow: 0 0 6px var(--el-fire); }
.building-nameplate--upgradeable { color: var(--gold-700-on-paper, var(--mineral-gold)); }
.building-nameplate--upgradeable .building-nameplate__upgradeable { background: var(--gold-500); box-shadow: 0 0 6px var(--gold-500); }

.home-building-hotspots__season-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .building-hotspot__hover-label { transition: none; }
}
</style>
