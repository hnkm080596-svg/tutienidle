<script setup lang="ts">
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const frame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/panel-frame-v2.png')
</script>
<template><div class="tribulation-frame" :style="{ borderImageSource: `url('${frame}')` }"><slot /></div></template>
<style scoped>.tribulation-frame { border:0 solid transparent; border-image-slice:360 fill; border-image-width:28px; border-image-repeat:stretch; filter:drop-shadow(0 5px 9px #0008); }</style>
