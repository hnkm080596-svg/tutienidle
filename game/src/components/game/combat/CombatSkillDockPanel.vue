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
  top: 0;
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
