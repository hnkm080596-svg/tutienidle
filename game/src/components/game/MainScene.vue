<script setup lang="ts">
import DongFuStage from '@/components/scenes/dong-fu/DongFuStage.vue'
import PhaserCanvas from './PhaserCanvas.vue'

// Command-wheel plan (2026-08-26) - khong con BottomBar nen home dung
// tron viewport (bottom: 0). Combat Scene van la full-screen overlay
// doc lap; canvas Phaser luon chiem TOAN container.
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
