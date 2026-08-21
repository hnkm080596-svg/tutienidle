<script setup lang="ts">
// Combat UI Redesign — BattleControls.vue (Play/Pause/Auto) đã retire
// hẳn: Play/Pause giờ sống trong CombatControlBar.vue (chỉ hiện lúc
// Combat Scene active, thay hẳn BottomBar này — xem GameRoot.vue), Auto
// dời sang checkbox "Auto Battle" ở StageSelectPanel.vue (cấu hình
// TRƯỚC trận, đúng spec mục 15/19) — BottomBar chỉ còn hiện lúc Ở NHÀ
// (Động Phủ, không combat) nên không cần control chiến đấu nào nữa.
import DongFuQuickNav from './DongFuQuickNav.vue'
</script>

<template>
  <div class="bottom-bar">
    <DongFuQuickNav />
  </div>
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  background: var(--ink-950);
  border-top: 1px solid var(--ink-line);
  font-family: var(--font-body);
}
</style>
