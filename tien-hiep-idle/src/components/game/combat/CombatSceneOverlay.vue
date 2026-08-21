<script setup lang="ts">
import CombatTopBar from './CombatTopBar.vue'
import CombatStatusBar from './CombatStatusBar.vue'
import CombatEventBar from './CombatEventBar.vue'
import CombatControlBar from './CombatControlBar.vue'
import CombatResultModal from './CombatResultModal.vue'
import {
  COMBAT_TOP_BAR_HEIGHT,
  COMBAT_STATUS_BAR_HEIGHT,
  COMBAT_EVENT_BAR_HEIGHT,
  COMBAT_CONTROL_BAR_HEIGHT,
} from '@/core/ui/DesignFrame'

const topBarHeightPx = `${COMBAT_TOP_BAR_HEIGHT}px`
const statusBarHeightPx = `${COMBAT_STATUS_BAR_HEIGHT}px`
const eventBarHeightPx = `${COMBAT_EVENT_BAR_HEIGHT}px`
const controlBarHeightPx = `${COMBAT_CONTROL_BAR_HEIGHT}px`
</script>

<template>
  <!-- Combat UI Redesign mục 5/20 — thay TOÀN BỘ chrome Động Phủ
       (LeftPanel/TopBar/BottomBar/HomeBuildingIcons, xem GameRoot.vue).
       KHÔNG chứa canvas riêng — PhaserCanvas.vue vẫn là canvas Phaser
       DUY NHẤT của cả app (luôn mount trong MainScene.vue), CombatScene.ts
       tự vẽ battlefield NGAY DƯỚI các thanh này (xem
       CombatScene.ts's applyBattlefieldLayout — chừa đúng khoảng cách
       các hằng số COMBAT_*_HEIGHT bên dưới). Khoảng giữa (battlefield)
       để trống/pointer-events:none để canvas hiện xuyên qua và không
       chặn click. -->
  <div class="combat-scene-overlay">
    <CombatTopBar class="combat-scene-overlay__top-bar" />

    <CombatStatusBar class="combat-scene-overlay__status-bar" />

    <div class="combat-scene-overlay__battlefield" />

    <CombatEventBar class="combat-scene-overlay__event-bar" />

    <CombatControlBar class="combat-scene-overlay__control-bar" />

    <CombatResultModal />
  </div>
</template>

<style scoped>
.combat-scene-overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  font-family: var(--font-body);
}

.combat-scene-overlay__top-bar {
  flex: 0 0 v-bind(topBarHeightPx);
}

.combat-scene-overlay__status-bar {
  flex: 0 0 v-bind(statusBarHeightPx);
}

.combat-scene-overlay__battlefield {
  flex: 1 1 auto;
  pointer-events: none;
}

.combat-scene-overlay__event-bar {
  flex: 0 0 v-bind(eventBarHeightPx);
}

.combat-scene-overlay__control-bar {
  flex: 0 0 v-bind(controlBarHeightPx);
}
</style>
