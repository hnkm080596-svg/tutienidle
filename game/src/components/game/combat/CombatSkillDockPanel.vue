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
// Layout fix (2026-09-06) -- dock truoc do `top: 0` nen full-height, de len
// enemy counter mep phai cua TopBar (TopBar va dock la 2 sibling absolute
// rieng, dock khong nam trong luong flex cua overlay). Doi `top` sang
// `var(--combat-topbar-h)` -- DUNG token TopBar dung de set height cua no
// (CombatSceneOverlay.vue, theme.css) -- de dock bat dau ngay duoi TopBar
// thay vi de len. Khong hardcode 60px du TurnOrderStrip tung dung so do --
// token that la clamp(46px, 4.8vh, 72px), 60px chi la xap xi giua dai.
// `bottom: 0` giu nguyen nen height tu co theo top moi, khong can khai
// bao height tuong minh. Khong doi `width`/measuring logic -- publishWidth
// do `offsetWidth` (chieu ngang), khong phu thuoc `top`.
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
/* UI-audit fix (2026-09-28) -- the dock hugs its content instead of
   reserving a fixed 27-44vw column: the skill bar stacks vertically,
   so the panel is a compact top-right rail (auto width/height) and the
   overlay mounts it only while the battle is fighting. The ResizeObserver
   publish keeps the scene's right inset in sync with the real width. */
.combat-skill-dock-panel {
  position: absolute;
  top: var(--combat-topbar-h);
  right: 0;
  width: auto;
  max-width: 100vw;
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
