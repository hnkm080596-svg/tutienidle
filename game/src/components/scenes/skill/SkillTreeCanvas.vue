<script setup lang="ts">
// Scene 07 tree-canvas region (spec: 516/232/640/470, node family,
// dao-luan-node + rune-node). The region owns its own edge-fade frame;
// the parallax substrate (4 delivered 'skill-tree' layers), rung
// nodes and connecting edges stay inside NodeTreePanel.
</script>

<template>
  <div class="skill-scene__canvas" data-hk-region="tree-canvas">
    <slot />
  </div>
</template>

<style scoped>
.skill-scene__canvas {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}
</style>
