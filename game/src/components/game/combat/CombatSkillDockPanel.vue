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
// ui-combat reskin (2026-10-04) -- the mock's bottom-right cluster is a
// tall ornate frame holding the attack/skill orbs (skill-dock at
// right:1.7vw top:~50vh width:9.7vw on the 1366x768 canvas). The dock now
// wears the surface-m-panel chrome instead of the flush drawer fill and
// anchors toward the lower right like the mock. The ResizeObserver
// publish is unchanged - it still feeds the scene's right inset with the
// real offsetWidth.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import TurnCombatSkillBar from './hud/TurnCombatSkillBar.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
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
  <aside ref="rootRef" class="combat-skill-dock-panel" data-hk-region="skill-dock">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />
    <TurnCombatSkillBar />
  </aside>
</template>

<style scoped>
/* ui-combat reskin (2026-10-04): mock anchors the framed orb dock at
   right:1.7vw / top:~50vh / width:9.7vw of the 1366x768 canvas. Ours
   holds up to three orbs plus the emblem, so it anchors by `bottom`
   (bottom-anchored = content height can never push the box past the
   viewport bottom) at the mock's right offset. The ResizeObserver
   publish keeps the scene's right inset in sync with the real width. */
.combat-skill-dock-panel {
  position: absolute;
  bottom: 4vh;
  right: 1.6vw;
  width: 9.73vw;
  min-width: 118px;
  max-width: 172px;
  max-height: 56vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  padding: 2.6vh 1.1vw 3.1vh;
  overflow: hidden;
  pointer-events: auto;
  z-index: 12;
  isolation: isolate;
}

/* InkNineSlice 'surface' renders at z-index 1 - contents need 2. */
.combat-skill-dock-panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}
</style>
