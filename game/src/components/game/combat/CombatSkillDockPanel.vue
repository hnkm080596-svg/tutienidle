<script setup lang="ts">
// Combat Art Pipeline (2026-09-05, spec §7.5) — skill UI moved out of the
// bottom-center battlefield slot into a right-edge dock, styled like
// RightPanel.vue's Động Phủ drawer but as a SEPARATE component (RightPanel
// is gated to !isCombatSceneActive, mutually exclusive with combat —
// GameRoot.vue:65). Unconditionally visible while fighting, no toggle.
//
// Insets: dock chỉ publish `right` (publishSkillDockWidth — giữ nguyên
// `top` của CombatSceneOverlay), cùng pattern đo-DOM-thật + ResizeObserver
// với overlay. Unmount: clear `right` về 0 nhưng giữ `top`.
//
// Layout fix (2026-09-06) — dock trước đó `top: 0` nên full-height, đè lên
// enemy counter mép phải của TopBar (TopBar và dock là 2 sibling absolute
// riêng, dock không nằm trong luồng flex của overlay). Đổi `top` sang
// `var(--combat-topbar-h)` — ĐÚNG token TopBar dùng để set height của nó
// (CombatSceneOverlay.vue, theme.css) — để dock bắt đầu ngay dưới TopBar
// thay vì đè lên. Không hardcode 60px dù TurnOrderStrip từng dùng số đó —
// token thật là clamp(46px, 4.8vh, 72px), 60px chỉ là xấp xỉ giữa dải.
// `bottom: 0` giữ nguyên nên height tự co theo top mới, không cần khai
// báo height tường minh. Không đổi `width`/measuring logic — publishWidth
// đo `offsetWidth` (chiều ngang), không phụ thuộc `top`.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import TurnCombatSkillBar from './hud/TurnCombatSkillBar.vue'
import CombatBuildHud from './hud/CombatBuildHud.vue'
import { clearSkillDockWidth, publishSkillDockWidth } from '@/game/support/combatInsets'

const rootRef = ref<HTMLElement | null>(null)
let observer: ResizeObserver | null = null

function publishWidth() {
  const width = rootRef.value?.offsetWidth ?? 0

  if (width > 0) {
    publishSkillDockWidth(width)
  }
}

onMounted(() => {
  void nextTick(publishWidth)

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(publishWidth)
    observer.observe(rootRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null

  clearSkillDockWidth()
})
</script>

<template>
  <aside ref="rootRef" class="combat-skill-dock-panel dark-drawer-fill">
    <CombatBuildHud />
    <TurnCombatSkillBar />
  </aside>
</template>

<style scoped>
.combat-skill-dock-panel {
  position: absolute;
  top: var(--combat-topbar-h);
  right: 0;
  bottom: 0;
  width: clamp(340px, 27vw, 440px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  overflow: hidden;
  border-left: 1px solid var(--frame-outer);
  box-shadow: var(--surface-shadow-deep);
  pointer-events: auto;
  z-index: 12;
}

@media (max-width: 900px) {
  .combat-skill-dock-panel {
    width: min(44vw, 400px);
  }
}
</style>
