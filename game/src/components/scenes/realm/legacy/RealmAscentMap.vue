<script setup lang="ts">
// Scene 05 ascent-map region (spec: 288/176/812/610, z14, node family).
// The realm-ascent parallax vista IS the region's backdrop (delivered
// stable art, sized exactly 812x610); the Thien Lo track rides above it.
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'
import RealmAscentTrack from './RealmAscentTrack.vue'
import type { RealmPassiveNode } from '@/data/realm/RealmPassiveNodes'

defineProps<{
  nodes: readonly RealmPassiveNode[]
  currentTier: number
  nextTier: number | null
  pathProgress: number
  sealChar?: string
}>()
</script>

<template>
  <div class="realm-scene__ascent" data-hk-region="ascent-map">
    <HuyenKimParallaxStack stack="realm-ascent" />
    <RealmAscentTrack
      :nodes="nodes"
      :current-tier="currentTier"
      :next-tier="nextTier"
      :path-progress="pathProgress"
      :seal-char="sealChar"
    />
  </div>
</template>

<style scoped>
.realm-scene__ascent {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--hk-radius-md, 8px);
}
.realm-scene__ascent .hk-parallax-stack { z-index: 0; }
</style>
