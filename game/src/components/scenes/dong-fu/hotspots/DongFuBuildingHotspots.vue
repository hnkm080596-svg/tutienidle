<script setup lang="ts">
// Building hotspot layer (scene 03 spec `hotspot.<building>` family,
// canonical layer L3): a 16:9 "art space" matching the vista composition
// where each beta-scoped Dong Fu building is anchored at its spec
// placement, under the seasonal veil. Owns badge/status/tooltip
// resolution; each hotspot renders as a DongFuBuildingAnchor and the
// shared ground parallax reaches this layer through --parallax-x/y
// fallthrough style from the scene root.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Building } from '@/core/building/Building'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useStageActive } from '@/composables/useStageActive'
import { useBuildingNavigation } from '@/composables/useBuildingNavigation'
import type { BuildingTooltipContent } from '@/composables/useTooltip'
import { useUiStore } from '@/stores/ui'
import {
  DONG_FU_BUILDING_ART,
  type DongFuBuildingArtEntry,
  type DongFuBuildingId,
} from '@/presentation/background/DongFuBuildingArt'
import type { ThanhVanVariant } from '@/presentation/background/BackgroundVariant'
import { isBetaBuildingSurface } from '@/core/betaScopeSurface'
import { hkChromeUrl } from '@/ui/huyenKimChrome'
import DongFuBuildingAnchor from './DongFuBuildingAnchor.vue'
import DongFuSeasonVeil from '../vista/DongFuSeasonVeil.vue'

interface SceneBuilding {
  art: DongFuBuildingArtEntry
  building: Building
}

const { variant } = defineProps<{
  variant: ThanhVanVariant
}>()

const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const stageActive = useStageActive()
const navigation = useBuildingNavigation()
const ui = useUiStore()
const definitions = computed(() => gameManager.buildingOps.getBuildingDefinitions())
const reducedMotion = ref(false)
const assetErrors = ref<Set<DongFuBuildingId>>(new Set())

// Scene 03 spec: hotspots carry the building-plaque tag chrome.
const buildingPlaqueUrl = hkChromeUrl('building-plaque')

let reducedMotionQuery: MediaQueryList | undefined

// BETA SCOPE LOCK v2 (Phase-6): the hotspot layer consumes the
// canonical beta surface set - a scope-hidden building (chi_hien_quan)
// renders NO hotspot, nameplate or tooltip at all.
const sceneBuildings = computed<SceneBuilding[]>(() =>
  DONG_FU_BUILDING_ART.flatMap((art) => {
    if (!isBetaBuildingSurface(art.buildingId)) {
      return []
    }

    const building = definitions.value.find((entry) => entry.id === art.buildingId)
    return building ? [{ art, building }] : []
  }),
)

function anchorStyle(entry: DongFuBuildingArtEntry) {
  // The anchor is a square of side `scale` * 1672 design px in the art
  // space, top-left at (xPercent * 16.72 - s/2, yPercent * 9.41 -
  // baselineY/1254 * s) via the translate(-50%, baseline-offset) rule.
  // The hit span sizes in % OF THE ANCHOR SIDE, so the spec rect maps in
  // as (spec - anchorTopLeft) / s * 100 - the spec hotspot rect wins over
  // the measured canvas hitbox so the hit area covers the spec region.
  const anchorSide = entry.scenePlacement.scale * 1672
  const anchorLeft = entry.scenePlacement.xPercent * 16.72 - anchorSide / 2
  const anchorTop =
    entry.scenePlacement.yPercent * 9.41
    - (entry.baselineY / entry.canvas.height) * anchorSide
  const spec = entry.specRect

  return {
    left: `${entry.scenePlacement.xPercent}%`,
    top: `${entry.scenePlacement.yPercent}%`,
    width: `${entry.scenePlacement.scale * 100}%`,
    zIndex: entry.scenePlacement.zIndex,
    '--baseline-y': `${entry.baselineY / entry.canvas.height * 100}%`,
    '--baseline-offset': `${-entry.baselineY / entry.canvas.height * 100}%`,
    '--hit-left': `${(spec.x - anchorLeft) / anchorSide * 100}%`,
    '--hit-top': `${(spec.y - anchorTop) / anchorSide * 100}%`,
    '--hit-width': `${spec.width / anchorSide * 100}%`,
    '--hit-height': `${spec.height / anchorSide * 100}%`,
  }
}

// T4-31 - these run inside the template's tracked render, but the domain
// objects they read are not reactive. Reading stateVersion makes the
// badge/nameplate/tooltip re-derive on every game-state bump.
function presentationFor(buildingId: string) {
  stateVersion.value
  return navigation.getBuildingPresentation(buildingId)
}

function statusFor(buildingId: string) {
  stateVersion.value
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
      ? t('homeBuildings.status.built', { level: presentation.level, max: building.maxLevel })
      : t('homeBuildings.status.notBuilt'),
    isBuilt: presentation.isBuilt,
  }
}

function levelTextFor(building: Building) {
  const presentation = presentationFor(building.id)
  return presentation.isBuilt
    ? t('homeBuildings.level', { level: presentation.level })
    : t('homeBuildings.notBuilt')
}

function ariaLabelFor(building: Building) {
  return presentationFor(building.id).isBuilt
    ? t('homeBuildings.aria.open', { name: building.name })
    : t('homeBuildings.aria.viewRequirements', { name: building.name })
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
  <div v-if="!stageActive" class="home-building-hotspots" data-canonical-layer="L3">
    <div class="home-building-hotspots__art-space">
      <DongFuBuildingAnchor
        v-for="scene in sceneBuildings"
        :key="scene.art.buildingId"
        :art="scene.art"
        :building="scene.building"
        :presentation="presentationFor(scene.building.id)"
        :status="statusFor(scene.building.id)"
        :selected="isSelected(scene.building)"
        :asset-errored="assetErrors.has(scene.art.buildingId)"
        :button-aria-label="ariaLabelFor(scene.building)"
        :tooltip="tooltipFor(scene.building)"
        :level-text="levelTextFor(scene.building)"
        :plaque-url="buildingPlaqueUrl ?? undefined"
        :season="variant.season"
        :time="variant.time"
        :reduced-motion="reducedMotion"
        :anchor-style="anchorStyle(scene.art)"
        @open="navigation.openBuilding"
        @asset-error="markAssetError"
      />

      <DongFuSeasonVeil :season="variant.season" />
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

/* The art space matches the 1672x941 vista composition: anchored at the
   spec percentages, it always covers the layer (min-width/min-height on
   a centered grid) regardless of the viewport letterbox. */
.home-building-hotspots__art-space {
  position: relative;
  aspect-ratio: 1672 / 941;
  min-width: 100%;
  min-height: 100%;
  pointer-events: none;
}
</style>
