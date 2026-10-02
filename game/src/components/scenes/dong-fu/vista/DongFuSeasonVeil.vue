<script setup lang="ts">
// Seasonal veil painted over the building hotspots (scene 03 vista
// dressing): one PNG per Thanh Van season, faded to 50% so the bamboo
// frame stays decorative without hiding the Truyen Tong Tran hotspot.
import { computed } from 'vue'
import { dongFuSeasonOverlayUrl } from '@/presentation/background/DongFuBuildingArt'
import type { ThanhVanSeason } from '@/presentation/background/BackgroundVariant'

const props = defineProps<{
  season: ThanhVanSeason
}>()

const seasonOverlayUrl = computed(() => dongFuSeasonOverlayUrl(props.season))
</script>

<template>
  <img
    class="home-building-hotspots__season-overlay"
    :src="seasonOverlayUrl"
    :data-season="season"
    alt=""
    draggable="false"
    aria-hidden="true"
  >
</template>

<style scoped>
.home-building-hotspots__season-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  width: 100%;
  height: 100%;
  object-fit: fill;
  /* Giam 50% (2026-08-30, bug report: khung truc/la che building Truyen
     Tong Tran qua dam) - van giu khung trang tri, chi nhat bot. */
  opacity: 0.5;
  pointer-events: none;
}
</style>
