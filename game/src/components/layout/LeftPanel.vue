<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useSystemRimAuthority } from '@/composables/useSystemRimAuthority'
import CharacterPanel from '../panels/CharacterPanel.vue'
import CharacterDetailCard from '../panels/CharacterDetailCard.vue'

const ui = useUiStore()

// M-UI-SYSTEM (spec 4.1.1): the drawer drives the rim authority directly -
// base .sys-rim always renders the rim; .sys-rim--live animates only while
// this drawer is the topmost ACTIVE claimant (a system modal promotes
// above it, releasing on close hands the live rim back).
const { isTop } = useSystemRimAuthority('hud-left', () => ui.characterOverlayOpen)

// Equipment cố định 30% chỉ hiện cho Hành Trang — 'crafting' (Tứ
// Nghệ cũ) đã xoá ở Home Hub Phase 8 (nội dung tab 'artifact' chuyển
// sang Khí Đường). UI redesign Step 9 (2026-08-20) — Khí Đường
// (EquipmentHallPanel.vue) đã bỏ hẳn paperdoll riêng của nó (thu gọn
// về thuần Luyện Khí), nên khối 30% NÀY (Hành Trang/'inventory') giờ
// là nơi DUY NHẤT hiện paperdoll bên ngoài Character header. Các trang
// còn lại chiếm TOÀN BỘ 100% panel.
</script>

<template>
  <Transition name="panel-slide-left">
    <div
      v-if="ui.characterOverlayOpen"
      class="left-panel ink-drawer sys-surface sys-corners sys-rim sys-scanlines"
      :class="{ 'sys-rim--live': isTop }"
    >
      <div class="left-panel__content left-panel__content--full">
        <div class="left-panel__view">
          <CharacterPanel />
        </div>
      </div>

      <!-- Detail stat card - docked to the drawer's right edge, opened
           via the "Chi Tiet" button in CharacterPanel. It is a child of
           .left-panel so it slides in/out with the panel (transform
           transition). -->
      <Transition name="stats-card-fade">
        <CharacterDetailCard v-if="ui.characterDetailOpen" class="left-panel__detail" />
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
/* Vị trí/kích thước (position/top/left/width/bottom) do GameRoot.vue
   quyết định qua class truyền vào (.game-root__left-panel) — ở đây
   chỉ style hình thức, tránh 2 nơi cùng set position/height đè nhau.
   v-if trên chính div này (thay vì chỉ trên nội dung con) để cả khối
   panel (nền + border) cùng trượt vào/ra, không chỉ phần nội dung. */
.left-panel {
  /* Do NOT set width/height:100% - real position/size is owned by
     .game-root__left-panel (position:absolute; top:0; bottom:72px).
     height:100% here used to override bottom:72px (over-constrained,
     browser ignored bottom) making the panel spill to full 100vh and
     over the bottom bar. The frame ring is now owned by .ink-drawer
     (border-image) - do NOT declare a separate border here. */
  box-shadow: var(--sys-shadow, var(--surface-shadow-deep));
  display: flex;
  flex-direction: column;
  /* overflow: visible - the detail card docked at the right edge
     (left:100%) gets clipped under hidden; the inner scroll region
     already clips itself via .left-panel__view (overflow-y: auto). */
  overflow: visible;
}

/* Detail stat card - docked flush to the drawer's right edge, spanning
   nearly the full panel height. position:absolute anchors to
   .left-panel (position set by .game-root__left-panel). */
.left-panel__detail {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  bottom: 72px;
}

/* Narrow viewport (drawer near/full width, see GameRoot media queries):
   no room on the right - the card overlays drawer content instead of
   docking beside it. (width auto lives in the card's own style - the
   parent's scoped style cannot win width on the child component root.) */
@media (max-width: 900px) {
  .left-panel__detail {
    left: 8px;
    right: 8px;
    top: 8px;
    bottom: 8px;
  }
}

.stats-card-fade-enter-active,
.stats-card-fade-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.stats-card-fade-enter-from,
.stats-card-fade-leave-to {
  transform: translateX(-8px);
  opacity: 0;
}

/* Equipment CHỈ hiện cho Hành Trang/Tứ Nghệ, cố định 30% — phần còn
   lại (70%) là trang riêng của loại đó. 4 trang khác (Nhân Vật/Công
   Pháp/Thu Thập/Cài Đặt) không có khối này, content chiếm full 100%
   (xem .left-panel__content--full). */
.left-panel__equipment {
  flex: 0 0 30%;
  min-height: 0;
  border-bottom: 1px solid var(--sys-line, var(--ink-line));
}

.left-panel__content {
  flex: 1 1 70%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.left-panel__content--full {
  flex: 1 1 100%;
}

.left-panel__view {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.panel-slide-left-enter-active,
.panel-slide-left-leave-active {
  transition:
    transform 0.28s ease,
    filter 0.28s ease,
    opacity 0.28s ease;
}

.panel-slide-left-enter-from,
.panel-slide-left-leave-to {
  transform: translateX(-100%);
  filter: blur(12px);
  opacity: 0;
}

.panel-slide-left-enter-to,
.panel-slide-left-leave-from {
  transform: translateX(0);
  filter: blur(0);
  opacity: 1;
}
</style>
