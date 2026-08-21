<script setup lang="ts">
import { computed } from 'vue'
import DongFuScene from './DongFuScene.vue'
import PhaserCanvas from './PhaserCanvas.vue'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'
import { BOTTOM_BAR_HEIGHT } from '@/core/ui/DesignFrame'

// Combat UI Redesign — bình thường chừa chỗ cho BottomBar (xem
// GameRoot.vue), nhưng lúc Combat Scene active thì BottomBar bị ẩn
// hẳn (CombatSceneOverlay.vue thay thế) — container này (chứa
// PhaserCanvas, tức toàn bộ canvas Phaser DUY NHẤT của cả app, xem
// PhaserCanvas.vue) phải giãn hết cỡ để CombatScene.ts có đủ không
// gian vẽ battlefield toàn màn hình. Set qua inline style (thắng mọi
// CSS class khác) thay vì phụ thuộc thứ tự cascade giữa scoped style
// của component này với class "game-root__scene" GameRoot.vue truyền
// vào — rõ ràng, không mơ hồ.
const isCombatSceneActive = useCombatSceneActive()

const bottomInsetPx = computed(() => `${isCombatSceneActive.value ? 0 : BOTTOM_BAR_HEIGHT}px`)
</script>

<template>
  <div class="main-scene" :style="{ bottom: bottomInsetPx }">
    <!-- DongFuScene (UI redesign) đứng SAU PhaserCanvas trong z-order —
         PhaserCanvas transparent:true (xem PhaserCanvas.vue), lúc
         chiến đấu vẽ đè lên; lúc không chiến đấu PhaserCanvas không vẽ
         gì, nền Động Phủ hiện qua khoảng trống. DongFuScene tự ẩn khi
         stageActive (useStageActive()) nên không cần thêm điều kiện gì
         ở đây. -->
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
