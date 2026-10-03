<script setup lang="ts">
import { computed } from 'vue'
import { DONG_FU_ART, frameMetadata } from './dongFuUi'
const props = withDefaults(defineProps<{ borderWidth?: number }>(), { borderWidth: 52 })
const artStyle = computed(() => ({
  borderImageSource: `url("${DONG_FU_ART.frame}")`,
  borderImageSlice: `${frameMetadata.slices.top} ${frameMetadata.slices.right} ${frameMetadata.slices.bottom} ${frameMetadata.slices.left} fill`,
  borderImageWidth: `${props.borderWidth}px`,
}))
</script>
<template><span class="df-art-frame" :style="artStyle" aria-hidden="true" /></template>
<style scoped>
.df-art-frame { position: absolute; inset: 0; border: 0 solid transparent; border-image-repeat: stretch; pointer-events: none; z-index: 0; }
</style>
