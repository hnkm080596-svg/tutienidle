<script setup lang="ts">
import { computed } from 'vue'
import DongFuScene from './DongFuScene.vue'
import PhaserCanvas from './PhaserCanvas.vue'
import { useCombatSceneActive } from '@/composables/useCombatSceneActive'
import { useUiStore } from '@/stores/ui'

// Combat UI Redesign — bình thường chừa chỗ cho BottomBar (xem
// GameRoot.vue), nhưng lúc Combat Scene active thì BottomBar bị ẩn
// hẳn (CombatSceneOverlay.vue thay thế) — container này (chứa
// PhaserCanvas, tức toàn bộ canvas Phaser DUY NHẤT của cả app, xem
// PhaserCanvas.vue) phải giãn hết cỡ để CombatScene.ts có đủ không
// gian vẽ battlefield toàn màn hình.
//
// WS1 Responsive foundation (2026-08-24) — chiều cao chừa chỗ dùng
// var(--bottom-bar-h) (clamp px thực trong theme.css) thay cho hằng
// số design-frame; inline style với giá trị var() vẫn thắng mọi CSS
// class khác như cơ chế cũ.
const isCombatSceneActive = useCombatSceneActive()
const ui = useUiStore()

const bottomInset = computed(() => isCombatSceneActive.value || ui.isTribulationSceneActive ? '0px' : 'var(--bottom-bar-h)')
</script>

<template>
  <div class="main-scene" :style="{ bottom: bottomInset }">
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
