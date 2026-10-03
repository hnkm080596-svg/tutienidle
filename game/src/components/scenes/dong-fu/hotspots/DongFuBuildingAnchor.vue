<script setup lang="ts">
// One Dong Fu building hotspot (scene 03 spec `hotspot.<building>`): the
// anchored art square + invisible hitbox + layered building sprite +
// always-on nameplate. Pure presentation - the hotspots layer resolves
// all domain state and hands it down via props.
import type { Building } from '@/core/building/Building'
import type { BuildingBadgeStatus, BuildingPresentation } from '@/composables/useBuildingNavigation'
import type { BuildingTooltipContent } from '@/composables/useTooltip'
import type { DongFuBuildingArtEntry, DongFuBuildingId } from '@/presentation/background/DongFuBuildingArt'
import type { ThanhVanSeason, ThanhVanTime } from '@/presentation/background/BackgroundVariant'
import DongFuBuildingSprite from '@/components/game/DongFuBuildingSprite.vue'
import DongFuBuildingPlaque from './DongFuBuildingPlaque.vue'

defineProps<{
  art: DongFuBuildingArtEntry
  building: Building
  presentation: BuildingPresentation
  status: BuildingBadgeStatus
  selected: boolean
  assetErrored: boolean
  buttonAriaLabel: string
  tooltip: BuildingTooltipContent
  levelText: string
  plaqueUrl?: string
  season: ThanhVanSeason
  time: ThanhVanTime
  reducedMotion: boolean
  anchorStyle: Record<string, string | number>
}>()

const emit = defineEmits<{
  open: [buildingId: string]
  upgrade: [buildingId: string]
  assetError: [buildingId: DongFuBuildingId]
}>()
</script>

<template>
  <div
    class="building-hotspot-anchor"
    :class="{ 'has-asset-error': assetErrored }"
    :style="anchorStyle"
    :data-building-id="art.buildingId"
  >
    <button
      type="button"
      class="building-hotspot"
      :class="{
        'is-built': presentation.isBuilt,
        'is-upgradeable': presentation.isUpgradeable,
        'is-selected': selected,
      }"
      :aria-label="buttonAriaLabel"
      v-tooltip="tooltip"
      @click.stop="emit('open', building.id)"
    >
      <DongFuBuildingSprite
        :art="art"
        :status="status"
        :selected="selected"
        :disabled="false"
        :season="season"
        :time="time"
        :reduced-motion="reducedMotion"
        @asset-error="emit('assetError', $event)"
      />
      <span class="building-hotspot__hitbox" />
    </button>

    <DongFuBuildingPlaque
      :building-id="art.buildingId"
      :name="building.name"
      :status="status"
      :level-text="levelText"
      :plaque-url="plaqueUrl"
      @upgrade="emit('upgrade', $event)"
    />
  </div>
</template>

<style scoped>
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
</style>
