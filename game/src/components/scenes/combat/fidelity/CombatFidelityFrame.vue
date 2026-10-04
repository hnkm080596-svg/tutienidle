<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
withDefaults(defineProps<{ border?: number }>(), { border: 26 })
const source = resolveAssetUrl('/assets/ui/huyen-kim/scene/dong-fu-v2/panel-nine-slice.png')
</script>
<template><div class="combat-frame" :style="{ borderImageSource: `url('${source}')`, borderImageWidth: `${border}px` }"><slot /></div></template>
<style scoped>.combat-frame { border:0 solid transparent; border-image-slice:360 fill; border-image-repeat:stretch; filter:drop-shadow(0 4px 6px #0006); }</style>
