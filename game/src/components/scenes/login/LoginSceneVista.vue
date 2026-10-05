<script setup lang="ts">
// Scene 01 vista region (spec: vista 0/0/1672/941, z0). The delivered
// authored mountain painting is the backdrop; character art is reused.
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { LOGIN_ART } from './loginArt'
</script>

<template>
  <div class="login-vista" data-hk-region="vista" aria-hidden="true">
    <img class="login-world-vista" :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/opening-vista-warm-v1.png')" alt="">
    <img class="login-vista__cultivator" :src="LOGIN_ART.cultivator" alt="" draggable="false" />
  </div>
</template>

<style scoped>
.login-vista {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.login-vista__cultivator {
  position: absolute;
  left: 1%;
  top: 37%;
  width: 32%;
  height: auto;
  pointer-events: none;
  user-select: none;
}
</style>
