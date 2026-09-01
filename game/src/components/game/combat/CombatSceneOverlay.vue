<script setup lang="ts">
// 6A-T8 (2026-09-01, spec docs/superpowers/specs/2026-09-01-combat-scene-
// ui-redesign-design.md) — CombatSceneOverlay top-only: 3 bar DOM dưới
// (Status/Event/Control) rời DOM — HP/MP/Kiết + exit zone vào canvas
// (PlayerHudLayer T4/T5), floating text kill/heal (T2), confirm modal
// extract riêng (T6), slider/ult vào Build HUD (T7).
//
// Insets: chỉ TopBar còn là DOM chrome phía trên; publishInsets chỉ
// đo top (bottom luôn 0 từ T3).
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import CombatTopBar from './CombatTopBar.vue'
import CombatResultModal from './CombatResultModal.vue'
import CombatCountdownOverlay from './CombatCountdownOverlay.vue'
import CombatAiPanel from './CombatAiPanel.vue'
import CombatBuildHud from './hud/CombatBuildHud.vue'
import CombatExitConfirmModal from './CombatExitConfirmModal.vue'
import { resetCombatInsets, setCombatInsets } from '@/game/support/combatInsets'

const rootRef = ref<HTMLElement | null>(null)

let insetsObserver: ResizeObserver | null = null

// Chỉ TopBar — chrome DOM duy nhất còn lại phía trên canvas.
const BAR_CLASSES = ['combat-scene-overlay__top-bar']

function barHeight(root: HTMLElement, className: string): number {
  return root.querySelector<HTMLElement>(`:scope > .${className}`)?.offsetHeight ?? 0
}

function publishInsets() {
  const root = rootRef.value

  if (!root) {
    return
  }

  const top = barHeight(root, 'combat-scene-overlay__top-bar')

  if (top > 0) {
    setCombatInsets({ top, bottom: 0 })
  }
}

function observeBars() {
  const root = rootRef.value

  if (!root || !insetsObserver) {
    return
  }

  for (const className of [...BAR_CLASSES, 'combat-scene-overlay__battlefield']) {
    const element = root.querySelector<HTMLElement>(`:scope > .${className}`)

    if (element) {
      insetsObserver.observe(element)
    }
  }
}

onMounted(() => {
  void nextTick(publishInsets)

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    insetsObserver = new ResizeObserver(() => {
      observeBars()
      publishInsets()
    })

    observeBars()
  }
})

onBeforeUnmount(() => {
  resetCombatInsets()
})

onUnmounted(() => {
  insetsObserver?.disconnect()
  insetsObserver = null
})
</script>

<template>
  <!-- 6A — background chiến đấu là vùng giao diện chính; canvas Phaser
       duy nhất của app vẫn là PhaserCanvas.vue trong MainScene.vue.
       Overlay chỉ còn TopBar (thông tin zone/stage), 2 panel phụ
       (AI/Build HUD) và các modal. Bottom = full canvas. -->
  <div ref="rootRef" class="combat-scene-overlay">
    <CombatTopBar class="combat-scene-overlay__top-bar" />

    <div class="combat-scene-overlay__battlefield">
      <!-- Combat AI panel — góc TRÁI battlefield, chỉ panel nhận pointer. -->
      <CombatAiPanel class="combat-scene-overlay__ai-panel" />

      <!-- 6A-T7 — Build HUD bottom-center: route HUD + slider tu-luc +
           ult (từ ControlBar cũ). -->
      <CombatBuildHud class="combat-scene-overlay__build-hud" />
    </div>

    <!-- 6A-T6 — confirm thoát trận (scene exit zone → bridge event). -->
    <CombatExitConfirmModal />

    <CombatResultModal />

    <CombatCountdownOverlay />
  </div>
</template>
