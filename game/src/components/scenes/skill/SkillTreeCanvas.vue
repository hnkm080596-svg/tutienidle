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
  /* Spec 07 tree-canvas band 516/232/640/470 -> 49.95vh fixed (the
     canvas must not grow/shrink with column content). */
  flex: 0 0 49.95vh;
  min-height: 0;
  position: relative;
}
/* With no element-tabs row above, the canvas is the column's first
   child and owes the 56 design-px headroom to its spec top at y232. */
.skill-scene__canvas:first-child {
  margin-top: 4.5vh;
}
</style>
