<script setup lang="ts">
// Combat Art Pipeline (2026-09-05, spec S7.5) -- skill UI moved out of the
// bottom-center battlefield slot into a right-edge dock, styled like
// RightPanel.vue's Dong Phu drawer but as a SEPARATE component (RightPanel
// is gated to !isCombatSceneActive, mutually exclusive with combat --
// GameRoot.vue:65). Unconditionally visible while fighting, no toggle.
//
// Insets: dock chi publish `right` (publishSkillDockWidth -- giu nguyen
// `top` cua CombatSceneOverlay), cung pattern do-DOM-that + ResizeObserver
// voi overlay. Unmount: clear `right` ve 0 nhung giu `top`.
//
// Geometry ownership (2026-10-02): the CombatActionDock wrapper now carries
// the spec region (absolute, top 8.5vh, right edge, 7.89vw) so it no longer
// consumes the overlay's column flex space; this panel simply fills that
// wrapper (`position: relative; width: 100%`) and keeps its own 59.5vh
// content cap. publishWidth still reads the panel's real `offsetWidth`.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import TurnCombatSkillBar from './hud/TurnCombatSkillBar.vue'
import { clearSkillDockWidth, publishSkillDockWidth } from '@/presentation/geometry/combatInsets'

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
    <TurnCombatSkillBar />
  </aside>
</template>

<style scoped>
/* Spec 10 skill-dock 1540/80/132/560 on the 1672x941 canvas: the dock
   wrapper owns the region (absolute, flush right edge, canvas-top 8.5vh,
   7.89vw wide); this panel fills it and keeps the 59.5vh tall cap.
   The ResizeObserver publish keeps the scene's right inset in sync
   with the real width. */
.combat-skill-dock-panel {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-height: 59.5vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  overflow: hidden;
  border-left: 1px solid var(--frame-outer);
  border-bottom: 1px solid var(--frame-outer);
  border-bottom-left-radius: var(--radius-md, 8px);
  box-shadow: var(--surface-shadow-deep);
  pointer-events: auto;
  z-index: 12;
}
</style>
