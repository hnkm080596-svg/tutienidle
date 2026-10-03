<script setup lang="ts">
import DongFuStage from '@/components/scenes/dong-fu/DongFuStage.vue'
import PhaserCanvas from './PhaserCanvas.vue'

// Command-wheel plan (2026-08-26) — không còn BottomBar nên home dùng
// trọn viewport (bottom: 0). Combat Scene vẫn là full-screen overlay
// độc lập; canvas Phaser luôn chiếm TOÀN container.
</script>

<template>
  <div class="main-scene">
    <!-- DongFuStage is a position:fixed DOM overlay (SceneDesignCanvas)
         drawn ABOVE the canvas container (PhaserCanvas sets no position,
         so it stacks below every positioned sibling). The Phaser canvas
         is transparent so this is harmless: at home the Dong Fu vista is
         mounted by DongFuStage itself; in battle DongFuStage self-hides
         (useStageActive) so CombatScene draws unobstructed. -->
    <DongFuStage />

    <PhaserCanvas />
  </div>
</template>

<style scoped>
.main-scene {
  position: absolute;
  inset: 0;
  background: var(--ink-950);
}
</style>
