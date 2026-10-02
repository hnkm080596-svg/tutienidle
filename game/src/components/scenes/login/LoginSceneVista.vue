<script setup lang="ts">
// Scene 01 vista region (spec: vista 0/0/1672/941, z0). The delivered
// six-layer auth-creation parallax stack is the world backdrop; this
// component only anchors the region for fidelity gates.
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'
</script>

<template>
  <div class="login-vista" data-hk-region="vista" aria-hidden="true">
    <HuyenKimParallaxStack stack="auth-creation" />
  </div>
</template>

<style scoped>
.login-vista {
  position: absolute;
  inset: 0;
  z-index: 0;
}
</style>
