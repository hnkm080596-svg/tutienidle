<script setup lang="ts">
// 6A-T8 (2026-09-01, spec docs/superpowers/specs/2026-09-01-combat-scene-
// ui-redesign-design.md) — CombatSceneOverlay top-only: 3 bar DOM dưới
// (Status/Event/Control) rời DOM — HP/MP/Kiết + exit zone vào canvas
// (PlayerHudLayer T4/T5), floating text kill/heal (T2), confirm modal
// extract riêng (T6), slider/ult vào Build HUD (T7).
//
// Insets: chỉ TopBar còn là DOM chrome phía trên; publishInsets chỉ
// đo top (bottom luôn 0 từ T3).
//
// Combat Art Pipeline Task 7 (2026-09-05, spec §7.5) — Build HUD +
// TurnCombatSkillBar rời battlefield slot vào CombatSkillDockPanel
// (dock mép phải, publish `right` riêng). Overlay này giờ chỉ publish
// `top` (publishTopBarHeight — giữ nguyên `right` của dock), không còn
// giữ import cho 2 component đã dời.
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import CombatTopBar from './CombatTopBar.vue'
import CombatResultModal from './CombatResultModal.vue'
import CombatCountdownOverlay from './CombatCountdownOverlay.vue'
import CombatIntroOverlay from './CombatIntroOverlay.vue'
import CombatAiPanel from './CombatAiPanel.vue'
import CombatSkillDockPanel from './CombatSkillDockPanel.vue'
import TurnOrderStrip from './TurnOrderStrip.vue'
import BattleLogPanel from './BattleLogPanel.vue'
import CombatExitConfirmModal from './CombatExitConfirmModal.vue'
import { publishTopBarHeight, resetCombatInsets } from '@/game/support/combatInsets'

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
    // Chỉ ghi `top` (publishTopBarHeight giữ `right` của dock) — setCombatInsets
    // thô ghi đè cả 3 trường, sẽ xóa width dock vừa publish.
    publishTopBarHeight(top)
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
  insetsObserver?.disconnect()
  insetsObserver = null
})

onUnmounted(() => {
  // onUnmounted (KHÔNG onBeforeUnmount) — Vue teardown cha-trước-con:
  // dock (con) clear `right` của nó trong onBeforeUnmount trước khi hook
  // này chạy, resetCombatInsets() ở đây xóa phần còn lại sau cùng.
  resetCombatInsets()
})
</script>

<template>
  <!-- 6A — background chiến đấu là vùng giao diện chính; canvas Phaser
       duy nhất của app vẫn là PhaserCanvas.vue trong MainScene.vue.
       Overlay chỉ còn TopBar (thông tin zone/stage), AI panel, dock
       kỹ năng mép phải và các modal. Bottom = full canvas. -->
  <div ref="rootRef" class="combat-scene-overlay">
    <CombatTopBar class="combat-scene-overlay__top-bar" />

    <CombatSkillDockPanel />

    <div class="combat-scene-overlay__battlefield">
      <!-- Combat AI panel — góc TRÁI battlefield, chỉ panel nhận pointer. -->
      <CombatAiPanel class="combat-scene-overlay__ai-panel" />
    </div>

    <!-- Slice 7 extension - turn-order preview (top, dưới TopBar) + battle
         log (góc phải-dưới, self-guarded khi không fighting). -->
    <TurnOrderStrip class="combat-scene-overlay__turn-order-strip" />

    <BattleLogPanel />

    <!-- 6A-T6 — confirm thoát trận (scene exit zone → bridge event). -->
    <CombatExitConfirmModal />

    <CombatResultModal />

    <CombatIntroOverlay />

    <CombatCountdownOverlay />
  </div>
</template>
<style scoped>
/* T8.1 (2026-09-02) — khôi phục styles bị mất trong 6A T8 rewrite
   (991ba75 đã xóa toàn bộ style scoped): root phủ canvas, AI panel
   neo trái-trên ("bảng chọn mục tiêu" — user report), battlefield
   là vùng chứa. Giá trị NGUYÊN BẢN từ 71357a1^ — không cải thiện
   tùy tiện. Status/event/control bar rules KHÔNG khôi phục (đã
   retire đúng chủ ý). */
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

.combat-scene-overlay__battlefield {
  position: relative;
  flex: 1 1 auto;
  pointer-events: none;
}

/* Combat AI panel (plan §11.1) — góc trái battlefield, dưới
   top bar (nằm trong vùng battlefield nên không đụng CombatTopBar). */
.combat-scene-overlay__ai-panel {
  position: absolute;
  left: var(--space-3);
  top: var(--space-3);
  z-index: 12;
}

/* Slice 7 extension - turn-order strip: neo dưới TopBar, giữa.
   Layout fix (2026-09-06) — trước dùng hardcode top: 60px (xấp xỉ chiều
   cao TopBar), nay đổi sang đúng token --combat-topbar-h mà TopBar và
   CombatSkillDockPanel đều dùng để trỏ height/top của chính nó. Strip và
   dock giờ neo CÙNG một mép dưới TopBar thay vì 2 giá trị lệch nhau —
   giảm khả năng strip "cắt" vào phần trên của dock. Strip vẫn full-width
   + justify-content: center nên nội dung thực tế (party/turn badges) nằm
   giữa màn hình; ở viewport rất hẹp nội dung căn giữa có thể vẫn chạm mép
   trái của dock — pointer-events: none nên không chặn thao tác, nhưng
   overlap hình ảnh trong trường hợp cực hẹp chưa được xử lý triệt để ở
   task này (xem báo cáo). */
.combat-scene-overlay__turn-order-strip {
  position: absolute;
  top: var(--combat-topbar-h);
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 12;
}

/* T8.2 — O3 vertical guard: viewport thấp, AI panel dọc cao
   (topbar ~64 + title + 5 options × --tap-min ~44) có thể chạm
   vùng HUD dưới-trái. Cho scroll trong panel thay vì đè. */
@media (max-height: 700px) {
  .combat-scene-overlay__ai-panel {
    max-height: calc(100% - 180px);
    overflow-y: auto;
  }
}
</style>
