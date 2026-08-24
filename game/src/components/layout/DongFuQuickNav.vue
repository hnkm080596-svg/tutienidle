<script setup lang="ts">
// UI redesign (spec mục 3/25 — Bottom quick navigation) — CHỈ 4 hệ
// thống cấp cao (Nhân Vật/Kho/Kỹ Năng/Tâm Pháp), không liệt kê Đan/Phù/
// Khí/Trận/Thám Hiểm/Tàng Kinh Các (đã có world location riêng ở
// Động Phủ, xem HomeBuildingIcons.vue). "Kỹ Năng"/"Tâm Pháp" (2026-08-20)
// giờ mở 2 overlay ĐỘC LẬP (SkillPathPanel.vue/TechniquePanel.vue, xem
// ui.standalonePanel) thay vì cùng panel 'loadout' (LoadoutManager.vue,
// đã xoá) khác tab như trước.
//
// WS4 Navigation shortcuts (2026-08-24) — icon 24px (--icon-nav),
// label 12px (--text-xs, luôn hiển thị), shortcut rộng co giãn
// 72-88px theo viewport, active state có indicator bar + nền rõ hơn.
import { useUiStore, type LeftPanelMode } from '@/stores/ui'

const ui = useUiStore()

function open(mode: Exclude<LeftPanelMode, null>) {
  ui.leftPanelMode = mode
}
</script>

<template>
  <div class="home-quicknav">
    <button
      type="button"
      class="home-quicknav__btn"
      :class="{ 'is-active': ui.leftPanelMode === 'character' }"
      @click="open('character')"
    >
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="10" cy="6.5" r="3.2" />
        <path d="M3.5 17c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" stroke-linecap="round" />
      </svg>
      <span>Nhân Vật</span>
    </button>

    <button
      type="button"
      class="home-quicknav__btn"
      :class="{ 'is-active': ui.leftPanelMode === 'inventory' }"
      @click="open('inventory')"
    >
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 8h14l-1 9H4L3 8Z" stroke-linejoin="round" />
        <path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2" stroke-linecap="round" />
      </svg>
      <span>Kho</span>
    </button>

    <button
      type="button"
      class="home-quicknav__btn"
      :class="{ 'is-active': ui.standalonePanel === 'skill' }"
      @click="ui.toggleStandalonePanel('skill')"
    >
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M10 2.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L10 12.4l-3.9 2.1.9-4.4-3.3-3 4.4-.5L10 2.5Z" />
      </svg>
      <span>Kỹ Năng</span>
    </button>

    <button
      type="button"
      class="home-quicknav__btn"
      :class="{ 'is-active': ui.standalonePanel === 'technique' }"
      @click="ui.toggleStandalonePanel('technique')"
    >
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5 3h8l2 2v12H5V3Z" stroke-linejoin="round" />
        <line x1="7.5" y1="7" x2="12.5" y2="7" stroke-linecap="round" />
        <line x1="7.5" y1="10" x2="12.5" y2="10" stroke-linecap="round" />
      </svg>
      <span>Tâm Pháp</span>
    </button>
  </div>
</template>

<style scoped>
.home-quicknav {
  display: flex;
  align-items: stretch;
  gap: var(--space-1);
}

.home-quicknav__btn {
  position: relative;
  /* WS4 — shortcut 72-88px tùy viewport; min-height khớp vùng bấm chuẩn. */
  width: clamp(72px, 7vw, 88px);
  min-height: var(--tap-min);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-body);
  transition: color 0.15s ease, background 0.15s ease;
}

.home-quicknav__btn span {
  font-size: var(--text-xs);
  line-height: var(--lh-tight);
  white-space: nowrap;
}

/* WS4 — active indicator: thanh vàng dưới + nền nhấn, nhận diện được
   ngay trạng thái đang mở mà không chỉ dựa vào màu chữ. */
.home-quicknav__btn::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 3px;
  height: 2px;
  border-radius: 1px;
  background: transparent;
  transition: background 0.15s ease;
}

.home-quicknav__btn:hover {
  color: var(--gold-300);
  background: rgba(255, 255, 255, 0.04);
}

.home-quicknav__btn.is-active {
  color: var(--gold-500);
  background: rgba(255, 213, 79, 0.1);
}

.home-quicknav__btn.is-active::after {
  background: var(--gold-500);
}

.home-quicknav__btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-gold);
}
</style>
