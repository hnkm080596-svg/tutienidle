<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import CombatTopBar from './CombatTopBar.vue'
import CombatStatusBar from './CombatStatusBar.vue'
import CombatEventBar from './CombatEventBar.vue'
import CombatControlBar from './CombatControlBar.vue'
import CombatResultModal from './CombatResultModal.vue'
import CombatCountdownOverlay from './CombatCountdownOverlay.vue'
import CombatAiPanel from './CombatAiPanel.vue'
import CombatBuildHud from './hud/CombatBuildHud.vue'
import { setCombatInsets } from '@/game/support/combatInsets'

// WS1 Responsive foundation (2026-08-24) — các bar giờ có chiều cao px
// THỰC theo clamp() (--combat-*-h trong theme.css), không còn đồng nhất
// tỷ lệ với canvas sau khi bỏ transform-scale toàn game. Vì vậy DOM là
// nguồn chân truth về khoảng reserved: đo chiều cao render thật của
// 4 bar rồi cấp xuống CombatScene qua setCombatInsets() (ResizeObserver
// theo dõi cả thay đổi viewport/DPI sau đó).
const rootRef = ref<HTMLElement | null>(null)

let insetsObserver: ResizeObserver | null = null

// Scoped style giữ nguyên tên class nên querySelector theo class hoạt
// động; dùng $el gián tiếp qua ref component sẽ mong manh hơn khi cấu
// trúc con của từng bar thay đổi.
function barHeight(root: HTMLElement, className: string): number {
  return root.querySelector<HTMLElement>(`:scope > .${className}`)?.offsetHeight ?? 0
}

function publishInsets() {
  const root = rootRef.value

  if (!root) {
    return
  }

  const top = barHeight(root, 'combat-scene-overlay__top-bar')
    + barHeight(root, 'combat-scene-overlay__status-bar')
  const bottom = barHeight(root, 'combat-scene-overlay__event-bar')
    + barHeight(root, 'combat-scene-overlay__control-bar')

  if (top > 0 || bottom > 0) {
    setCombatInsets({ top, bottom })
  }
}

onMounted(() => {
  void nextTick(publishInsets)

  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    insetsObserver = new ResizeObserver(() => publishInsets())
    insetsObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  insetsObserver?.disconnect()
  insetsObserver = null
})
</script>

<template>
  <!-- Combat UI Redesign mục 5/20 — thay TOÀN BỘ chrome Động Phủ
       (LeftPanel/TopBar/BottomBar/HomeBuildingIcons, xem GameRoot.vue).
       KHÔNG chứa canvas riêng — PhaserCanvas.vue vẫn là canvas Phaser
       DUY NHẤT của cả app (luôn mount trong MainScene.vue), CombatScene.ts
       tự vẽ battlefield NGAY DƯỚI các thanh này (khoảng reserved được
       cấp qua combatInsets — xem publishInsets() ở trên). Khoảng giữa
       (battlefield) để trống/pointer-events:none để canvas hiện xuyên
       qua và không chặn click. -->
  <div ref="rootRef" class="combat-scene-overlay">
    <CombatTopBar class="combat-scene-overlay__top-bar" />

    <CombatStatusBar class="combat-scene-overlay__status-bar" />

    <div class="combat-scene-overlay__battlefield">
      <!-- Combat AI panel (plan §11.1/§11.2) — góc TRÁI battlefield, lớp
           overlay riêng: chỉ panel nhận pointer events, không chặn canvas,
           không đổi insets/không làm co battlefield. -->
      <CombatAiPanel class="combat-scene-overlay__ai-panel" />

      <CombatBuildHud class="combat-scene-overlay__build-hud" />
    </div>

    <CombatEventBar class="combat-scene-overlay__event-bar" />

    <CombatControlBar class="combat-scene-overlay__control-bar" />

    <CombatResultModal />

    <CombatCountdownOverlay />
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
  flex: 0 0 auto;
  height: var(--combat-topbar-h);
}

.combat-scene-overlay__status-bar {
  flex: 0 0 auto;
  height: var(--combat-status-h);
  position: relative;
  z-index: 11;
}

.combat-scene-overlay__battlefield {
  position: relative;
  flex: 1 1 auto;
  pointer-events: none;
}

/* Combat AI panel (plan §11.1) — góc trái battlefield, dưới top/status
   bar (nằm trong vùng battlefield nên không đụng CombatTopBar). */
.combat-scene-overlay__ai-panel {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 12;
}

.combat-scene-overlay__build-hud {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 12;
}

.combat-scene-overlay__event-bar {
  flex: 0 0 auto;
  height: var(--combat-event-h);
}

.combat-scene-overlay__control-bar {
  flex: 0 0 auto;
  height: var(--combat-control-h);
}
</style>
