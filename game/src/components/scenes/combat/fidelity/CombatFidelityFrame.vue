<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
withDefaults(defineProps<{ border?: number }>(), { border: 26 })
const source = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png')
</script>
<template><div class="combat-frame" :style="{ borderImageSource: `url('${source}')`, borderImageWidth: `${border}px` }"><slot /></div></template>
<style scoped>.combat-frame { border:0 solid transparent; border-image-slice:360 fill; border-image-repeat:stretch; filter:drop-shadow(0 4px 6px #0006); }</style>
