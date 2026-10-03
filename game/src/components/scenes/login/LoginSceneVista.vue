<script setup lang="ts">
// Scene 01 vista region (spec: vista 0/0/1672/941, z0). The delivered
// six-layer auth-creation parallax stack is the world backdrop; this
// component only anchors the region for fidelity gates.
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'
import { LOGIN_ART } from './loginArt'
</script>

<template>
  <div class="login-vista" data-hk-region="vista" aria-hidden="true">
    <HuyenKimParallaxStack stack="auth-creation">
      <template #foreground>
        <img class="login-vista__cultivator" :src="LOGIN_ART.cultivator" alt="" draggable="false" />
      </template>
    </HuyenKimParallaxStack>
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
