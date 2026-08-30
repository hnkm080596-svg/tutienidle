<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BuildingBadgeStatus } from '@/composables/useBuildingNavigation'
import type {
  DongFuBuildingArtEntry,
  DongFuBuildingId,
} from '@/game/support/DongFuBuildingArt'
import { dongFuBuildingAssetUrls } from '@/game/support/DongFuBuildingArt'
import type { ThanhVanSeason, ThanhVanTime } from '@/game/support/ThanhVanArt'

const props = defineProps<{
  art: DongFuBuildingArtEntry
  status: BuildingBadgeStatus
  selected: boolean
  disabled: boolean
  season: ThanhVanSeason
  time: ThanhVanTime
  reducedMotion: boolean
}>()

const emit = defineEmits<{
  assetError: [buildingId: DongFuBuildingId]
}>()

const hasAssetError = ref(false)
const urls = computed(() => dongFuBuildingAssetUrls(props.art))
const isLocked = computed(() => props.status === 'locked')

const sourceStyle = computed(() => ({
  '--source-left': `${props.art.visualBounds.x / props.art.canvas.width * 100}%`,
  '--source-top': `${props.art.visualBounds.y / props.art.canvas.height * 100}%`,
  '--source-width': `${props.art.visualBounds.width / props.art.canvas.width * 100}%`,
  '--source-height': `${props.art.visualBounds.height / props.art.canvas.height * 100}%`,
}))

function reportAssetError(): void {
  hasAssetError.value = true
  emit('assetError', props.art.buildingId)
}
</script>

<template>
  <span
    class="dong-fu-building-sprite"
    :class="[
      `is-status-${status}`,
      `is-time-${time}`,
      `is-season-${season}`,
      {
        'is-locked': isLocked,
        'is-selected': selected,
        'is-disabled': disabled,
        'is-reduced-motion': reducedMotion,
        'has-hover-motion': !reducedMotion,
        'has-asset-error': hasAssetError,
      },
    ]"
    :style="sourceStyle"
    :data-building-id="art.buildingId"
    aria-hidden="true"
  >
    <span class="dong-fu-building-sprite__ring" />
    <span class="dong-fu-building-sprite__content">
      <img
        class="dong-fu-building-sprite__layer dong-fu-building-sprite__shadow"
        data-layer="ground-shadow"
        :src="urls.groundShadow"
        alt=""
        :draggable="false"
        @error="reportAssetError"
      >
      <img
        class="dong-fu-building-sprite__layer dong-fu-building-sprite__outline"
        data-layer="silhouette-mask"
        :src="urls.silhouetteMask"
        alt=""
        :draggable="false"
        @error="reportAssetError"
      >
      <img
        class="dong-fu-building-sprite__layer dong-fu-building-sprite__base"
        data-layer="base"
        :src="urls.base"
        alt=""
        :draggable="false"
        @error="reportAssetError"
      >
      <img
        class="dong-fu-building-sprite__layer dong-fu-building-sprite__locked"
        data-layer="locked-overlay"
        :src="urls.lockedOverlay"
        alt=""
        :draggable="false"
        :hidden="!isLocked"
        @error="reportAssetError"
      >
    </span>
  </span>
</template>

<style scoped>
.dong-fu-building-sprite {
  position: absolute;
  inset: 0;
  display: block;
  aspect-ratio: 1;
  pointer-events: none;
  user-select: none;
}

.dong-fu-building-sprite__content,
.dong-fu-building-sprite__layer,
.dong-fu-building-sprite__ring {
  position: absolute;
  inset: 0;
}

.dong-fu-building-sprite__content {
  transform: translateY(0);
  transform-origin: 50% var(--source-top);
  transition: filter 160ms ease, transform 180ms ease;
}

.dong-fu-building-sprite__layer {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dong-fu-building-sprite__shadow { z-index: 0; }
.dong-fu-building-sprite__base { z-index: 2; }
.dong-fu-building-sprite__outline {
  z-index: 1;
  opacity: 0;
  filter: sepia(1) saturate(2.1) hue-rotate(352deg) brightness(0.72) drop-shadow(0 0 3px rgba(183, 134, 45, 0.75));
  transform: scale(1.018);
  transform-origin: center;
  transition: opacity 150ms ease, filter 150ms ease;
}
.dong-fu-building-sprite__locked { z-index: 3; }

.dong-fu-building-sprite__ring {
  z-index: 0;
  left: 18%;
  right: 18%;
  top: 80%;
  bottom: 8%;
  border: 2px solid color-mix(in srgb, var(--gold-500) 72%, transparent);
  border-radius: 50%;
  box-shadow: 0 0 10px color-mix(in srgb, var(--gold-500) 35%, transparent);
  opacity: 0;
}

:global(.building-hotspot:hover) .dong-fu-building-sprite__outline,
:global(.building-hotspot:focus-visible) .dong-fu-building-sprite__outline,
.dong-fu-building-sprite.is-selected .dong-fu-building-sprite__outline {
  opacity: 0.34;
}

:global(.building-hotspot:hover) .dong-fu-building-sprite.has-hover-motion .dong-fu-building-sprite__content,
:global(.building-hotspot:focus-visible) .dong-fu-building-sprite.has-hover-motion .dong-fu-building-sprite__content {
  transform: translateY(-4px);
}

.dong-fu-building-sprite.is-selected .dong-fu-building-sprite__outline {
  opacity: 0.52;
  filter: sepia(1) saturate(2.5) hue-rotate(352deg) brightness(0.8);
}

.dong-fu-building-sprite.is-selected .dong-fu-building-sprite__ring { opacity: 0.68; }
.dong-fu-building-sprite.is-locked .dong-fu-building-sprite__base { filter: saturate(0.35) brightness(0.8); opacity: 0.42; }
.dong-fu-building-sprite.is-disabled .dong-fu-building-sprite__base,
.dong-fu-building-sprite.has-asset-error .dong-fu-building-sprite__base { opacity: 0.32; }

.dong-fu-building-sprite.is-time-noon .dong-fu-building-sprite__content { filter: brightness(1.04) saturate(0.96); }
.dong-fu-building-sprite.is-time-evening .dong-fu-building-sprite__content { filter: sepia(0.14) saturate(0.92) brightness(0.94); }
.dong-fu-building-sprite.is-time-night .dong-fu-building-sprite__content { filter: saturate(0.72) brightness(0.78) contrast(1.08) hue-rotate(8deg); }

.dong-fu-building-sprite.is-reduced-motion .dong-fu-building-sprite__content,
.dong-fu-building-sprite.is-reduced-motion .dong-fu-building-sprite__outline {
  transition: none;
}
</style>
