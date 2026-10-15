<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
defineProps<{ image?: string }>()
const ring = resolveAssetUrl('/assets/ui/huyen-kim/scene/combat-v2/ornament-ring-v1.png')
</script>
<template><span class="portrait"><img v-if="image" class="portrait-content" :src="image" alt="" draggable="false"><span v-else class="portrait-content"><slot /></span><img class="portrait-frame" :src="ring" alt="" draggable="false"></span></template>
<style scoped>.portrait { position:relative; display:block; width:100%; height:100%; aspect-ratio:1; }.portrait-content { position:absolute; inset:10%; width:80%; height:80%; border-radius:50%; object-fit:cover; background:#142321; }.portrait-frame { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }</style>
