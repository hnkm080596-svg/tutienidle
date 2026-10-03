<script setup lang="ts">
// Compatibility shim - the Scene 03 building hotspot layer was
// decomposed into components/scenes/dong-fu/hotspots/ (see
// docs/design/art-requests/03-dong-fu.md). Props and fallthrough attrs
// (the ground-parallax style from the scene root) pass through
// unchanged.
import type { ThanhVanVariant } from '@/presentation/background/BackgroundVariant'
import DongFuBuildingHotspots from '@/components/scenes/dong-fu/hotspots/DongFuBuildingHotspots.vue'

defineProps<{
  variant: ThanhVanVariant
}>()
</script>

<template>
  <DongFuBuildingHotspots :variant="variant" />
</template>
