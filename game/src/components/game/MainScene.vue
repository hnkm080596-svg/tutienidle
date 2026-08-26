<script setup lang="ts">
import DongFuScene from './DongFuScene.vue'
import PhaserCanvas from './PhaserCanvas.vue'

// Command-wheel plan (2026-08-26) — không còn BottomBar nên home dùng
// trọn viewport (bottom: 0). Combat Scene vẫn là full-screen overlay
// độc lập; canvas Phaser luôn chiếm TOÀN container.
</script>

<template>
  <div class="main-scene">
    <!-- DongFuScene là overlay DOM position:absolute vẽ TRÊN container
         canvas (PhaserCanvas không set position → xếp dưới mọi phần tử
         positioned cùng stacking context). Canvas Phaser transparent
         nên điều này vô hại: lúc home, nền Động Phủ = art base PNG do
         CHÍNH DongFuScene mount (2026-08-26); lúc chiến đấu DongFuScene
         tự ẩn (useStageActive) nên CombatScene vẽ thoải mái. -->
    <DongFuScene />

    <PhaserCanvas />
  </div>
</template>

<style scoped>
.main-scene {
  position: absolute;
  inset: 0;
  background: #0b0b10;
}
</style>
